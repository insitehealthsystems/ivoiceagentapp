/**
 * Low-level microphone capture and audio playback mechanics. Hooks
 * (useAudioRecorder, useAudioPlayback) wrap these in React state; this
 * module has no React dependency and no knowledge of conversation state.
 *
 * Recording uses MediaRecorder (webm/opus) rather than raw PCM capture --
 * simpler and more broadly compatible than hand-rolling an AudioWorklet
 * resampler. A lightweight amplitude check on a parallel AnalyserNode
 * auto-stops the recording after a short silence, approximating Azure's
 * own end-of-utterance detection (used server-side, not here) so the user
 * experience is still "tap once, speak, done" without needing a live
 * streaming connection to the backend.
 */

const SILENCE_RMS_THRESHOLD = 0.02;
const SILENCE_DURATION_MS = 1200;
const MIN_SPEECH_BEFORE_SILENCE_CHECK_MS = 500;
const MAX_RECORDING_DURATION_MS = 20_000;
const SILENCE_POLL_INTERVAL_MS = 100;

export class MicrophoneUnavailableError extends Error {}

export interface RecordingHandle {
  /** Resolves with the recorded clip once stopped (automatically or manually). */
  result: Promise<Blob>;
  /** Stops recording immediately (e.g. the user tapped the mic again). */
  stop: () => void;
}

export function startRecording(): RecordingHandle {
  let stopRequested = false;
  let resolveResult!: (blob: Blob) => void;
  let rejectResult!: (err: unknown) => void;

  const result = new Promise<Blob>((resolve, reject) => {
    resolveResult = resolve;
    rejectResult = reject;
  });

  let stopFn: () => void = () => {
    stopRequested = true;
  };

  void (async () => {
    let stream: MediaStream;
    try {
      stream = await navigator.mediaDevices.getUserMedia({ audio: true });
    } catch (err) {
      rejectResult(new MicrophoneUnavailableError(err instanceof Error ? err.message : String(err)));
      return;
    }

    if (stopRequested) {
      stream.getTracks().forEach((track) => track.stop());
      rejectResult(new MicrophoneUnavailableError('Recording was stopped before it started.'));
      return;
    }

    const audioContext = new AudioContext();
    const source = audioContext.createMediaStreamSource(stream);
    const analyser = audioContext.createAnalyser();
    analyser.fftSize = 512;
    source.connect(analyser);

    const chunks: BlobPart[] = [];
    const mimeType = MediaRecorder.isTypeSupported('audio/webm;codecs=opus') ? 'audio/webm;codecs=opus' : 'audio/webm';
    const recorder = new MediaRecorder(stream, { mimeType });

    recorder.ondataavailable = (event) => {
      if (event.data.size > 0) chunks.push(event.data);
    };

    const cleanup = () => {
      clearInterval(silenceCheckInterval);
      stream.getTracks().forEach((track) => track.stop());
      void audioContext.close();
    };

    recorder.onstop = () => {
      cleanup();
      resolveResult(new Blob(chunks, { type: 'audio/webm' }));
    };
    recorder.onerror = (event) => {
      cleanup();
      rejectResult(new Error(`MediaRecorder error: ${String(event)}`));
    };

    const startedAt = Date.now();
    const timeDomainData = new Uint8Array(analyser.fftSize);
    let lastLoudAt = startedAt;

    const silenceCheckInterval = setInterval(() => {
      analyser.getByteTimeDomainData(timeDomainData);
      let sumSquares = 0;
      for (let i = 0; i < timeDomainData.length; i += 1) {
        const normalized = (timeDomainData[i] - 128) / 128;
        sumSquares += normalized * normalized;
      }
      const rms = Math.sqrt(sumSquares / timeDomainData.length);

      const now = Date.now();
      if (rms > SILENCE_RMS_THRESHOLD) {
        lastLoudAt = now;
      }

      const elapsed = now - startedAt;
      const silentFor = now - lastLoudAt;
      if (
        (elapsed > MIN_SPEECH_BEFORE_SILENCE_CHECK_MS && silentFor > SILENCE_DURATION_MS) ||
        elapsed > MAX_RECORDING_DURATION_MS
      ) {
        recorder.stop();
      }
    }, SILENCE_POLL_INTERVAL_MS);

    stopFn = () => {
      if (recorder.state !== 'inactive') {
        recorder.stop();
      }
    };

    if (stopRequested) {
      // Stopped before recording actually started (extremely unlikely --
      // would require stop() within milliseconds of start()). Resolve with
      // an empty clip rather than calling stop() on a never-started recorder.
      cleanup();
      resolveResult(new Blob([], { type: 'audio/webm' }));
    } else {
      recorder.start();
    }
  })();

  return {
    result,
    stop: () => stopFn(),
  };
}

export interface PlaybackHandle {
  finished: Promise<void>;
  stop: () => void;
}

export function playAudioBlob(blob: Blob): PlaybackHandle {
  const url = URL.createObjectURL(blob);
  const audio = new Audio(url);

  const finished = new Promise<void>((resolve, reject) => {
    audio.onended = () => {
      URL.revokeObjectURL(url);
      resolve();
    };
    audio.onerror = () => {
      URL.revokeObjectURL(url);
      reject(new Error('Audio playback failed.'));
    };
    audio.play().catch((err) => {
      URL.revokeObjectURL(url);
      reject(err);
    });
  });

  return {
    finished,
    stop: () => {
      audio.pause();
      URL.revokeObjectURL(url);
    },
  };
}
