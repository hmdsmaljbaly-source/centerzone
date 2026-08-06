const express = require('express');
const router = express.Router();
const authMiddleware = require('../middleware/auth.middleware');
const tenantMiddleware = require('../middleware/tenant.middleware');
const attendanceController = require('../controllers/attendance.controller');

router.use(tenantMiddleware);
router.use(authMiddleware);

router.post('/scan', attendanceController.scanBarcode);
router.get('/groups/:groupId', attendanceController.getGroupAttendanceStats);
router.get('/assessments/group/:groupId', attendanceController.getAssessmentsByGroup);
router.post('/assessments', attendanceController.createAssessment);
router.post('/assessments/:id/grades', attendanceController.submitGrades);
router.post('/assessments/:id/grades/bulk', attendanceController.submitGradesBulk);

module.exports = router;
