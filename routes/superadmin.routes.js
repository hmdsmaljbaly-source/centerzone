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
router.get('/centers/:id', superadminController.getCenterById);
router.put('/centers/:id/subscription', superadminController.updateCenterSubscription);
router.patch('/centers/:idOrCode/status', superadminController.toggleCenterStatus);
router.put('/centers/:idOrCode/password', superadminController.changeCenterPassword);
router.delete('/centers/:idOrCode', superadminController.deleteCenter);
router.put('/profile', superadminController.updateProfile);
router.post('/centers/:id/prepaid-cards', superadminController.generatePrepaidCards);
router.get('/centers/:id/prepaid-cards', superadminController.getPrepaidCards);
router.post('/generate-codes', superadminController.generatePrepaidCodes);

module.exports = router;
