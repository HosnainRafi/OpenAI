// chat-transport.ts
import { ConversationTransport, TextHandler, StateHandler } from './conversation-transport';

export class ChatTransport implements ConversationTransport {
  private _onText: TextHandler = () => {};
  private _onState: StateHandler = () => {};

  constructor(
    private apiKeyOrBackendUrl: string,     // if you proxy, pass your backend URL instead
    private useBrowserTts: boolean = false,
    private model: string = 'gpt-4.1-mini'   // pick your preferred text model
  ) {}

  async start(): Promise<void> {
    this._onState('connected');
  }

  async stop(): Promise<void> {
    this._onState('stopped');
  }

  async sendText(message: string): Promise<void> {
    this._onText(message, { role: 'user', origin: 'chat' });

    // OPTION A: Direct OpenAI call (if you must call from browser, beware of exposing keys; better to proxy)
    const res = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: { 'Authorization': `Bearer ${this.apiKeyOrBackendUrl}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({
        model: this.model,
        messages: [{ role: 'user', content: message }],
        temperature: 0.7,
      }),
    });

    if (!res.ok) {
      this._onState('error', await res.text());
      return;
    }

    const data = await res.json();
    const text = data?.choices?.[0]?.message?.content ?? '';
    if (text) {
      this._onText(text, { role: 'assistant', origin: 'chat' });
      if (this.useBrowserTts) this.speak(text);
    }
  }

  private speak(text: string) {
    try {
      const u = new SpeechSynthesisUtterance(text);
      // You can expose voice selection elsewhere
      speechSynthesis.speak(u);
    } catch {}
  }

  onText(handler: TextHandler): void { this._onText = handler; }
  onState(handler: StateHandler): void { this._onState = handler; }
}
