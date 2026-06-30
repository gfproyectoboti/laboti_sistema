const { z } = require('zod');
const { BUDGET_CATEGORIES, STATUS_AMOUNT, PAYMENT_CONDITIONS } = require('./constants');

// Mapeamos los arrays válidos directamente desde las constantes unificadas
const statusAmountValues = Object.values(STATUS_AMOUNT);
const paymentConditionValues = Object.values(PAYMENT_CONDITIONS);
const budgetCategoryValues = Object.values(BUDGET_CATEGORIES);

// Validador de porcentajes decimales (ej. 0.60 para 60%)
const pctField = (fieldName) => {
    return z.number()
        .min(0, `El porcentaje de ${fieldName} debe ser mayor o igual a 0`)
        .max(1, `El porcentaje de ${fieldName} debe ser menor o igual a 1`);
};

const registerSchema = z.object({
    username: z.string()
        .min(6, 'El usuario debe tener al menos 6 caracteres')
        .max(20, 'El usuario no puede tener más de 20 caracteres'),
    password: z.string()
        .min(8, 'La contraseña debe tener al menos 8 caracteres'),
    pct_merchandise: pctField('Mercadería').optional(),
    pct_fixed_expenses: pctField('Gastos Fijos').optional(),
    pct_savings: pctField('Ahorros').optional(),
    role: z.enum(['ADMIN', 'MANAGER', 'EMPLOYEE']).optional(),
    first_name: z.string().optional(),
    last_name: z.string().optional(),
    salary_type: z.enum(['hourly', 'fixed']).optional(),
    hourly_rate: z.number().optional(),
    monthly_salary: z.number().optional()
}).refine(
    (data) => {
        if (data.pct_merchandise !== undefined || data.pct_fixed_expenses !== undefined || data.pct_savings !== undefined) {
            const m = data.pct_merchandise || 0;
            const f = data.pct_fixed_expenses || 0;
            const s = data.pct_savings || 0;
            return Math.abs(m + f + s - 1) < 0.001;
        }
        return true;
    },
    {
        message: 'Los porcentajes de distribución deben sumar exactamente el 100% (1.00)',
        path: ['pct_merchandise'],
    }
);

const loginSchema = z.object({
    username: z.string()
        .min(6, 'Usuario o contraseña incorrectos')
        .max(20, 'Usuario o contraseña incorrectos'),
    password: z.string()
        .min(8, 'Usuario o contraseña incorrectos'),
});

const dailyClosureSchema = z.object({
    total_amount: z.number().positive('El monto total debe ser mayor a 0'),
    details: z.array(z.object({
        account_id: z.number().int().positive('El ID de cuenta debe ser un entero positivo'),
        amount: z.number().nonnegative('El monto debe ser mayor o igual a 0'),
    })).min(1, 'Debe ingresar al menos un medio de pago'),
}).refine((data) => {
    const sum_details = data.details.reduce((sum, detail) => sum + detail.amount, 0);
    return Math.abs(sum_details - data.total_amount) < 0.01;
}, {
    message: 'La suma de los montos por cuenta debe coincidir con el total del cierre',
    path: ['details'],
});

const providerSchema = z.object({
    name: z.string()
        .min(3, 'El nombre del proveedor debe tener al menos 3 caracteres')
        .max(100, 'El nombre del proveedor no puede tener más de 100 caracteres'),
    payment_condition: z.enum(paymentConditionValues, {
        errorMap: () => ({ message: 'Condición de pago inválida' })
    }),
    credit_days: z.number().int().nonnegative('La cantidad de días debe ser mayor o igual a 0').default(0).optional(),
    visible_to_employee: z.boolean().optional().default(true),
});

const expensesSchema = z.object({
    provider_id: z.number().int().positive('ID del proveedor debe ser válido'),
    account_id: z.number().int().positive('ID de cuenta debe ser válido'),
    budget_category: z.string()
        .min(1, 'Categoría de presupuesto requerida')
        .max(50, 'Categoría muy larga'),
    amount: z.number()
        .positive('El monto debe ser mayor a 0')  // ✅ CRUCIAL
        .refine(val => val >= 0.01, 'El monto mínimo es 0.01'),
    status: z.enum(['Pendiente', 'Pagado']).optional(),
    due_date: z.string().datetime().optional()
}).refine((data) => {
    if (data.status === STATUS_AMOUNT.PENDING && !data.due_date) return false;
    return true;
}, {
    message: 'Los gastos pendientes requieren una fecha de vencimiento',
    path: ['due_date'],
});

