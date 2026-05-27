const express = require('express');
const { authenticate } = require('../auth/auth.middleware');
const { requireActiveAccount } = require('../../middleware/accountStatus');
const controller = require('./location.controller');

const router = express.Router();

router.use(authenticate);

router.post('/', requireActiveAccount, controller.save);
router.get('/last', controller.getLast);

module.exports = router;
