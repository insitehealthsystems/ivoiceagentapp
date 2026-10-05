/**
 * Small dependency registry: constructs the service singletons once at
 * startup and makes them available to controllers via the Express app
 * instance, avoiding either global mutable module state or a heavier DI
 * framework for a prototype this size.
 */
import type { Express, Request } from 'express';
import type { AppConfig } from '../config/environment.js';
import { ConversationService } from './conversation.service.js';
import { FoundryService } from './foundry.service.js';
import { SpeechService } from './speech.service.js';

export interface Services {
  config: AppConfig;
  conversationService: ConversationService;
  foundryService: FoundryService;
  speechService: SpeechService;
}

const SERVICES_KEY = 'services';

export function attachServices(app: Express, config: AppConfig): Services {
  const services: Services = {
    config,
    conversationService: new ConversationService(),
    foundryService: new FoundryService(config),
    speechService: new SpeechService(config),
  };
  app.set(SERVICES_KEY, services);
  return services;
}

export function getServices(req: Request): Services {
  return req.app.get(SERVICES_KEY) as Services;
}