const updatePercentagesSchema = z.object({
    pct_merchandise: pctField('Mercadería'),
    pct_fixed_expenses: pctField('Gastos Fijos'),
    pct_savings: pctField('Ahorros'),
}).refine(
    (data) => Math.abs(data.pct_merchandise + data.pct_fixed_expenses + data.pct_savings - 1) < 0.001,
    {
        message: 'Los porcentajes de distribución deben sumar exactamente el 100% (1.00)',
        path: ['pct_merchandise'],
    }
);

const createEmployeeSchema = z.object({
    username: z.string()
        .min(6, 'El usuario debe tener al menos 6 caracteres')
        .max(20, 'El usuario no puede tener más de 20 caracteres'),
    password: z.string().min(8, 'La contraseña debe tener al menos 8 caracteres'),
    first_name: z.string()
        .min(2, 'El nombre debe tener al menos 2 caracteres')
        .max(50, 'El nombre no puede tener más de 50 caracteres'),
    last_name: z.string()
        .min(2, 'El apellido debe tener al menos 2 caracteres')
        .max(50, 'El apellido no puede tener más de 50 caracteres'),
    hourly_rate: z.number().nonnegative('La tarifa por hora debe ser mayor o igual a 0'),
    salary_type: z.enum(['hourly', 'fixed'], { errorMap: () => ({ message: 'Tipo de salario inválido' }) }),
    monthly_salary: z.number().nonnegative('El salario mensual debe ser mayor o igual a 0').nullable().optional(),
    email: z.string().email('Debe ingresar un email válido').max(255).nullable().optional(),
    role: z.enum(['EMPLOYEE', 'MANAGER'], { errorMap: () => ({ message: 'Rol inválido' }) }).optional()
});

const updatePermissionsSchema = z.object({
    canRegisterClosures: z.boolean(),
    canRegisterExpenses: z.boolean(),
    canPayExpenses: z.boolean(),
    canManageProviders: z.boolean()
});

const updateProfileSchema = z.object({
    hourly_rate: z.number().nonnegative('La tarifa por hora debe ser mayor o igual a 0'),
    salary_type: z.enum(['hourly', 'fixed']),
    monthly_salary: z.number().nonnegative('El salario mensual debe ser mayor o igual a 0').nullable().optional()
});

const createAttendanceSchema = z.object({
    employeeId: z.number().int().positive('ID de empleado inválido'),
    checkIn: z.coerce.date(),
    checkOut: z.coerce.date()
});

const updateAttendanceSchema = z.object({
    checkIn: z.coerce.date(),
    checkOut: z.coerce.date()
});

const liquidatePayrollSchema = z.object({
    employeeId: z.number().int().positive('ID de empleado inválido'),
    from: z.coerce.date(),
    to: z.coerce.date(),
    providerId: z.number().int().positive('ID de proveedor inválido'),
    accountId: z.number().int().positive('ID de cuenta física inválido'),
    budgetCategory: z.enum(budgetCategoryValues, {
        errorMap: () => ({ message: 'Categoría de presupuesto no válida' }),
    }).optional().default(BUDGET_CATEGORIES.FIXED_EXPENSES)
});

const resetPasswordSchema = z.object({
    token: z.string()
        .min(1, 'El token de recuperación es requerido'),
    newPassword: z.string()
        .min(8, 'La nueva contraseña debe tener al menos 8 caracteres'),
});

const changePasswordSchema = z.object({
    currentPassword: z.string()
        .min(1, 'La contraseña actual es requerida'),
    newPassword: z.string()
        .min(8, 'La nueva contraseña debe tener al menos 8 caracteres'),
}).refine((data) => data.newPassword !== data.currentPassword, {
    message: 'La nueva contraseña debe ser diferente a la contraseña actual',
    path: ['newPassword'],
});

const validate = (schema) => (req, res, next) => {
    const result = schema.safeParse(req.body);
    if (!result.success) {
        return next(result.error);
    }
    req.body = result.data;
    next();
};

const refreshTokenSchema = z.object({
    refreshToken: z.string()
        .min(10, 'Refresh token inválido')
        .describe('Token de renovación JWT')
});

module.exports = {
    registerSchema,
    loginSchema,
    dailyClosureSchema,
    providerSchema,
    expensesSchema,
    updatePercentagesSchema,
    validate,
    createEmployeeSchema,
    updatePermissionsSchema,
    updateProfileSchema,
    createAttendanceSchema,
    updateAttendanceSchema,
    liquidatePayrollSchema,
    refreshTokenSchema,

    resetPasswordSchema,
    changePasswordSchema
};