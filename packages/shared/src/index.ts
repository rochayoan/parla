export interface TranscribeRequest {
  mode: 'dictado';
  language: string;
  appSecret?: string;
}

export interface TranscribeResponse {
  success: boolean;
  rawText: string;
  finalText: string;
  language: string;
  mode: string;
  provider: string;
  durationMs: number;
  error?: string;
}

export interface HealthResponse {
  status: 'ok';
  version: string;
}

export interface LanguageConfig {
  code: string;
  name: string;
  status: 'stable' | 'future';
}

export const languages: LanguageConfig[] = [
  { code: 'es', name: 'Español', status: 'stable' },
  { code: 'qu', name: 'Quechua', status: 'future' },
  { code: 'ay', name: 'Aymara', status: 'future' },
  { code: 'en', name: 'English', status: 'future' },
];

export const transcriptionProviders = {
  openai: 'openai',
  whisperLocal: 'whisper-local',
  fineTunedWhisper: 'fine-tuned-whisper',
  customQuechua: 'custom-quechua-model',
  customAymara: 'custom-aymara-model',
} as const;

export interface AppConfig {
  backendUrl: string;
  appSecret: string;
  language: string;
  shortcut: string;
}
