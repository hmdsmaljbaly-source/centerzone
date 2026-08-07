const express = require('express');
const router = express.Router();
const authMiddleware = require('../middleware/auth.middleware');
const tenantMiddleware = require('../middleware/tenant.middleware');
const hallController = require('../controllers/hall.controller');

router.use(tenantMiddleware);
router.use(authMiddleware);

router.get('/', hallController.getHalls);
router.post('/', hallController.createHall);

module.exports = router;
