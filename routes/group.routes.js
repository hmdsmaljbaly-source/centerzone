const express = require('express');
const router = express.Router();
const authMiddleware = require('../middleware/auth.middleware');
const tenantMiddleware = require('../middleware/tenant.middleware');
const groupController = require('../controllers/group.controller');

router.use(tenantMiddleware);
router.use(authMiddleware);

router.get('/', groupController.getGroups);
router.get('/today', groupController.getTodayGroups);
router.get('/:id', groupController.getGroupById);

module.exports = router;
