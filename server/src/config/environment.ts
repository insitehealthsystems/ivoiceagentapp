/**
 * Loads and validates configuration from environment variables. No
 * credentials or deployment-specific values are hard-coded anywhere else
 * in the server.
 */
import 'dotenv/config';

export class ConfigurationError extends Error {}

function requireEnv(name: string): string {
  const value = process.env[name];
  if (!value) {
    throw new ConfigurationError(`Required environment variable '${name}' is not set.`);
  }
  return value;
}

function optionalEnv(name: string, fallback: string): string {
  const value = process.env[name];
  return value && value.length > 0 ? value : fallback;
}

function optionalNumber(name: string, fallback: number): number {
  const value = process.env[name];
  if (!value) return fallback;
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : fallback;
}

export interface AppConfig {
  port: number;
  clientOrigin: string;
  logLevel: string;

  foundryEndpoint: string;
  foundryAgentName: string;

  speechKey: string;
  speechRegion: string;
  speechVoice: string;

  requestTimeoutMs: number;
  rateLimitWindowMs: number;
  rateLimitMax: number;
}

export function loadConfig(): AppConfig {
  return {
    port: optionalNumber('PORT', 3001),
    clientOrigin: optionalEnv('CLIENT_ORIGIN', 'http://localhost:5173'),
    logLevel: optionalEnv('LOG_LEVEL', 'info').toLowerCase(),

    foundryEndpoint: requireEnv('AZURE_FOUNDRY_ENDPOINT'),
    // NOTE: the spec's env var name is AZURE_FOUNDRY_AGENT_ID, but the
    // deployed iLocate agent is a Foundry declarative agent on the
    // Responses protocol, addressed by NAME (not a classic "asst_" id) --
    // confirmed against the live resource. See README "Foundry
    // integration" section.
    foundryAgentName: requireEnv('AZURE_FOUNDRY_AGENT_NAME'),

    speechKey: requireEnv('AZURE_SPEECH_KEY'),
    speechRegion: requireEnv('AZURE_SPEECH_REGION'),
    speechVoice: optionalEnv('AZURE_SPEECH_VOICE', 'en-US-JennyNeural'),

    requestTimeoutMs: optionalNumber('REQUEST_TIMEOUT_MS', 30_000),
    rateLimitWindowMs: optionalNumber('RATE_LIMIT_WINDOW_MS', 60_000),
    rateLimitMax: optionalNumber('RATE_LIMIT_MAX', 120),
  };
}
