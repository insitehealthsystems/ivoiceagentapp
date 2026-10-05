/**
 * The ONLY module that talks to the Express backend. No Azure
 * credentials, Foundry secrets, or Speech keys exist anywhere in this
 * client -- every sensitive call happens server-side; this just issues
 * plain HTTPS requests to our own API.
 */
import { config } from '../config/config';
import { ApiRequestError, type ApiErrorBody, type ConversationResponseBody, type CreateSessionResponse } from '../types/api';

async function parseErrorBody(response: Response): Promise<ApiErrorBody | null> {
  try {
    return (await response.json()) as ApiErrorBody;
  } catch {
    return null;
  }
}

async function requestJson<T>(path: string, init: RequestInit): Promise<T> {
  let response: Response;
  try {
    response = await fetch(`${config.apiBaseUrl}${path}`, init);
  } catch (networkErr) {
    throw new ApiRequestError(0, 'NETWORK_ERROR', 'Unable to connect to iLocate. Check your connection and try again.');
  }

  if (!response.ok) {
    const body = await parseErrorBody(response);
    throw new ApiRequestError(response.status, body?.error ?? 'UNKNOWN_ERROR', body?.message ?? 'Something went wrong. Please try again.');
  }

  if (response.status === 204) {
    return undefined as T;
  }
  return (await response.json()) as T;
}

export function createSession(): Promise<CreateSessionResponse> {
  return requestJson<CreateSessionResponse>('/session', { method: 'POST' });
}

export function deleteSession(sessionId: string): Promise<void> {
  return requestJson<void>(`/session/${encodeURIComponent(sessionId)}`, { method: 'DELETE' });
}

export function sendMessage(sessionId: string, message: string): Promise<ConversationResponseBody> {
  return requestJson<ConversationResponseBody>('/conversation', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ sessionId, message }),
  });
}

export async function transcribeAudio(blob: Blob): Promise<{ text: string }> {
  return requestJson<{ text: string }>('/speech/transcribe', {
    method: 'POST',
    headers: { 'Content-Type': 'audio/webm' },
    body: blob,
  });
}

/** Maps a caught error to one of the exact user-facing messages from spec section 41. */
export function describeError(err: unknown): string {
  if (err instanceof ApiRequestError) {
    switch (err.code) {
      case 'NETWORK_ERROR':
        return 'Unable to connect to iLocate. Check your connection and try again.';
      case 'SPEECH_NOT_RECOGNIZED':
        return "I didn't catch that. Please try again.";
      case 'SPEECH_SERVICE_ERROR':
        return 'There was a problem with speech recognition. Please try again.';
      case 'FOUNDRY_UNAVAILABLE':
        return 'iLocate is temporarily unavailable. Please try again.';
      case 'TIMEOUT':
        return 'The request took too long. Please try again.';
      case 'VALIDATION_ERROR':
        return err.message;
      default:
        return 'Something went wrong. Please try again.';
    }
  }
  return 'Something went wrong. Please try again.';
}

export async function synthesizeSpeech(text: string): Promise<Blob> {
  const response = await fetch(`${config.apiBaseUrl}/speech/synthesize`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ text }),
  });
  if (!response.ok) {
    const body = await parseErrorBody(response);
    throw new ApiRequestError(response.status, body?.error ?? 'UNKNOWN_ERROR', body?.message ?? 'Something went wrong. Please try again.');
  }
  return await response.blob();
}
