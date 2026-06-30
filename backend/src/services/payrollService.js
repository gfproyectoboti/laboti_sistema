const prisma = require('../config/db');
const { getAdminContext } = require('../utils/adminContext');
const { STATUS_AMOUNT, BUDGET_CATEGORIES, ROLES } = require('../utils/constants');
const Decimal = require('decimal.js');

/**
 * Busca o crea un proveedor "Nómina" para registrar gastos de sueldos/adelantos.
 * Esto permite reutilizar el flujo de Expense existente sin romper la constraint NOT NULL de provider_id.
 */
const getOrCreatePayrollProvider = async (tx, adminId, employee) => {
    const providerName = `Nómina - ${employee.employeeProfile.first_name} ${employee.employeeProfile.last_name}`;
    let provider = await tx.provider.findFirst({
        where: {
            user_id: adminId,
            name: providerName
        }
    });

    if (!provider) {
        provider = await tx.provider.create({
            data: {
                user_id: adminId,
                name: providerName,
                payment_condition: 'Contado',
                credit_days: 0,
                visible_to_employee: false
            }
        });
    }

    return provider;
};

/**
 * registerAdvance — Registra un adelanto de sueldo para un empleado.
 *
 * Crea un Expense con status: 'Pagado', category: 'Gastos Fijos',
 * debita la bolsa virtual de Gastos Fijos y la cuenta física del ADMIN.
 *
 * @param {Object} params
 * @param {number} params.employeeUserId — ID del User con role EMPLOYEE
 * @param {number} params.amount — Monto del adelanto
 * @param {number} params.userId — ID del usuario que registra (trazabilidad)
 * @param {number} [params.accountId] — Cuenta física a debitar (opcional, usa la primera del admin)
 */
const registerAdvance = async ({ employeeUserId, amount, userId, accountId }) => {
    const advanceAmount = new Decimal(amount);

    if (advanceAmount.lte(0)) {
        const error = new Error('El monto del adelanto debe ser positivo');
        error.statusCode = 400;
        throw error;
    }

    return await prisma.$transaction(async (tx) => {
        const adminCtx = await getAdminContext();

        // Verificar que el empleado existe y tiene perfil
        const employee = await tx.user.findFirst({
            where: { id: parseInt(employeeUserId, 10), role: ROLES.EMPLOYEE, deleted_at: null },
            include: { employeeProfile: true }
        });

        if (!employee || !employee.employeeProfile) {
            const error = new Error('Empleado no encontrado o sin perfil');
            error.statusCode = 404;
            throw error;
        }

        // Obtener o crear proveedor "Nómina"
        const payrollProvider = await getOrCreatePayrollProvider(tx, adminCtx.adminId, employee);

        // Determinar cuenta física a usar
        const finalAccountId = accountId
            ? parseInt(accountId, 10)
            : adminCtx.accounts[0]?.id;

        if (!finalAccountId) {
            const error = new Error('No hay cuentas físicas registradas');
            error.statusCode = 400;
            throw error;
        }

        const account = await tx.account.findUnique({ where: { id: finalAccountId } });
        if (!account) {
            const error = new Error('Cuenta física no encontrada');
            error.statusCode = 404;
            throw error;
        }

        if (new Decimal(account.balance.toString()).lt(advanceAmount)) {
            const error = new Error('Saldo insuficiente en la cuenta física');
            error.statusCode = 400;
            throw error;
        }

        const budget = await tx.budgetBalance.findUnique({
            where: {
                user_id_category: { user_id: adminCtx.adminId, category: BUDGET_CATEGORIES.FIXED_EXPENSES }
            }
        });

        if (!budget) {
            const error = new Error('La bolsa de Gastos Fijos no existe');
            error.statusCode = 404;
            throw error;
        }

        // Debitar cuenta física
        await tx.account.update({
            where: { id: finalAccountId },
            data: { balance: { decrement: parseFloat(advanceAmount.toString()) } }
        });

        // Debitar bolsa virtual
        await tx.budgetBalance.update({
            where: {
                user_id_category: { user_id: adminCtx.adminId, category: BUDGET_CATEGORIES.FIXED_EXPENSES }
            },
            data: { balance: { decrement: parseFloat(advanceAmount.toString()) } }
        });

        // Crear Expense pagado
        const expense = await tx.expense.create({
            data: {
                user_id: userId,
                provider_id: payrollProvider.id,
                account_id: finalAccountId,
                budget_category: BUDGET_CATEGORIES.FIXED_EXPENSES,
                amount: parseFloat(advanceAmount.toString()),
                status: STATUS_AMOUNT.PAID,
                paid_at: new Date(),
                due_date: new Date()
            }
        });

        // Auditoría
        await tx.auditLog.create({
            data: {
                user_id: userId,
                action: 'REGISTRAR_ADELANTO',
                details: `Registró adelanto de sueldo de $${advanceAmount.toFixed(2)} para ${employee.employeeProfile.first_name} ${employee.employeeProfile.last_name}`
            }
        });

        return expense;
    });
};

/**
 * processMonthlyPayroll — Genera los egresos pendientes de sueldo neto para todos los empleados activos.
 *
 * Para cada empleado con salary_type = 'fixed':
 *   salarioNeto = monthly_salary - totalAdelantosMes
 *   Crea un Expense con status: 'Pendiente' por el neto
 *
 * @param {number} userId — ID del usuario que procesa (trazabilidad)
 */
