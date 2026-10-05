import { useCallback, useRef } from 'react';
import { startRecording, type RecordingHandle } from '../services/audioService';

/** Thin React wrapper around audioService's recording mechanics. */
export function useAudioRecorder() {
  const handleRef = useRef<RecordingHandle | null>(null);

  const record = useCallback((): Promise<Blob> => {
    const handle = startRecording();
    handleRef.current = handle;
    return handle.result.finally(() => {
      handleRef.current = null;
    });
  }, []);

  /** Stops the in-progress recording early (e.g. the user tapped the mic again). */
  const stop = useCallback(() => {
    handleRef.current?.stop();
  }, []);

  return { record, stop };
}
