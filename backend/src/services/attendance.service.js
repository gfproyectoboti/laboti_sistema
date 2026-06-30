const prisma = require('../config/db');
const { BUDGET_CATEGORIES, STATUS_AMOUNT, ROLES } = require('../utils/constants');

const attendanceService = {

    async registerAttendance(employeeId, checkIn, checkOut) {
        const start = new Date(checkIn);
        const end = new Date(checkOut);

        if (end <= start) {
            const error = new Error('La fecha de salida (checkOut) debe ser posterior a la de entrada (checkIn)');
            error.statusCode = 400;
            throw error;
        }

        // Verificación matemática de solapamiento de intervalos horaria
        const overlappingLog = await prisma.attendanceLog.findFirst({
            where: {
                employee_id: employeeId,
                check_in: { lt: end },
                check_out: { gt: start }
            }
        });

        if (overlappingLog) {
            const error = new Error('El empleado ya tiene un turno registrado que se superpone con este horario');
            error.statusCode = 400;
            throw error;
        }

        const employee = await prisma.user.findFirst({
            where: { id: employeeId, role: ROLES.EMPLOYEE },
            include: { employeeProfile: true }
        });

        if (!employee || !employee.employeeProfile) {
            const error = new Error('Empleado no encontrado o no posee un perfil configurado');
            error.statusCode = 404;
            throw error;
        }

        const { salary_type, hourly_rate } = employee.employeeProfile;
        const diffMs = end - start;
        const hoursWorked = parseFloat((diffMs / (1000 * 60 * 60)).toFixed(2));

        let amountEarned = 0;
        if (salary_type === 'hourly') {
            if (!hourly_rate) {
                const error = new Error('El empleado es de tipo "hourly" pero no tiene una tarifa asignada');
                error.statusCode = 400;
                throw error;
            }
            amountEarned = parseFloat((hoursWorked * parseFloat(hourly_rate)).toFixed(2));
        }

        return await prisma.attendanceLog.create({
            data: {
                employee_id: employeeId,
                check_in: start,
                check_out: end,
                hours_worked: hoursWorked,
                amount_earned: amountEarned
            }
        });
    },

    async getAttendanceLogs({ employeeId, from, to }) {
        const where = {};

        if (employeeId) {
            where.employee_id = parseInt(employeeId, 10);
        }

        if (from || to) {
            where.check_in = {};
            if (from) where.check_in.gte = new Date(from);
            if (to) {
                const toDate = new Date(to);
                toDate.setUTCHours(23, 59, 59, 999);
                where.check_in.lte = toDate;
            }
        }

        const MAX_RESULTS = 5000;
        const logs = await prisma.attendanceLog.findMany({
            where,
            take: MAX_RESULTS,
            include: {
                employee: {
                    select: {
                        id: true,
                        username: true,
                        employeeProfile: {
                            select: { first_name: true, last_name: true }
                        }
                    }
                }
            },
            orderBy: { check_in: 'desc' }
        });

        return logs.map(log => {
            const profile = log.employee?.employeeProfile;
            const fullName = profile ? `${profile.first_name} ${profile.last_name}` : `@${log.employee?.username}`;
            return {
                ...log,
                employee: {
                    id: log.employee?.id,
                    username: log.employee?.username,
                    name: fullName
                }
            };
        });
    },

    async getSummaryForPeriod(from, to, employeeId = null, txClient = null) {
        const client = txClient || prisma;
        const where = {};

        if (employeeId) where.employee_id = parseInt(employeeId, 10);
        where.notes = null; // Ignorar asistencias ya liquidadas anteriormente

        if (from || to) {
            where.check_in = {};
            if (from) where.check_in.gte = new Date(from);
            if (to) {
                const toDate = new Date(to);
                toDate.setUTCHours(23, 59, 59, 999);
                where.check_in.lte = toDate;
            }
        }

        const aggregations = await client.attendanceLog.groupBy({
            by: ['employee_id'],
            where,
            _sum: { hours_worked: true, amount_earned: true }
        });

        const employeeIds = aggregations.map(agg => agg.employee_id);
        const users = await client.user.findMany({
            where: { id: { in: employeeIds } },
            include: { employeeProfile: true }
        });
        const userMap = new Map(users.map(u => [u.id, u]));

        return aggregations.map((agg) => {
            const user = userMap.get(agg.employee_id);

            const totalHours = agg._sum.hours_worked ? parseFloat(agg._sum.hours_worked.toFixed(2)) : 0;
            let totalToPay = agg._sum.amount_earned ? parseFloat(agg._sum.amount_earned.toFixed(2)) : 0;

            if (user?.employeeProfile?.salary_type === 'fixed') {
                totalToPay = user.employeeProfile.monthly_salary ? parseFloat(user.employeeProfile.monthly_salary) : 0;
            }

            const profile = user?.employeeProfile;
            const fullName = profile ? `${profile.first_name} ${profile.last_name}` : `@${user?.username || 'desconocido'}`;

            return {
                employeeId: agg.employee_id,
                name: fullName,
                username: user?.username || 'desconocido',
                salaryType: user?.employeeProfile?.salary_type || 'No definido',
                totalHours,
                calculatedAmount: totalToPay
            };
        });
    },

    async updateAttendance(id, checkIn, checkOut) {
        const start = new Date(checkIn);
        const end = new Date(checkOut);

        if (end <= start) {
            const error = new Error('La fecha de salida debe ser posterior a la de entrada');
            error.statusCode = 400;
            throw error;
        }

        const log = await prisma.attendanceLog.findUnique({
            where: { id },
            include: { employee: { include: { employeeProfile: true } } }
        });

        if (!log) {
            const error = new Error('Registro de asistencia no encontrado');
            error.statusCode = 404;
            throw error;
        }

        if (log.notes) {
            const error = new Error('No se pueden modificar registros de asistencia que ya han sido liquidados');
            error.statusCode = 403;
            throw error;
        }

        // Verificación matemática unificada excluyendo el registro actual
        const overlappingLog = await prisma.attendanceLog.findFirst({
            where: {
                employee_id: log.employee_id,
                NOT: { id: id },
                check_in: { lt: end },
                check_out: { gt: start }
            }
        });

        if (overlappingLog) {
            const error = new Error('El nuevo horario se superpone con otro turno ya existente para este empleado');
            error.statusCode = 400;
            throw error;
        }

        const employeeProfile = log.employee?.employeeProfile || {};
        const salary_type = employeeProfile.salary_type;
        const hourly_rate = employeeProfile.hourly_rate;
        const diffMs = end - start;
        const hoursWorked = parseFloat((diffMs / (1000 * 60 * 60)).toFixed(2));

        let amountEarned = 0;
        if (salary_type === 'hourly') {
            amountEarned = parseFloat((hoursWorked * parseFloat(hourly_rate)).toFixed(2));
        }

        return await prisma.attendanceLog.update({
            where: { id },
            data: {
                check_in: start,
                check_out: end,
                hours_worked: hoursWorked,
                amount_earned: amountEarned
            }
        });
    },

    async deleteAttendance(id) {
        const log = await prisma.attendanceLog.findUnique({ where: { id } });
        if (!log) {
            const error = new Error('Registro de asistencia no encontrado');
            error.statusCode = 404;
            throw error;
        }

        if (log.notes) {
            const error = new Error('No se pueden eliminar registros de asistencia que ya han sido liquidados');
            error.statusCode = 403;
            throw error;
        }

        return await prisma.attendanceLog.delete({ where: { id } });
    },

    async processPayrollToExpenses({ employeeId, from, to, providerId, accountId, budgetCategory, adminUserId }) {
        return await prisma.$transaction(async (tx) => {
            const summary = await this.getSummaryForPeriod(from, to, employeeId, tx);
            const employeeData = summary[0];

            if (!employeeData || employeeData.calculatedAmount <= 0) {
                throw new Error('No hay montos salariales válidos para liquidar en este período');
            }

            const category = budgetCategory || BUDGET_CATEGORIES.FIXED_EXPENSES;

            const payrollExpense = await tx.expense.create({
                data: {
                    user_id: adminUserId,
                    provider_id: providerId,
                    account_id: accountId,
                    amount: employeeData.calculatedAmount,
                    status: STATUS_AMOUNT.PENDING,
                    due_date: new Date(),
                    budget_category: category
                }
            });

            await tx.attendanceLog.updateMany({
                where: {
                    employee_id: employeeId,
                    check_in: { gte: new Date(from), lte: new Date(to) },
                    notes: null
                },
                data: {
                    notes: `Liquidado automáticamente en Egreso ID: ${payrollExpense.id}`
                }
            });

            return payrollExpense;
        });
    },

    async employeeCheckIn(employeeId) {
        const activeLog = await prisma.attendanceLog.findFirst({
            where: {
                employee_id: employeeId,
                check_out: null
            }
        });

        if (activeLog) {
            const error = new Error('Ya posee un turno activo registrado');
            error.statusCode = 400;
            throw error;
        }

        return await prisma.attendanceLog.create({
            data: {
                employee_id: employeeId,
                check_in: new Date(),
                check_out: null
            }
        });
    },

    async employeeCheckOut(employeeId) {
        const activeLog = await prisma.attendanceLog.findFirst({
            where: {
                employee_id: employeeId,
                check_out: null
            }
        });

        if (!activeLog) {
            const error = new Error('No tiene ningún turno activo para registrar salida');
            error.statusCode = 400;
            throw error;
        }

        const checkInTime = new Date(activeLog.check_in);
        const checkOutTime = new Date();

        if (checkOutTime <= checkInTime) {
            const error = new Error('La hora de salida debe ser posterior a la de entrada');
            error.statusCode = 400;
            throw error;
        }

        const employee = await prisma.user.findFirst({
            where: { id: employeeId, role: ROLES.EMPLOYEE },
            include: { employeeProfile: true }
        });

        if (!employee || !employee.employeeProfile) {
            const error = new Error('Empleado no encontrado o perfil no configurado');
            error.statusCode = 404;
            throw error;
        }

        const { salary_type, hourly_rate } = employee.employeeProfile;
        const diffMs = checkOutTime - checkInTime;
        const hoursWorked = parseFloat((diffMs / (1000 * 60 * 60)).toFixed(2));

        let amountEarned = 0;
        if (salary_type === 'hourly') {
            if (!hourly_rate) {
                const error = new Error('El empleado es de tipo "hourly" pero no tiene tarifa asignada');
                error.statusCode = 400;
                throw error;
            }
            amountEarned = parseFloat((hoursWorked * parseFloat(hourly_rate)).toFixed(2));
        }

        return await prisma.attendanceLog.update({
            where: { id: activeLog.id },
            data: {
                check_out: checkOutTime,
                hours_worked: hoursWorked,
                amount_earned: amountEarned
            }
        });
    },

    async getEmployeeStatus(employeeId) {
        const todayStart = new Date();
        todayStart.setHours(0, 0, 0, 0);

        const [activeLog, todayLogs] = await Promise.all([
            prisma.attendanceLog.findFirst({
                where: {
                    employee_id: employeeId,
                    check_out: null
                }
            }),
            prisma.attendanceLog.findMany({
                where: {
                    employee_id: employeeId,
                    check_in: { gte: todayStart }
                }
            })
        ]);

        return {
            hasActiveSession: !!activeLog,
            currentSession: activeLog,
            todaySessionsCount: todayLogs.length
        };
    }
};

module.exports = attendanceService;