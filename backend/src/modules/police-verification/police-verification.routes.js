const router = require('express').Router();
const { authenticate } = require('../../middleware/authenticate');
const upload = require('../../middleware/upload');
const controller = require('./police-verification.controller');

router.use(authenticate);

router.get('/', controller.getStatus);
router.post('/upload/:type', upload.single('document'), controller.uploadDocument);
router.post('/submit', controller.submit);

module.exports = router;
