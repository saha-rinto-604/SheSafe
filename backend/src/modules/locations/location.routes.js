const express = require('express');
const { authenticate } = require('../auth/auth.middleware');
const controller = require('./location.controller');

const router = express.Router();

router.use(authenticate);

router.post('/', controller.save);
router.get('/last', controller.getLast);

module.exports = router;
