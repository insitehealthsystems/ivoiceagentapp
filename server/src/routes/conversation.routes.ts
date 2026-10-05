import { Router } from 'express';
import { createSession, deleteSession, postConversation } from '../controllers/conversation.controller.js';

export const conversationRouter = Router();

conversationRouter.post('/conversation', postConversation);
conversationRouter.post('/session', createSession);
conversationRouter.delete('/session/:sessionId', deleteSession);
