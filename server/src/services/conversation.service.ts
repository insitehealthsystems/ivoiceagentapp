/**
 * In-memory session store and short-term conversational location context.
 *
 * This is deliberately simple for the prototype (no Redis/DB) -- sessions
 * are per-process and lost on restart, which is acceptable for a demo.
 *
 * Location handling here only ever extracts and remembers *that the user
 * mentioned a location and what text they used*. It never resolves that
 * text against hospital zones, never scores proximity, and never decides
 * which assets qualify -- all of that is the Foundry agent's job (spec
 * sections 12-17). The extracted phrase is attached to outgoing Foundry
 * messages as metadata; the agent decides whether/how to use it.
 */
import crypto from 'node:crypto';
import type { Session } from '../models/conversation.js';
import { Errors } from '../models/errors.js';

const SESSION_TTL_MS = 2 * 60 * 60 * 1000; // 2 hours of inactivity

const LOCATION_PATTERNS = [
  /\bi'?m\s+(?:currently\s+)?(?:at|in|near)\s+(.+)/i,
  /\bi\s+am\s+(?:currently\s+)?(?:at|in|near)\s+(.+)/i,
  /\bwe'?re\s+(?:at|in|near)\s+(.+)/i,
];
const TRAILING_NOISE = /\s*(now|right now|currently)\.?\s*$/i;

function extractLocationPhrase(text: string): string | undefined {
  for (const pattern of LOCATION_PATTERNS) {
    const match = pattern.exec(text);
    if (match) {
      const phrase = match[1].replace(TRAILING_NOISE, '').trim().replace(/\.$/, '');
      if (phrase) return phrase;
    }
  }
  return undefined;
}

export class ConversationService {
  private readonly sessions = new Map<string, Session>();

  createSession(): Session {
    const now = Date.now();
    const session: Session = { id: crypto.randomUUID(), createdAt: now, lastActivityAt: now };
    this.sessions.set(session.id, session);
    return session;
  }

  /** Looks up a session, lazily recreating it if unknown (e.g. after a server restart) so the client never has to reload. */
  getOrCreateSession(sessionId: string): Session {
    this.pruneExpired();
    const existing = this.sessions.get(sessionId);
    if (existing) {
      existing.lastActivityAt = Date.now();
      return existing;
    }
    const now = Date.now();
    const session: Session = { id: sessionId, createdAt: now, lastActivityAt: now };
    this.sessions.set(sessionId, session);
    return session;
  }

  deleteSession(sessionId: string): boolean {
    return this.sessions.delete(sessionId);
  }

  recordTurn(session: Session, userMessage: string, responseId: string): void {
    const phrase = extractLocationPhrase(userMessage);
    if (phrase) {
      session.locationContext = phrase;
    }
    session.previousResponseId = responseId;
    session.lastActivityAt = Date.now();
  }

  locationMetadata(session: Session): Record<string, string> | undefined {
    return session.locationContext ? { session_reference_location: session.locationContext } : undefined;
  }

  requireSession(sessionId: string | undefined): Session {
    if (!sessionId || typeof sessionId !== 'string') {
      throw Errors.validation('sessionId is required.');
    }
    return this.getOrCreateSession(sessionId);
  }

  private pruneExpired(): void {
    const now = Date.now();
    for (const [id, session] of this.sessions) {
      if (now - session.lastActivityAt > SESSION_TTL_MS) {
        this.sessions.delete(id);
      }
    }
  }
}
