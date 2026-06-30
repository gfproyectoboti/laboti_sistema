const prisma = require('../config/db');
const { getAdminContext } = require('../utils/adminContext');
const { STATUS_AMOUNT, isAdminLevel } = require('../utils/constants');

const getAllProviders = async (userId, userRole = 'ADMIN', page = null, limit = null) => {
    const whereConditions = {
        NOT: { name: { contains: '(ELIMINADO' } }
    };
    if (!isAdminLevel(userRole)) {
        whereConditions.visible_to_employee = true;
    }

    if (!page && !limit) {
        const providers = await prisma.provider.findMany({
            where: whereConditions,
            select: {
                id: true,
                name: true,
                payment_condition: true,
                credit_days: true,
                visible_to_employee: true,
            },
            orderBy: {
                name: 'asc'
            }
        });
        return { success: true, data: providers };
    }

    const pageNum = Math.max(1, parseInt(page, 10) || 1);
    const limitNum = Math.max(1, parseInt(limit, 10) || 10);
    const skip = (pageNum - 1) * limitNum;

    const [total, providers] = await Promise.all([
        prisma.provider.count({ where: whereConditions }),
        prisma.provider.findMany({
            where: whereConditions,
            skip,
            take: limitNum,
            select: {
                id: true,
                name: true,
                payment_condition: true,
                credit_days: true,
                visible_to_employee: true,
            },
            orderBy: {
                name: 'asc'
            }
        })
    ]);

    return {
        success: true,
        data: providers,
        meta: {
            total,
            page: pageNum,
            limit: limitNum,
            totalPages: Math.ceil(total / limitNum)
        }
    };
};

const createProvider = async (userId, providerData) => {
    const { name, paymentCondition, creditDays, visibleToEmployee } = providerData;
    const upperName = name.trim().toUpperCase();

    const existing = await prisma.provider.findFirst({ where: { name: upperName } });
    if (existing) {
        const error = new Error('El proveedor ya está en la lista');
        error.statusCode = 409;
        throw error;
    }

    const adminCtx = await getAdminContext();

    return await prisma.$transaction(async (tx) => {
        const provider = await tx.provider.create({
            data: {
                user_id: adminCtx.adminId, // Siempre anclado bajo el Admin del negocio
                name: upperName,
                payment_condition: paymentCondition,
                credit_days: creditDays,
                visible_to_employee: visibleToEmployee !== undefined ? visibleToEmployee : true,
            },
            select: {
                id: true,
                name: true,
                payment_condition: true,
                credit_days: true,
                visible_to_employee: true,
            }
        });

        await tx.auditLog.create({
            data: {
                user_id: parseInt(userId, 10),
                action: 'CREAR_PROVEEDOR',
                details: `Creó el proveedor "${upperName}" (Condición: ${paymentCondition}, Días de crédito: ${creditDays})`
            }
        });

        return provider;
    });
};

const updateProvider = async (userId, id, providerData) => {
    const { name, paymentCondition, creditDays, visibleToEmployee } = providerData;
    const upperName = name.trim().toUpperCase();
    const providerId = parseInt(id, 10);

    const existing = await prisma.provider.findFirst({
        where: { id: providerId }
    });
    if (!existing) {
        const error = new Error('No se encontró el proveedor');
        error.statusCode = 404;
        throw error;
    }

    const nameExists = await prisma.provider.findFirst({
        where: {
            name: upperName,
            id: { not: providerId }
        }
    });
    if (nameExists) {
        const error = new Error('El proveedor ya está en la lista');
        error.statusCode = 409;
        throw error;
    }

    return await prisma.$transaction(async (tx) => {
        await tx.provider.update({
            where: { id: providerId },
            data: {
                name: upperName,
                payment_condition: paymentCondition,
                credit_days: creditDays,
                visible_to_employee: visibleToEmployee !== undefined ? visibleToEmployee : true,
            }
        });

        await tx.auditLog.create({
            data: {
                user_id: parseInt(userId, 10),
                action: 'MODIFICAR_PROVEEDOR',
                details: `Modificó el proveedor ID ${providerId} (Nombre: "${upperName}", Condición: ${paymentCondition}, Días de crédito: ${creditDays}, Visible para empleados: ${visibleToEmployee !== undefined ? visibleToEmployee : true})`
            }
        });

        return { 
            id: providerId, 
            name: upperName, 
            payment_condition: paymentCondition, 
            credit_days: creditDays,
            visible_to_employee: visibleToEmployee !== undefined ? visibleToEmployee : true 
        };
    });
};

const deleteProvider = async (userId, id) => {
    const providerId = parseInt(id, 10);
    const providerToDelete = await prisma.provider.findFirst({
        where: { id: providerId }
    });
    if (!providerToDelete) {
        const error = new Error('No se encontró el proveedor');
        error.statusCode = 404;
        throw error;
    }
    if (providerToDelete.name.includes('(ELIMINADO')) {
        const error = new Error('Este proveedor ya ha sido eliminado');
        error.statusCode = 400;
        throw error;
    }

    // 1. Verificar egresos pendientes
    const pendingExpenses = await prisma.expense.count({
        where: {
            provider_id: providerId,
            status: STATUS_AMOUNT.PENDING,
            deleted_at: null
        }
    });

    if (pendingExpenses > 0) {
        const error = new Error('No se puede eliminar el proveedor porque tiene pagos pendientes asociados');
        error.statusCode = 400;
        throw error;
    }

    // 2. Verificar egresos pagados para soft-delete
    const paidExpensesCount = await prisma.expense.count({
        where: {
            provider_id: providerId,
            status: STATUS_AMOUNT.PAID
        }
    });

    return await prisma.$transaction(async (tx) => {
        let isSoft = false;
        if (paidExpensesCount > 0) {
            const timestamp = new Date().getTime();
            const newName = `${providerToDelete.name.slice(0, 60)} (ELIMINADO - ${timestamp})`;
            await tx.provider.update({
                where: { id: providerId },
                data: { name: newName }
            });
            isSoft = true;
        } else {
            await tx.provider.delete({
                where: { id: providerId }
            });
        }

        await tx.auditLog.create({
            data: {
                user_id: parseInt(userId, 10),
                action: 'ELIMINAR_PROVEEDOR',
                details: `${isSoft ? 'Eliminó lógicamente (renombró)' : 'Eliminó físicamente'} el proveedor "${providerToDelete.name}" (ID ${providerId})`
            }
        });

        return { id: providerId, success: true, softDeleted: isSoft };
    });
};

module.exports = {
    getAllProviders,
    createProvider,
    updateProvider,
    deleteProvider
};