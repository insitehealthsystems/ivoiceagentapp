import type { AppState } from '../types/conversation';

const COLORS: Record<AppState, string> = {
  READY: '#2e7d32',
  LISTENING: '#1565c0',
  PROCESSING: '#f9a825',
  SPEAKING: '#6a1b9a',
  ERROR: '#c62828',
};

export default function StatusIndicator({ state }: { state: AppState }) {
  return (
    <div className="status-indicator" style={{ color: COLORS[state] }}>
      {state}
    </div>
  );
}
