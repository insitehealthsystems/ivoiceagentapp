import type { NextFunction, Request, Response } from 'express';
import { Errors } from '../models/errors.js';
import { getServices } from '../services/registry.js';

const MAX_SYNTHESIS_TEXT_LENGTH = 2000;

export async function transcribe(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const { speechService } = getServices(req);
    const audio = req.body as Buffer;

    if (!Buffer.isBuffer(audio) || audio.length === 0) {
      throw Errors.validation('Request body must be a non-empty audio clip.');
    }

    const result = await speechService.transcribe(audio);
    if (result.noSpeech) {
      throw Errors.speechNotRecognized();
    }
    res.status(200).json({ text: result.text });
  } catch (err) {
    next(err);
  }
}

export async function synthesize(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const { speechService } = getServices(req);
    const { text } = req.body as { text?: unknown };

    if (typeof text !== 'string' || text.trim().length === 0) {
      throw Errors.validation('text is required.');
    }
    if (text.length > MAX_SYNTHESIS_TEXT_LENGTH) {
      throw Errors.validation(`text must be ${MAX_SYNTHESIS_TEXT_LENGTH} characters or fewer.`);
    }

    const audio = await speechService.synthesize(text.trim());
    res.status(200).set('Content-Type', 'audio/mpeg').send(audio);
  } catch (err) {
    next(err);
  }
}
