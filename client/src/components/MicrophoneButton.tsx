import type { AppState } from '../types/conversation';

const COLORS: Record<AppState, string> = {
  READY: '#2e7d32',
  LISTENING: '#c62828',
  PROCESSING: '#9e9e9e',
  SPEAKING: '#6a1b9a',
  ERROR: '#9e9e9e',
};

interface MicrophoneButtonProps {
  state: AppState;
  onTap: () => void;
}

export default function MicrophoneButton({ state, onTap }: MicrophoneButtonProps) {
  const disabled = state === 'PROCESSING';

  return (
    <button
      className="mic-button"
      style={{ backgroundColor: COLORS[state] }}
      onClick={onTap}
      disabled={disabled}
      aria-label="Tap to talk"
    >
      <span className="mic-icon" aria-hidden="true">
        🎤
      </span>
    </button>
  );
}
