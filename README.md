# iLocate Voice Client (Web)

A browser-based voice/text client for conversational hospital asset
discovery: **React** frontend, **Node/Express** backend, **Microsoft
Foundry** agent, **Azure Speech**. This is v2.0 of the iLocate Voice
Client -- a separate project from the earlier Python/Tkinter desktop
prototype, built from a revised React/Node specification.

```
Hospital User -> React (browser) -> HTTPS -> Node/Express
                                                  |         |
                                           Azure Speech   Foundry Agent
                                                             |
                                                        File Search
                                                             |
                                              ilocate_prototype_assets.json
```

## Security boundary (important)

No Azure credential, Foundry secret, Speech key, or access token exists
anywhere in `client/`. The browser only ever talks to this app's own
Express API; Express is the only thing that holds Azure credentials and
the only thing that talks to Azure. See `server/.env.example`.

## Repository layout

```
client/     React + Vite + TypeScript frontend
server/     Node + Express + TypeScript backend
```

Root-level convenience scripts run both together.

## Setup

```bash
npm install          # installs both workspaces (root, client, server)
cp server/.env.example server/.env
cp client/.env.example client/.env   # optional; default already matches
```

Fill in `server/.env`:

- `AZURE_FOUNDRY_ENDPOINT` -- your Foundry project endpoint.
- `AZURE_FOUNDRY_AGENT_NAME` -- see "Foundry integration" below; this is a
  deliberate deviation from the spec's `AZURE_FOUNDRY_AGENT_ID`.
- `AZURE_SPEECH_KEY` / `AZURE_SPEECH_REGION` -- your Speech resource.
- Everything else has a working default (see the file).

Authenticate for Foundry (uses `DefaultAzureCredential`, same as Azure CLI
login):

```bash
az login
```

Run both apps together:

```bash
npm run dev
```

- React (Vite): http://localhost:5173
- Express API: http://localhost:3001

## Foundry integration (read this before debugging 401/404s)

The spec (section 39) lists `AZURE_FOUNDRY_AGENT_ID`. In practice, the
deployed iLocate agent is a Foundry **declarative agent published on the
Responses protocol** -- not the older Assistants-style
threads/runs/messages model, and it is addressed by **name**, not an
`asst_...` id. This was confirmed against the live resource during
development (see the sibling `iLocateVoiceClient` Python project, where
the same discovery was made and documented).

Concretely, `server/src/services/foundry.service.ts`:

1. Gets an Azure AD token via `DefaultAzureCredential` for scope
   `https://ai.azure.com/.default`.
2. Constructs an `openai` SDK client with `baseURL` set to
   `{AZURE_FOUNDRY_ENDPOINT}/agents/{AZURE_FOUNDRY_AGENT_NAME}/endpoint/protocols/openai`
   and that token as the API key.
3. Calls `client.responses.create({ input, previous_response_id })` per
   turn -- conversation continuity is the Responses API's own
   `previous_response_id` chaining, stored per-session in
   `conversation.service.ts`. There is no separate "create a thread" step.

If your Foundry agent is a classic Assistants-style agent instead, this is
the one file to change -- nothing else in the app depends on how Foundry
is actually reached, only on `FoundryService.sendMessage()` returning
`{ text, responseId }`.

## Audio pipeline (a deliberate simplification, documented honestly)

Spec section 19 describes the mic turning off automatically once the user
stops talking -- that's Azure's own server-side voice-activity detection in
a live streaming recognition session. Replicating that exactly would
require a persistent WebSocket/streaming bridge from the browser through
Express into the Speech SDK. For this prototype:

- The browser records with `MediaRecorder` (`audio/webm;codecs=opus`) and
  runs a lightweight amplitude check on a parallel `AnalyserNode` to
  **auto-stop after ~1.2s of silence** (`client/src/services/audioService.ts`).
  Tapping the mic again while listening also stops it early manually.
