const express = require('express');
const router = express.Router();
const authMiddleware = require('../middleware/auth.middleware');
const tenantMiddleware = require('../middleware/tenant.middleware');
const rbacMiddleware = require('../middleware/rbac.middleware');
const financialsController = require('../controllers/financials.controller');

router.use(tenantMiddleware);
router.use(authMiddleware);

router.post('/closing', rbacMiddleware(['CENTER_ADMIN']), financialsController.executeShiftClosing);
router.get('/summary', financialsController.getFinancialSummary);

module.exports = router;
