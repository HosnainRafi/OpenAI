export interface ChatUpdate {
  kind: 'partial' | 'final';
  text?: string;         // extracted text if available
  raw: any;              // original event object
}