export type AppState = 'READY' | 'LISTENING' | 'PROCESSING' | 'SPEAKING' | 'ERROR';

export interface AssetSummary {
  asset_id?: string;
  asset_type?: string;
  status?: string;
  confidence?: number;
  zone_name?: string;
  floor?: number;
  last_seen?: string;
  [key: string]: unknown;
}

export interface ChatMessage {
  id: string;
  speaker: 'You' | 'iLocate';
  text: string;
  isError?: boolean;
}
