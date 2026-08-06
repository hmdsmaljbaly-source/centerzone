const express = require('express');
const router = express.Router();
const authMiddleware = require('../middleware/auth.middleware');
const tenantMiddleware = require('../middleware/tenant.middleware');
const studentController = require('../controllers/student.controller');

router.use(tenantMiddleware);
router.use(authMiddleware);

router.post('/', studentController.registerStudent);
router.get('/', studentController.getStudents);
router.get('/:id/profile', studentController.getStudentProfile);
router.post('/:id/pay', studentController.payFees);

module.exports = router;
