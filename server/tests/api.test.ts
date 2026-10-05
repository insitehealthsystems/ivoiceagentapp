import { test } from 'node:test';
import assert from 'node:assert/strict';
import request from 'supertest';

import { createApp } from '../src/app.js';
import type { AppConfig } from '../src/config/environment.js';

// A fake config -- no real Azure credentials or network calls are needed
// for the paths covered here (health, session lifecycle, validation,
// 404). The live Foundry/Speech integration is exercised manually against
// the real resources (see README).
const testConfig: AppConfig = {
  port: 0,
  clientOrigin: 'http://localhost:5173',
  logLevel: 'error',
  foundryEndpoint: 'https://example-foundry.invalid/api/projects/test',
  foundryAgentName: 'test-agent',
  speechKey: 'test-key',
  speechRegion: 'eastus',
  speechVoice: 'en-US-JennyNeural',
  requestTimeoutMs: 5000,
  rateLimitWindowMs: 60_000,
  rateLimitMax: 1000,
};

const app = createApp(testConfig);

test('GET /api/health reports ok', async () => {
  const res = await request(app).get('/api/health');
  assert.equal(res.status, 200);
  assert.deepEqual(res.body, { status: 'ok', service: 'ilocate-voice-client-api' });
});

test('POST /api/session creates a session, DELETE removes it', async () => {
  const created = await request(app).post('/api/session');
  assert.equal(created.status, 201);
  assert.equal(typeof created.body.sessionId, 'string');

  const deleted = await request(app).delete(`/api/session/${created.body.sessionId}`);
  assert.equal(deleted.status, 204);
});

test('POST /api/conversation without a message is rejected with 400', async () => {
  const session = await request(app).post('/api/session');
  const res = await request(app)
    .post('/api/conversation')
    .send({ sessionId: session.body.sessionId });
  assert.equal(res.status, 400);
  assert.equal(res.body.error, 'VALIDATION_ERROR');
});

test('POST /api/conversation without a sessionId is rejected with 400', async () => {
  const res = await request(app).post('/api/conversation').send({ message: 'hello' });
  assert.equal(res.status, 400);
  assert.equal(res.body.error, 'VALIDATION_ERROR');
});

test('POST /api/speech/synthesize without text is rejected with 400', async () => {
  const res = await request(app).post('/api/speech/synthesize').send({});
  assert.equal(res.status, 400);
  assert.equal(res.body.error, 'VALIDATION_ERROR');
});

test('malformed JSON body is rejected with 400, not a stack trace', async () => {
  const res = await request(app)
    .post('/api/conversation')
    .set('Content-Type', 'application/json')
    .send('{ not valid json');
  assert.equal(res.status, 400);
  assert.ok(!('stack' in res.body));
});

test('unknown routes return 404', async () => {
  const res = await request(app).get('/api/does-not-exist');
  assert.equal(res.status, 404);
  assert.equal(res.body.error, 'NOT_FOUND');
});

test('a caller-supplied X-Request-ID is echoed back for correlation', async () => {
  const res = await request(app).get('/api/health').set('X-Request-ID', 'test-correlation-123');
  assert.equal(res.headers['x-request-id'], 'test-correlation-123');
});
