const express = require('express');
const router = express.Router();
const authMiddleware = require('../middleware/auth.middleware');
const tenantMiddleware = require('../middleware/tenant.middleware');
const posController = require('../controllers/pos.controller');

router.use(tenantMiddleware);
router.use(authMiddleware);

router.post('/sell', posController.executeCheckout);
router.get('/audit', posController.getAuditTrail);

module.exports = router;
