const attendanceService = require('../services/attendance.service');

const createAttendance = async (req, res, next) => {
    try {
        const { employeeId, checkIn, checkOut } = req.body;
        const log = await attendanceService.registerAttendance(employeeId, checkIn, checkOut);
        return res.status(201).json({ success: true, data: log });
    } catch (error) {
        next(error);
    }
}

const getAllAttendance = async (req, res, next) => {
    try {
        const { employeeId, from, to } = req.query;
        const logs = await attendanceService.getAttendanceLogs({ employeeId, from, to });
        return res.json({ success: true, data: logs });
    } catch (error) {
        next(error);
    }
}

const getMyAttendance = async (req, res, next) => {
    try {
        const { from, to } = req.query;
        const logs = await attendanceService.getAttendanceLogs({ employeeId: req.user.id, from, to });
        return res.json({ success: true, data: logs });
    } catch (error) {
        next(error);
    }
}

const getSummary = async (req, res, next) => {
    try {
        const { from, to, employeeId } = req.query;
        const summary = await attendanceService.getSummaryForPeriod(from, to, employeeId);
        return res.json({ success: true, data: summary });
    } catch (error) {
        next(error);
    }
}

const updateAttendance = async (req, res, next) => {
    try {
        const { id } = req.params;
        const { checkIn, checkOut } = req.body;

        const updatedLog = await attendanceService.updateAttendance(parseInt(id), checkIn, checkOut);

        return res.json({ success: true, data: updatedLog });
    } catch (error) {
        next(error);
    }
}

const removeAttendance = async (req, res, next) => {
    try {
        const { id } = req.params;
        await attendanceService.deleteAttendance(parseInt(id));
        return res.json({ success: true, message: 'Registro de asistencia eliminado correctamente' });
    } catch (error) {
        next(error);
    }
}

const liquidatePayroll = async (req, res, next) => {
    try {
        const { employeeId, from, to, providerId, accountId, budgetCategory, discountAmount } = req.body;

        const expense = await attendanceService.processPayrollToExpenses({
            employeeId,
            from,
            to,
            providerId,
            accountId,
            budgetCategory,
            adminUserId: req.user.id,
            discountAmount
        });

        return res.status(201).json({
            success: true,
            message: 'Liquidación procesada y enviada a egresos pendientes con éxito',
            data: expense
        });
    } catch (error) {
        next(error);
    }
}

const checkIn = async (req, res, next) => {
    try {
        const log = await attendanceService.employeeCheckIn(req.user.id);
        return res.status(201).json({ success: true, message: 'Entrada registrada con éxito', data: log });
    } catch (error) {
        next(error);
    }
}

const checkOut = async (req, res, next) => {
    try {
        const log = await attendanceService.employeeCheckOut(req.user.id);
        return res.json({ success: true, message: 'Salida registrada con éxito', data: log });
    } catch (error) {
        next(error);
    }
}

const getStatus = async (req, res, next) => {
    try {
        const status = await attendanceService.getEmployeeStatus(req.user.id);
        return res.json({ success: true, data: status });
    } catch (error) {
        next(error);
    }
}

module.exports = {
    createAttendance,
    getAllAttendance,
    getMyAttendance,
    getSummary,
    updateAttendance,
    removeAttendance,
    liquidatePayroll,
    checkIn,
    checkOut,
    getStatus
};