// backend/src/services/auth.service.js
const bcrypt = require('bcrypt');
const { isAdminLevel } = require('../utils/constants');
const prisma = require('../config/db');
const {
    generateAccessToken,
    generateRefreshToken,
    hashRefreshToken,
    verifyToken
} = require('../utils/tokenUtils');
const { clearAdminContextCache } = require('../utils/adminContext');

const register = async (userData) => {
    const { username, password, role } = userData;

    const existing = await prisma.user.findUnique({ where: { username } });
    if (existing) {
        const error = new Error('El nombre de usuario ya está en uso');
        error.statusCode = 409;
        throw error;
    }

    const validRoles = ['ADMIN', 'MANAGER', 'EMPLOYEE'];
    const userRole = validRoles.includes(role) ? role : 'EMPLOYEE';

    if (userRole === 'ADMIN') {
        const adminExists = await prisma.user.findFirst({
            where: { role: 'ADMIN', deleted_at: null }
        });
        if (adminExists) {
            const error = new Error('El registro de administradores adicionales está deshabilitado.');
            error.statusCode = 400;
            throw error;
        }
    }

    const BCRYPT_ROUNDS = parseInt(process.env.BCRYPT_ROUNDS) || 12;
    const password_hash = await bcrypt.hash(password, BCRYPT_ROUNDS);

    return await prisma.$transaction(async (tx) => {
        const user = await tx.user.create({
            data: {
                username,
                password_hash,
                role: userRole,
                must_change_password: userRole !== 'ADMIN',
                pct_merchandise: userRole === 'ADMIN' ? (userData.pct_merchandise || 0.60) : 0.00,
                pct_fixed_expenses: userRole === 'ADMIN' ? (userData.pct_fixed_expenses || 0.30) : 0.00,
                pct_savings: userRole === 'ADMIN' ? (userData.pct_savings || 0.10) : 0.00,
            },
            select: {
                id: true,
                username: true,
                role: true,
                pct_merchandise: true,
                pct_fixed_expenses: true,
                pct_savings: true,
                created_at: true,
            },
        });

        if (userRole === 'ADMIN') {
            await tx.account.createMany({
                data: [
                    { user_id: user.id, name: 'Efectivo', balance: 0.00 },
                    { user_id: user.id, name: 'Cuenta Bancaria', balance: 0.00 }
                ]
            });

            await tx.budgetBalance.createMany({
                data: [
                    { user_id: user.id, category: 'Mercadería', balance: 0.00 },
                    { user_id: user.id, category: 'Gastos Fijos', balance: 0.00 },
                    { user_id: user.id, category: 'Ahorro', balance: 0.00 }
                ]
            });
        } else {
            await tx.employeeProfile.create({
                data: {
                    user_id: user.id,
                    first_name: userData.first_name,
                    last_name: userData.last_name,
                    salary_type: userData.salary_type || "hourly",
                    hourly_rate: userData.hourly_rate ? parseFloat(userData.hourly_rate) : 0.00,
                    monthly_salary: userData.monthly_salary ? parseFloat(userData.monthly_salary) : null
                }
            });

            await tx.employeePermission.create({
                data: {
                    user_id: user.id,
                    canRegisterClosures: userRole === 'MANAGER',
                    canRegisterExpenses: userRole === 'MANAGER',
                    canPayExpenses: userRole === 'MANAGER',
                    canManageProviders: userRole === 'MANAGER'
                }
            });
        }
        return user;
    });
};

const login = async ({ username, password }) => {
    const user = await prisma.user.findUnique({
        where: { username },
        include: { employeePermission: true }
    });

    if (!user || user.deleted_at !== null) {
        const error = new Error('Credenciales incorrectas');
        error.statusCode = 401;
        throw error;
    }

    const isPasswordValid = await bcrypt.compare(password, user.password_hash);
    if (!isPasswordValid) {
        const error = new Error('Credenciales incorrectas');
        error.statusCode = 401;
        throw error;
    }

    // Preparar payload
    const payload = {
        username: user.username,
        role: user.role,
        mustChangePassword: user.must_change_password,
    };

    if (!isAdminLevel(user.role) && user.employeePermission) {
        payload.permissions = {
            canRegisterClosures: user.employeePermission.canRegisterClosures,
            canRegisterExpenses: user.employeePermission.canRegisterExpenses,
            canPayExpenses: user.employeePermission.canPayExpenses,
            canManageProviders: user.employeePermission.canManageProviders
        };
    }

    // ✅ Generar access token (15 min)
    const accessToken = generateAccessToken(user.id, payload);

    // ✅ Generar refresh token (30 días) y HASHEAR para guardar
    const refreshToken = generateRefreshToken(user.id);
    const refreshTokenHash = hashRefreshToken(refreshToken);

    await prisma.user.update({
        where: { id: user.id },
        data: { refresh_token_hash: refreshTokenHash }
    });

    return {
        user: {
            id: user.id,
            username: user.username,
            role: user.role,
            mustChangePassword: user.must_change_password,
        },
        accessToken,
        refreshToken,
        expiresIn: 900,
    };
};

