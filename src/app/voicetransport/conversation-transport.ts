// conversation-transport.ts
export type TextHandler = (text: string, meta?: any) => void;
export type AudioHandler = (stream: MediaStream | Blob, meta?: any) => void;
export type StateHandler = (state: 'idle' | 'connecting' | 'connected' | 'stopped' | 'error', info?: any) => void;

export interface ConversationTransport {
  start(): Promise<void>;
  stop(): Promise<void>;
  sendText(message: string): Promise<void>;    // noop for voice unless you want server-side TTS
  onText(handler: TextHandler): void;
  onAudio?(handler: AudioHandler): void;
  onState(handler: StateHandler): void;
}
