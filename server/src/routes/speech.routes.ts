import { Router, raw } from 'express';
import { synthesize, transcribe } from '../controllers/speech.controller.js';

export const speechRouter = Router();

// Raw binary audio body, scoped to this one route -- the rest of the API
// uses JSON (parsed globally in app.ts).
speechRouter.post('/speech/transcribe', raw({ type: 'audio/webm', limit: '10mb' }), transcribe);
speechRouter.post('/speech/synthesize', synthesize);