- The clip uploads to `POST /api/speech/transcribe` as raw `audio/webm`.
- The server transcodes it to 16kHz mono WAV with a bundled static ffmpeg
  binary (`ffmpeg-static` + `fluent-ffmpeg` -- pure npm install, no system
  dependency) before handing it to Azure Speech SDK's
  `AudioConfig.fromWavFileInput`, which only accepts WAV directly.
- Text-to-speech returns MP3 bytes (`audio/mpeg`) which the browser plays
  via a plain `<audio>` element.

Net effect for the user: tap once, speak, it stops on its own shortly
after you stop talking -- functionally the same experience, without a
streaming server architecture.

## REST API

| Method | Path | Purpose |
|---|---|---|
| GET | `/api/health` | Liveness check |
| POST | `/api/session` | Create a session (`{ sessionId }`) |
| DELETE | `/api/session/:sessionId` | End a session / reset conversation |
| POST | `/api/conversation` | `{ sessionId, message }` -> `{ sessionId, message, requiresFollowUp, assets? }` |
| POST | `/api/speech/transcribe` | Body: raw `audio/webm` -> `{ text }` |
| POST | `/api/speech/synthesize` | `{ text }` -> `audio/mpeg` bytes |

`requiresFollowUp` is a simple heuristic (`message.trim().endsWith('?')`),
not a business-logic judgment -- the client never tries to interpret *why*
the agent asked something, it just knows the reply reads as a question.

Text and voice requests use the exact same `/api/conversation` path (spec
section 35) -- the backend has no idea whether a message originated from
typing or speech.

## Session & location context

Sessions are held in memory per server process (`conversation.service.ts`)
-- no Redis/DB, appropriate for this prototype; they're lost on restart,
and the client lazily gets a fresh one if that happens.

Short-term location context works exactly like the Python prototype: a
light regex over the user's own words ("I'm at X", "I'm in X") remembers
*that* a location was mentioned and *what text* was used, attaches it to
outgoing Foundry messages as `metadata.session_reference_location`, and
lets the agent decide whether/how to use it. This client never resolves a
location name to a zone, never scores proximity, and never decides which
assets qualify -- that's entirely the Foundry agent's job.

## Error handling

Centralized in `server/src/middleware/errorHandler.ts`. SQL/stack
traces/credentials never reach the client; the exact spec section 41
messages are produced by `client/src/services/apiClient.ts`'s
`describeError()`:

| Situation | Message shown |
|---|---|
| Microphone permission denied/unavailable | "Microphone unavailable. Check your audio settings and try again." |
| No speech recognized | "I didn't catch that. Please try again." |
| Speech service error | "There was a problem with speech recognition. Please try again." |
| Foundry unavailable | "iLocate is temporarily unavailable. Please try again." |
| Timeout | "The request took too long. Please try again." |
| Network failure | "Unable to connect to iLocate. Check your connection and try again." |
| Text-to-speech failure | Text stays visible; only the message changes. |

## Testing

```bash
cd server
npm test
```

Runs 8 tests via Node's built-in test runner + supertest: health, session
create/delete, validation errors (missing `message`/`sessionId`/`text`),
malformed JSON, 404, and request-id echoing -- all against a `createApp()`
instance built from an in-memory fake config, so no real Azure credentials
or network calls are needed. The live Foundry/Speech integration was
verified manually against the real resources during development (see
below); automated tests intentionally don't call live Azure services.

## Prototype scope

Included: React UI, Node/Express API, Foundry integration, Azure STT/TTS,
tap-to-talk, transcript, spoken responses, text input, session continuity,
location clarification, proximity questions, error handling, logging,
speech interruption, conversation reset.

Not included (by design, per spec section 46): Python, direct PostgreSQL
access, direct client access to the asset JSON, the production iLocate
REST API, continuous listening/wake words, automatic/BLE nurse positioning,
a native mobile app, production hospital SSO, PHI, clinical
decision-making.

## Future production migration

```
React -> Node/Express -> Foundry Agent -> File Search -> iLocate JSON
```
becomes
```
React -> Node/Express -> Foundry Agent -> iLocate API Tool -> REST API -> PostgreSQL
```
without requiring the React client to be redesigned -- `foundry.service.ts`
is the one seam that would change.
