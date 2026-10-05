import { useCallback, useRef } from 'react';
import { playAudioBlob, type PlaybackHandle } from '../services/audioService';

/** Thin React wrapper around audioService's playback mechanics. */
export function useAudioPlayback() {
  const handleRef = useRef<PlaybackHandle | null>(null);

  const play = useCallback((blob: Blob): Promise<void> => {
    const handle = playAudioBlob(blob);
    handleRef.current = handle;
    return handle.finished.finally(() => {
      handleRef.current = null;
    });
  }, []);

  /** Stops playback immediately (speech interruption via mic tap). */
  const stop = useCallback(() => {
    handleRef.current?.stop();
    handleRef.current = null;
  }, []);

  return { play, stop };
}
