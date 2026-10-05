import type { NextFunction, Request, Response } from 'express';
import type { ConversationRequestBody, ConversationResponseBody } from '../models/conversation.js';
import { Errors } from '../models/errors.js';
import { getServices } from '../services/registry.js';
import { logger } from '../config/logger.js';

const MAX_MESSAGE_LENGTH = 1000;

export async function createSession(req: Request, res: Response): Promise<void> {
  const { conversationService } = getServices(req);
  const session = conversationService.createSession();
  logger.info('Session created', { requestId: req.id, sessionId: session.id });
  res.status(201).json({ sessionId: session.id });
}

export function deleteSession(req: Request, res: Response): void {
  const { conversationService } = getServices(req);
  conversationService.deleteSession(req.params.sessionId);
  logger.info('Session deleted', { requestId: req.id, sessionId: req.params.sessionId });
  res.status(204).send();
}

export async function postConversation(req: Request, res: Response, next: NextFunction): Promise<void> {
  const { conversationService, foundryService } = getServices(req);
  const body = req.body as Partial<ConversationRequestBody>;

  try {
    if (typeof body.message !== 'string' || body.message.trim().length === 0) {
      throw Errors.validation('message is required.');
    }
    if (body.message.length > MAX_MESSAGE_LENGTH) {
      throw Errors.validation(`message must be ${MAX_MESSAGE_LENGTH} characters or fewer.`);
    }

    const session = conversationService.requireSession(body.sessionId);
    const message = body.message.trim();
    const metadata = conversationService.locationMetadata(session);

    const startedAt = process.hrtime.bigint();
    const reply = await foundryService.sendMessage(message, session.previousResponseId, metadata);
    const durationMs = Math.round(Number(process.hrtime.bigint() - startedAt) / 1e6);

    conversationService.recordTurn(session, message, reply.responseId);

    logger.info('Foundry turn completed', {
      requestId: req.id,
      sessionId: session.id,
      durationMs,
    });

    const response: ConversationResponseBody = {
      sessionId: session.id,
      message: reply.text,
      // Heuristic, not a business-logic judgment: does the reply read as a question?
      requiresFollowUp: reply.text.trim().endsWith('?'),
    };
    res.status(200).json(response);
  } catch (err) {
    next(err);
  }
}
