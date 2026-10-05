import { createApp } from './app.js';
import { loadConfig, ConfigurationError } from './config/environment.js';
import { logger } from './config/logger.js';

function main(): void {
  let config;
  try {
    config = loadConfig();
  } catch (err) {
    if (err instanceof ConfigurationError) {
      console.error(`Configuration error: ${err.message}`);
      process.exit(1);
    }
    throw err;
  }

  logger.info('iLocate Voice Client API starting up');

  const app = createApp(config);
  const server = app.listen(config.port, () => {
    logger.info('iLocate Voice Client API listening', { port: config.port });
  });

  let shuttingDown = false;
  function shutdown(signal: string): void {
    if (shuttingDown) return;
    shuttingDown = true;
    logger.info('Shutdown signal received', { signal });
    server.close(() => {
      logger.info('iLocate Voice Client API shut down');
      process.exit(0);
    });
    setTimeout(() => process.exit(1), 10_000).unref();
  }

  process.on('SIGINT', () => shutdown('SIGINT'));
  process.on('SIGTERM', () => shutdown('SIGTERM'));
  process.on('unhandledRejection', (reason) => {
    logger.error('Unhandled promise rejection', { error: reason instanceof Error ? reason.message : String(reason) });
  });
  process.on('uncaughtException', (err) => {
    logger.error('Uncaught exception', { error: err.message, stack: err.stack });
    process.exit(1);
  });
}

main();