const processMonthlyPayroll = async ({ userId }) => {
    return await prisma.$transaction(async (tx) => {
        const adminCtx = await getAdminContext();

        // Inicio y fin del mes actual
        const now = new Date();
        const monthStart = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1));
        const monthEnd = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() + 1, 0, 23, 59, 59));

        // Obtener empleados activos con perfil
        const employees = await tx.user.findMany({
            where: { role: ROLES.EMPLOYEE, deleted_at: null },
            include: { employeeProfile: true }
        });

        // Filtrar solo empleados con salario fijo y salario positivo
        const fixedEmployees = employees.filter(
            emp => emp.employeeProfile && emp.employeeProfile.salary_type === 'fixed' && Number(emp.employeeProfile.monthly_salary || 0) > 0
        );

        if (fixedEmployees.length === 0) {
            return [];
        }

        // Obtener nombres de los proveedores de nómina que necesitamos
        const providerNameMap = new Map();
        fixedEmployees.forEach(emp => {
            const providerName = `Nómina - ${emp.employeeProfile.first_name} ${emp.employeeProfile.last_name}`;
            providerNameMap.set(emp.id, providerName);
        });

        const providerNames = Array.from(providerNameMap.values());

        // Cargar proveedores existentes en lote
        const existingProviders = await tx.provider.findMany({
            where: {
                user_id: adminCtx.adminId,
                name: { in: providerNames }
            }
        });

        // Mapear por nombre para búsqueda rápida
        const providerByName = new Map();
        existingProviders.forEach(p => providerByName.set(p.name, p));

        // Asegurar que todos los proveedores necesarios existan (crear los que falten)
        const payrollProviders = [];
        for (const emp of fixedEmployees) {
            const providerName = providerNameMap.get(emp.id);
            let provider = providerByName.get(providerName);

            if (!provider) {
                provider = await tx.provider.create({
                    data: {
                        user_id: adminCtx.adminId,
                        name: providerName,
                        payment_condition: 'Contado',
                        credit_days: 0,
                        visible_to_employee: false
                    }
                });
                providerByName.set(providerName, provider);
            }
            payrollProviders.push({ employeeId: emp.id, provider });
        }

        const providerIds = payrollProviders.map(p => p.provider.id);

        // Cargar todos los adelantos del mes en lote para todos los proveedores de nómina
        const allAdvances = await tx.expense.findMany({
            where: {
                provider_id: { in: providerIds },
                status: STATUS_AMOUNT.PAID,
                deleted_at: null,
                paid_at: {
                    gte: monthStart,
                    lte: monthEnd
                }
            }
        });

        // Agrupar adelantos por provider_id en memoria
        const advancesByProvider = new Map();
        providerIds.forEach(id => advancesByProvider.set(id, []));
        allAdvances.forEach(adv => {
            const list = advancesByProvider.get(adv.provider_id) || [];
            list.push(adv);
            advancesByProvider.set(adv.provider_id, list);
        });

        const results = [];

        for (const emp of fixedEmployees) {
            const monthlySalary = new Decimal(emp.employeeProfile.monthly_salary.toString());
            const payrollProviderItem = payrollProviders.find(p => p.employeeId === emp.id);
            const payrollProvider = payrollProviderItem.provider;

            // Obtener adelantos agrupados en memoria
            const employeeAdvances = advancesByProvider.get(payrollProvider.id) || [];

            // Sumar adelantos
            const totalAdvances = employeeAdvances.reduce(
                (sum, adv) => sum.plus(new Decimal(adv.amount.toString())),
                new Decimal(0)
            );

            const netSalary = Decimal.max(monthlySalary.minus(totalAdvances), new Decimal(0));

            if (netSalary.lte(0)) {
                results.push({
                    employee: `${emp.employeeProfile.first_name} ${emp.employeeProfile.last_name}`,
                    monthlySalary: monthlySalary.toNumber(),
                    advances: totalAdvances.toNumber(),
                    netSalary: 0,
                    status: 'Adelantos cubren el salario completo'
                });
                continue;
            }

            // Determinar cuenta física a usar
            const accountId = adminCtx.accounts[0]?.id;
            if (!accountId) {
                const error = new Error('No hay cuentas físicas registradas');
                error.statusCode = 400;
                throw error;
            }

            // Crear Expense pendiente por el neto
            const expense = await tx.expense.create({
                data: {
                    user_id: userId,
                    provider_id: payrollProvider.id,
                    account_id: accountId,
                    budget_category: BUDGET_CATEGORIES.FIXED_EXPENSES,
                    amount: parseFloat(netSalary.toString()),
                    status: STATUS_AMOUNT.PENDING,
                    due_date: monthEnd
                }
            });

            results.push({
                employee: `${emp.employeeProfile.first_name} ${emp.employeeProfile.last_name}`,
                monthlySalary: monthlySalary.toNumber(),
                advances: totalAdvances.toNumber(),
                netSalary: netSalary.toNumber(),
                expenseId: expense.id,
                status: 'Egreso pendiente creado'
            });
        }

        // Auditoría
        await tx.auditLog.create({
            data: {
                user_id: userId,
                action: 'PROCESAR_NOMINA',
                details: `Procesó nómina mensual para ${results.length} empleado(s). Total neto: $${results.reduce((s, r) => s + r.netSalary, 0).toFixed(2)}`
            }
        });

        return results;
    });
};

module.exports = { registerAdvance, processMonthlyPayroll };