/**
 * Refresca el access token usando un refresh token válido
 */
const refreshAccessToken = async (refreshTokenStr) => {
    if (!refreshTokenStr) {
        const error = new Error('Refresh token no proporcionado');
        error.statusCode = 401;
        throw error;
    }

    // ✅ Verificar JWT del refresh token
    const REFRESH_SECRET = process.env.REFRESH_SECRET;
    const decoded = verifyToken(refreshTokenStr, REFRESH_SECRET);

    if (!decoded || decoded.type !== 'refresh') {
        const error = new Error('Refresh token inválido o tipo incorrecto');
        error.statusCode = 401;
        throw error;
    }

    // ✅ Buscar usuario con HASH coincidente
    const tokenHash = hashRefreshToken(refreshTokenStr);
    const user = await prisma.user.findFirst({
        where: {
            id: decoded.id,
            refresh_token_hash: tokenHash,
            deleted_at: null
        },
        include: { employeePermission: true }
    });

    if (!user) {
        const error = new Error('Refresh token revocado o usuario inválido');
        error.statusCode = 401;
        throw error;
    }

    // Preparar nuevo payload
    const payload = {
        username: user.username,
        role: user.role,
    };

    if (!isAdminLevel(user.role) && user.employeePermission) {
        payload.permissions = {
            canRegisterClosures: user.employeePermission.canRegisterClosures,
            canRegisterExpenses: user.employeePermission.canRegisterExpenses,
            canPayExpenses: user.employeePermission.canPayExpenses,
            canManageProviders: user.employeePermission.canManageProviders,
        };
    }

    // ✅ Generar nuevo access token
    const newAccessToken = generateAccessToken(user.id, payload);

    // NOTA: Desactivamos la rotación constante del refresh token para evitar problemas de 
    // concurrencia (múltiples pestañas o peticiones simultáneas) que causan el error "Revocado".
    // El refresh token seguirá siendo válido hasta que expire (30 días) o el usuario haga logout.

    return {
        accessToken: newAccessToken,
        expiresIn: 900,
    };
};

/**
 * Logout: revoca el refresh token
 */
const logout = async (userId) => {
    await prisma.user.update({
        where: { id: userId },
        data: { refresh_token_hash: null }
    }).catch(() => {
        
    });
};

const updatePercentages = async ({ userId, pct_merchandise, pct_fixed_expenses, pct_savings }) => {
    const total = parseFloat(pct_merchandise) + parseFloat(pct_fixed_expenses) + parseFloat(pct_savings);

    if (Math.abs(total - 1.0) > 0.01) {
        const error = new Error(`Los porcentajes deben sumar 100% (actual: ${(total * 100).toFixed(2)}%)`);
        error.statusCode = 400;
        throw error;
    }

    if (pct_merchandise < 0 || pct_fixed_expenses < 0 || pct_savings < 0) {
        const error = new Error('Los porcentajes no pueden ser negativos');
        error.statusCode = 400;
        throw error;
    }

    const updatedUser = await prisma.user.update({
        where: { id: userId },
        data: { pct_merchandise, pct_fixed_expenses, pct_savings },
        select: {
            id: true,
            pct_merchandise: true,
            pct_fixed_expenses: true,
            pct_savings: true,
        },
    });

    clearAdminContextCache();
    return updatedUser;
};

/**
 * Cambiar contraseña (primer inicio de sesión con contraseña temporal).
 * Valida la contraseña actual, hashea la nueva y desactiva el flag must_change_password.
 */
const changePassword = async ({ userId, currentPassword, newPassword }) => {
    const user = await prisma.user.findUnique({ where: { id: userId } });

    if (!user || user.deleted_at !== null) {
        const error = new Error('Usuario no encontrado');
        error.statusCode = 404;
        throw error;
    }

    const isPasswordValid = await bcrypt.compare(currentPassword, user.password_hash);
    if (!isPasswordValid) {
        const error = new Error('La contraseña actual es incorrecta');
        error.statusCode = 401;
        throw error;
    }

    const BCRYPT_ROUNDS = parseInt(process.env.BCRYPT_ROUNDS) || 12;
    const newPasswordHash = await bcrypt.hash(newPassword, BCRYPT_ROUNDS);

    await prisma.user.update({
        where: { id: userId },
        data: {
            password_hash: newPasswordHash,
            must_change_password: false,
        },
    });

    return { message: 'Contraseña actualizada correctamente' };
};

module.exports = {
    register,
    login,
    refreshAccessToken,
    logout,
    updatePercentages,
    changePassword
};
