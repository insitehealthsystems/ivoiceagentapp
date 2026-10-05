export interface Session {
  id: string;
  /** Chains Foundry Responses API turns together; undefined = fresh conversation. */
  previousResponseId?: string;
  /** Short-term conversational reference location (see conversation.service.ts). Never resolved to a zone here -- the agent owns that. */
  locationContext?: string;
  createdAt: number;
  lastActivityAt: number;
}

export interface ConversationRequestBody {
  sessionId: string;
  message: string;
}

export interface AssetSummary {
  asset_id?: string;
  asset_type?: string;
  status?: string;
  confidence?: number;
  zone_name?: string;
  floor?: number;
  last_seen?: string;
  [key: string]: unknown;
}

export interface ConversationResponseBody {
  sessionId: string;
  message: string;
  /** Heuristic only (does the reply look like a question?) -- never a business-logic judgment about asset search. */
  requiresFollowUp: boolean;
  assets?: AssetSummary[];
}
