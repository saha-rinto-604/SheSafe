const express = require('express');
const { authenticate } = require('../../middleware/authenticate');
const incidentController = require('../incidents/incident.controller');

const router = express.Router();

router.use(authenticate);

router.get('/incidents/chats', incidentController.userChats);

module.exports = router;
