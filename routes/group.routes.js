const express = require('express');
const router = express.Router();
const authMiddleware = require('../middleware/auth.middleware');
const tenantMiddleware = require('../middleware/tenant.middleware');
const groupController = require('../controllers/group.controller');

router.use(tenantMiddleware);
router.use(authMiddleware);

router.get('/', groupController.getGroups);
router.post('/', groupController.createGroup);
router.get('/today', groupController.getTodayGroups);
router.get('/:id', groupController.getGroupById);
router.put('/:id', groupController.updateGroup);
router.get('/:id/students', groupController.getGroupStudents);

module.exports = router;
