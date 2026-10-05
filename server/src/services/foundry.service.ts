/**
 * Client for the iLocate agent hosted in Microsoft Foundry.
 *
 * The deployed iLocate agent is a Foundry *declarative* agent published on
 * the Responses protocol (not the older Assistants-style threads/runs/
 * messages model) -- confirmed against the live resource during
 * development. Conversing with it goes through an OpenAI-compatible client
 * scoped to that agent's endpoint, authenticated with an Azure AD bearer
 * token (scope `https://ai.azure.com/.default`) obtained via
 * DefaultAzureCredential. Multi-turn context is carried by the Responses
 * API's own `previous_response_id` chaining -- this service holds no
 * conversation state itself; that lives in conversation.service.ts.
 *
 * Per the design's production-migration principle, the agent owns all
 * intent recognition, asset-search reasoning, File Search, and
 * natural-language generation. This service never inspects or interprets
 * the iLocate data -- it only relays messages to/from the configured agent.
 */
import { DefaultAzureCredential } from '@azure/identity';
import OpenAI, { APIConnectionTimeoutError, APIError } from 'openai';
import type { ResponseCreateParamsNonStreaming } from 'openai/resources/responses/responses';
import type { AppConfig } from '../config/environment.js';
import { Errors } from '../models/errors.js';
import { logger } from '../config/logger.js';

const FOUNDRY_TOKEN_SCOPE = 'https://ai.azure.com/.default';
const TOKEN_REFRESH_SKEW_MS = 60_000;

export interface FoundryReply {
  text: string;
  responseId: string;
}

export class FoundryService {
  private readonly credential = new DefaultAzureCredential();
  private client: OpenAI | undefined;
  private tokenExpiresOnMs = 0;

  constructor(private readonly config: AppConfig) {}

  private async getClient(): Promise<OpenAI> {
    const now = Date.now();
    if (this.client && now < this.tokenExpiresOnMs - TOKEN_REFRESH_SKEW_MS) {
      return this.client;
    }

    const token = await this.credential.getToken(FOUNDRY_TOKEN_SCOPE);
    if (!token) {
      throw Errors.foundryUnavailable();
    }
    this.tokenExpiresOnMs = token.expiresOnTimestamp;

    const baseURL = `${this.config.foundryEndpoint.replace(/\/+$/, '')}/agents/${this.config.foundryAgentName}/endpoint/protocols/openai`;
    this.client = new OpenAI({
      apiKey: token.token,
      baseURL,
      defaultQuery: { 'api-version': 'v1' },
    });
    return this.client;
  }

  async sendMessage(
    input: string,
    previousResponseId: string | undefined,
    metadata: Record<string, string> | undefined,
  ): Promise<FoundryReply> {
    const client = await this.getClient();

    try {
      // The Foundry agent's own OpenAI-compatible endpoint is scoped to one
      // agent by the base URL and ignores `model` -- but the openai SDK's
      // TypeScript types assume direct OpenAI platform usage and require
      // it. The value below is never actually used by the service.
      const params = {
        input,
        ...(previousResponseId ? { previous_response_id: previousResponseId } : {}),
        ...(metadata && Object.keys(metadata).length > 0 ? { metadata } : {}),
      } as unknown as ResponseCreateParamsNonStreaming;

      const response = await client.responses.create(params, { timeout: this.config.requestTimeoutMs });

      const text = (response.output_text ?? '').trim();
      if (!text) {
        throw Errors.internal('Foundry agent returned no response text.');
      }
      return { text, responseId: response.id };
    } catch (err) {
      if (err instanceof APIConnectionTimeoutError) {
        throw Errors.timeout();
      }
      if (err instanceof APIError) {
        logger.error('Foundry request failed', { error: err.message, status: err.status });
        throw Errors.foundryUnavailable();
      }
      throw err;
    }
  }
}
