/**
 * Constantes de Dominio de la Aplicación
 * * Centraliza los strings mágicos y valores constantes del negocio
 * para asegurar consistencia ortográfica y evitar errores de codificación.
 */

const BUDGET_CATEGORIES = {
    MERCHANDISE: 'Mercadería',
    FIXED_EXPENSES: 'Gastos Fijos',
    SAVINGS: 'Ahorro'
};

const ROLES = {
    ADMIN: 'ADMIN',
    MANAGER: 'MANAGER',
    EMPLOYEE: 'EMPLOYEE'
};

/**
 * isAdminLevel — Verifica si un rol tiene privilegios de administrador.
 * Centraliza la lógica para evitar repetir condiciones en múltiples archivos.
 * @param {string} role — El rol del usuario
 * @returns {boolean} — true si el rol tiene acceso de nivel administrador
 */
const isAdminLevel = (role) => role === ROLES.ADMIN || role === ROLES.MANAGER;

const STATUS_AMOUNT = {
    PENDING: 'Pendiente',
    PAID: 'Pagado'
};

const PAYMENT_CONDITIONS = {
    CASH: 'Contado',
    CREDIT: 'Credito'
};

module.exports = {
    BUDGET_CATEGORIES,
    ROLES,
    STATUS_AMOUNT,
    PAYMENT_CONDITIONS,
    isAdminLevel
};