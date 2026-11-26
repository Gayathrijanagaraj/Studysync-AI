const express = require('express');
const router = express.Router();
const knowledgeController = require('../controllers/knowledgeController');
const { ensureAuth } = require('../middleware/authMiddleware');

// All knowledge endpoints require authenticated session
router.use(ensureAuth);

router.get('/', knowledgeController.getItems);
router.post('/', knowledgeController.createItem);
router.get('/export', knowledgeController.exportStudySheet);
router.get('/:id', knowledgeController.getItemById);
router.put('/:id', knowledgeController.updateItem);
router.patch('/:id/pin', knowledgeController.togglePin);
router.delete('/:id', knowledgeController.deleteItem);

module.exports = router;
