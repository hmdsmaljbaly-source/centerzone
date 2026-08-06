const express = require('express');
const router = express.Router();
const authMiddleware = require('../middleware/auth.middleware');
const rbacMiddleware = require('../middleware/rbac.middleware');
const superadminController = require('../controllers/superadmin.controller');

// Some routes might not need tenantMiddleware because Super Admin manages centers globally
router.post('/login', superadminController.login);

router.use(authMiddleware);
router.use(rbacMiddleware(['SUPER_ADMIN']));

router.get('/centers', superadminController.getCenters);
router.post('/centers', superadminController.createCenter);
router.post('/centers/:id/prepaid-cards', superadminController.generatePrepaidCards);

module.exports = router;
