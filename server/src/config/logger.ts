/**
 * Minimal structured JSON logger -- one JSON object per line on
 * stdout/stderr. Never pass credentials, API keys, or access tokens as
 * meta fields.
 */
const LEVELS: Record<string, number> = { error: 0, warn: 1, info: 2, debug: 3 };

function currentLevel(): number {
  const configured = (process.env.LOG_LEVEL || 'info').toLowerCase();
  return LEVELS[configured] ?? LEVELS.info;
}

type Meta = Record<string, unknown>;

function write(level: keyof typeof LEVELS, message: string, meta?: Meta): void {
  if (LEVELS[level] > currentLevel()) return;
  const entry = { timestamp: new Date().toISOString(), level, message, ...meta };
  const line = JSON.stringify(entry);
  if (level === 'error') process.stderr.write(line + '\n');
  else process.stdout.write(line + '\n');
}

export const logger = {
  error: (message: string, meta?: Meta) => write('error', message, meta),
  warn: (message: string, meta?: Meta) => write('warn', message, meta),
  info: (message: string, meta?: Meta) => write('info', message, meta),
  debug: (message: string, meta?: Meta) => write('debug', message, meta),
};
