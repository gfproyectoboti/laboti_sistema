/**
 * requireAdmin — Middleware de autorización
 *
 * Bloquea con 403 Forbidden cualquier request cuyo usuario
 * NO sea ADMIN o MANAGER. Requiere que authGuard haya corrido antes
 * (para que req.user esté poblado con el payload del JWT).
 *
 * Uso en rutas:
 *   router.get('/accounts', authGuard, requireAdmin, controller.getBalances);
 */
const { isAdminLevel } = require('../utils/constants');

const requireAdmin = (req, res, next) => {
    if (!req.user || !isAdminLevel(req.user.role)) {
        const error = new Error('Acceso denegado: se requiere rol de Administrador');
        error.statusCode = 403;
        return next(error);
    }
    next();
};

module.exports = requireAdmin;
