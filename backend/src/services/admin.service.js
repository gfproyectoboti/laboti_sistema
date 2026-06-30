const prisma = require('../config/db');
const bcrypt = require('bcrypt');
const { ROLES } = require('../utils/constants');

const createEmployee = async (employeeData) => {
    const { username, first_name, last_name, password, hourly_rate, salary_type, monthly_salary, email, role } = employeeData;

    const existingUser = await prisma.user.findUnique({ where: { username } });
    if (existingUser) {
        const error = new Error('El empleado ya se encuentra registrado');
        error.statusCode = 400;
        throw error;
    }

    if (email) {
        const existingEmail = await prisma.user.findUnique({ where: { email: email.toLowerCase().trim() } });
        if (existingEmail) {
            const error = new Error('El correo electrónico ya está en uso');
            error.statusCode = 400;
            throw error;
        }
    }

    const BCRYPT_ROUNDS = parseInt(process.env.BCRYPT_ROUNDS) || 12;
    const password_hash = await bcrypt.hash(password, BCRYPT_ROUNDS);

    return await prisma.$transaction(async (tx) => {
        const employeeRole = role === ROLES.MANAGER ? ROLES.MANAGER : ROLES.EMPLOYEE;

        const newUser = await tx.user.create({
            data: {
                username,
                password_hash,
                email: email ? email.toLowerCase().trim() : null,
                role: employeeRole,
                must_change_password: true
            },
            select: { id: true, username: true, email: true, role: true, created_at: true }
        });

        if (employeeRole === ROLES.EMPLOYEE || employeeRole === ROLES.MANAGER) {
            // Creamos perfil salarial (el MANAGER tendrá 0 si se ocultan los inputs)
            await tx.employeeProfile.create({
                data: {
                    user_id: newUser.id,
                    hourly_rate: hourly_rate || 0,
                    first_name,
                    last_name,
                    salary_type: salary_type || 'hourly',
                    monthly_salary: salary_type === 'fixed' ? (monthly_salary || 0) : null
                }
            });

            await tx.employeePermission.create({
                data: {
                    user_id: newUser.id,
                    canRegisterClosures: employeeRole === ROLES.MANAGER,
                    canRegisterExpenses: employeeRole === ROLES.MANAGER,
                    canPayExpenses: employeeRole === ROLES.MANAGER,
                    canManageProviders: employeeRole === ROLES.MANAGER
                }
            });
        }

        return newUser;
    });
};


const getEmployees = async () => {
    return await prisma.user.findMany({
        where: { role: { in: [ROLES.EMPLOYEE, ROLES.MANAGER] }, deleted_at: null },
        select: {
            id: true,
            username: true,
            email: true,
            role: true,
            created_at: true,
            employeeProfile: true,
            employeePermission: true
        }
    });
};

const updateEmployeePermissions = async (userId, permissionsData) => {
    const permissionExists = await prisma.employeePermission.findUnique({ where: { user_id: userId } });
    if (!permissionExists) {
        const error = new Error('Permisos no encontrados para este usuario');
        error.statusCode = 404;
        throw error;
    }

    return await prisma.employeePermission.update({
        where: { user_id: userId },
        data: {
            canRegisterClosures: permissionsData.canRegisterClosures,
            canRegisterExpenses: permissionsData.canRegisterExpenses,
            canPayExpenses: permissionsData.canPayExpenses,
            canManageProviders: permissionsData.canManageProviders
        }
    });
};

const updateEmployeeProfile = async (userId, profileData) => {
    const profileExists = await prisma.employeeProfile.findUnique({ where: { user_id: userId } });
    if (!profileExists) {
        const error = new Error('Perfil de empleado no encontrado');
        error.statusCode = 404;
        throw error;
    }

    return await prisma.employeeProfile.update({
        where: { user_id: userId },
        data: {
            hourly_rate: profileData.hourly_rate,
            salary_type: profileData.salary_type,
            monthly_salary: profileData.salary_type === 'fixed' ? profileData.monthly_salary : null
        }
    });
};

const deleteEmployee = async (id) => {
    const user = await prisma.user.findUnique({ where: { id } });
    if (!user || user.role === ROLES.ADMIN || user.deleted_at !== null) {
        const error = new Error('Empleado no encontrado');
        error.statusCode = 404;
        throw error;
    }

    return await prisma.user.update({
        where: { id },
        data: { deleted_at: new Date() }
    });
};

const getDistributionSettings = async (adminId) => {
    const admin = await prisma.user.findUnique({
        where: { id: adminId },
        select: {
            pct_merchandise: true,
            pct_fixed_expenses: true,
            pct_savings: true
        }
    });
    if (!admin) {
        const error = new Error('Administrador no encontrado');
        error.statusCode = 404;
        throw error;
    }
    return {
        pct_merchandise: Number(admin.pct_merchandise),
        pct_fixed_expenses: Number(admin.pct_fixed_expenses),
        pct_savings: Number(admin.pct_savings)
    };
};

const updateDistributionSettings = async (adminId, { pct_merchandise, pct_fixed_expenses, pct_savings }) => {
    const sum = Number(pct_merchandise) + Number(pct_fixed_expenses) + Number(pct_savings);
    if (Math.abs(sum - 1.00) > 0.001) {
        const error = new Error('La suma de los porcentajes de distribución debe ser exactamente el 100% (1.00)');
        error.statusCode = 400;
        throw error;
    }

    const updated = await prisma.user.update({
        where: { id: adminId },
        data: {
            pct_merchandise: Number(pct_merchandise),
            pct_fixed_expenses: Number(pct_fixed_expenses),
            pct_savings: Number(pct_savings)
        },
        select: {
            pct_merchandise: true,
            pct_fixed_expenses: true,
            pct_savings: true
        }
    });

    return {
        pct_merchandise: Number(updated.pct_merchandise),
        pct_fixed_expenses: Number(updated.pct_fixed_expenses),
        pct_savings: Number(updated.pct_savings)
    };
};

const getAuditLogs = async (page = null, limit = null) => {
    // Si no se especifican, se fuerza un límite saludable por defecto (50 logs)
    const pageNum = Math.max(1, parseInt(page, 10) || 1);
    const limitNum = Math.max(1, parseInt(limit, 10) || 50);
    const skip = (pageNum - 1) * limitNum;

    const [total, logs] = await Promise.all([
        prisma.auditLog.count(),
        prisma.auditLog.findMany({
            skip,
            take: limitNum,
            include: {
                user: {
                    select: {
                        username: true,
                        role: true
                    }
                }
            },
            orderBy: {
                created_at: 'desc'
            }
        })
    ]);

    return {
        success: true,
        data: logs,
        meta: {
            total,
            page: pageNum,
            limit: limitNum,
            totalPages: Math.ceil(total / limitNum)
        }
    };
};

module.exports = {
    createEmployee,
    getEmployees,
    updateEmployeePermissions,
    updateEmployeeProfile,
    deleteEmployee,
    getDistributionSettings,
    updateDistributionSettings,
    getAuditLogs
};