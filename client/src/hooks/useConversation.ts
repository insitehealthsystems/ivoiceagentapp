import { useCallback, useEffect, useRef, useState } from 'react';
import { createSession, deleteSession, describeError, sendMessage, synthesizeSpeech, transcribeAudio } from '../services/apiClient';
import { MicrophoneUnavailableError } from '../services/audioService';
import { useAudioPlayback } from './useAudioPlayback';
import { useAudioRecorder } from './useAudioRecorder';
import type { AppState, ChatMessage } from '../types/conversation';

const ERROR_DISPLAY_MS = 1500;

/**
 * Owns the application state machine (READY/LISTENING/PROCESSING/SPEAKING/
 * ERROR), the conversation transcript, and session lifecycle. This is the
 * only place that sequences recording -> transcription -> sending ->
 * receiving -> displaying -> speaking. It contains no asset-search logic
 * of its own -- it only relays the user's message to the backend and
 * plays back whatever text comes back.
 */
export function useConversation() {
  const [state, setStateRaw] = useState<AppState>('READY');
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [sessionId, setSessionId] = useState<string | null>(null);

  // Mirrors `state` for use inside async callbacks, which otherwise close
  // over a stale value -- lets us detect "has something else already moved
  // the state on since this async step started" (e.g. an interruption).
  const stateRef = useRef<AppState>('READY');
  const setAppState = useCallback((next: AppState) => {
    stateRef.current = next;
    setStateRaw(next);
  }, []);

  const recorder = useAudioRecorder();
  const playback = useAudioPlayback();

  useEffect(() => {
    let mounted = true;
    createSession()
      .then(({ sessionId: id }) => {
        if (mounted) setSessionId(id);
      })
      .catch(() => {
        if (mounted) {
          appendMessage('iLocate', 'Unable to connect to iLocate. Check your connection and try again.', true);
        }
      });
    return () => {
      mounted = false;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps -- run once on mount
  }, []);

  const appendMessage = useCallback((speaker: ChatMessage['speaker'], text: string, isError = false) => {
    setMessages((prev) => [...prev, { id: crypto.randomUUID(), speaker, text, isError }]);
  }, []);

  const recoverToReadyAfterError = useCallback(
    (text: string) => {
      appendMessage('iLocate', text, true);
      setAppState('ERROR');
      setTimeout(() => setAppState('READY'), ERROR_DISPLAY_MS);
    },
    [appendMessage, setAppState],
  );

  const speak = useCallback(
    async (text: string) => {
      setAppState('SPEAKING');
      try {
        const audioBlob = await synthesizeSpeech(text);
        await playback.play(audioBlob);
      } catch {
        // Text-to-speech failure: the text response stays visible (already
        // appended by the caller); just fall through to Ready below.
      }
      // Only move to READY if nothing else (e.g. a mic-tap interruption)
      // already moved the state machine past SPEAKING.
      if (stateRef.current === 'SPEAKING') {
        setAppState('READY');
      }
    },
    [playback, setAppState],
  );

  const submitMessage = useCallback(
    async (text: string) => {
      if (!sessionId) {
        recoverToReadyAfterError('Unable to connect to iLocate. Check your connection and try again.');
        return;
      }
      setAppState('PROCESSING');
      try {
        const reply = await sendMessage(sessionId, text);
        appendMessage('iLocate', reply.message);
        await speak(reply.message);
      } catch (err) {
        recoverToReadyAfterError(describeError(err));
      }
    },
    [sessionId, appendMessage, speak, recoverToReadyAfterError, setAppState],
  );

  const canStartNewRequest = state === 'READY' || state === 'ERROR' || state === 'SPEAKING';

  const sendTypedText = useCallback(
    (rawText: string) => {
      const text = rawText.trim();
      if (!text || !canStartNewRequest) return;
      if (state === 'SPEAKING') playback.stop();
      appendMessage('You', text);
      void submitMessage(text);
    },
    [canStartNewRequest, state, playback, appendMessage, submitMessage],
  );

  const tapMicrophone = useCallback(() => {
    // Tapping again while already listening manually ends the recording
    // early, instead of starting a conflicting second one.
    if (state === 'LISTENING') {
      recorder.stop();
      return;
    }
    if (state === 'SPEAKING') {
      playback.stop();
    } else if (!canStartNewRequest) {
      // Ignore taps while PROCESSING -- never start a duplicate request.
      return;
    }

    setAppState('LISTENING');

    void (async () => {
      let clip: Blob;
      try {
        clip = await recorder.record();
      } catch (err) {
        const message =
          err instanceof MicrophoneUnavailableError
            ? 'Microphone unavailable. Check your audio settings and try again.'
            : 'Microphone unavailable. Check your audio settings and try again.';
        recoverToReadyAfterError(message);
        return;
      }

      setAppState('PROCESSING');
      let recognizedText: string;
      try {
        const { text } = await transcribeAudio(clip);
        recognizedText = text.trim();
      } catch (err) {
        recoverToReadyAfterError(describeError(err));
        return;
      }

      if (!recognizedText) {
        recoverToReadyAfterError("I didn't catch that. Please try again.");
        return;
      }

      appendMessage('You', recognizedText);
      void submitMessage(recognizedText);
    })();
  }, [state, canStartNewRequest, recorder, playback, appendMessage, submitMessage, recoverToReadyAfterError, setAppState]);

  const resetConversation = useCallback(() => {
    if (sessionId) {
      void deleteSession(sessionId).catch(() => {
        /* best-effort cleanup */
      });
    }
    playback.stop();
    setMessages([]);
    setAppState('READY');
    createSession()
      .then(({ sessionId: id }) => setSessionId(id))
      .catch(() => {
        appendMessage('iLocate', 'Unable to connect to iLocate. Check your connection and try again.', true);
      });
  }, [sessionId, playback, setAppState, appendMessage]);

  return {
    state,
    messages,
    canStartNewRequest,
    tapMicrophone,
    sendTypedText,
    resetConversation,
  };
}
