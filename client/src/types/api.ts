import type { AssetSummary } from './conversation';

export interface CreateSessionResponse {
  sessionId: string;
}

export interface ConversationRequestBody {
  sessionId: string;
  message: string;
}

export interface ConversationResponseBody {
  sessionId: string;
  message: string;
  requiresFollowUp: boolean;
  assets?: AssetSummary[];
}

export interface ApiErrorBody {
  success: false;
  error: string;
  message: string;
  requestId?: string;
}

export class ApiRequestError extends Error {
  readonly code: string;
  readonly status: number;

  constructor(status: number, code: string, message: string) {
    super(message);
    this.name = 'ApiRequestError';
    this.status = status;
    this.code = code;
  }
}
