const express = require('express');
const router = express.Router();
const authMiddleware = require('../middleware/auth.middleware');
const tenantMiddleware = require('../middleware/tenant.middleware');
const teacherController = require('../controllers/teacher.controller');

router.use(tenantMiddleware);
router.use(authMiddleware);

router.get('/', teacherController.getTeachers);

module.exports = router;
