import express from 'express';
import * as chatBotController from '../controllers/chatbotController.js';

const router = express.Router();
router.post('/message', chatBotController.handlemessage);

export default router;