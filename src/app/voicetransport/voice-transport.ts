// voice-transport.ts
import { ConversationTransport, TextHandler, AudioHandler, StateHandler } from './conversation-transport';

export class VoiceTransport implements ConversationTransport {
  private _rtc!: RTCPeerConnection;
  private _stream!: MediaStream;
  private _dataChannel!: RTCDataChannel;
  private _audioEl!: HTMLAudioElement;

  private _onText: TextHandler = () => {};
  private _onAudio: AudioHandler = () => {};
  private _onState: StateHandler = () => {};

  constructor(
    private ephemeralKey: string,
    private model: string = 'gpt-4o-realtime-preview-2024-12-17'
  ) {}

  async start(): Promise<void> {
    try {
      this._onState('connecting');
      this._rtc = new RTCPeerConnection();
      this._audioEl = document.createElement('audio');
      this._audioEl.autoplay = true;

      // remote audio
      this._rtc.ontrack = (event) => {
        if (event.streams[0]) {
          this._audioEl.srcObject = event.streams[0];
          document.body.appendChild(this._audioEl);
          this._onAudio(event.streams[0], { source: 'remote' });
        }
      };

      this._rtc.oniceconnectionstatechange = () => {
        const s = this._rtc.iceConnectionState;
        if (s === 'connected') this._onState('connected');
        if (s === 'disconnected' || s === 'closed' || s === 'failed') this._onState('stopped', { reason: s });
      };

      // local mic
      this._stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      this._stream.getTracks().forEach(t => this._rtc.addTrack(t, this._stream));

      // data channel
      this._dataChannel = this._rtc.createDataChannel('oai-events');
      this._dataChannel.addEventListener('message', (event) => this.handleServerEvent(event.data));

      // offer/answer
      const offer = await this._rtc.createOffer({ offerToReceiveAudio: true, offerToReceiveVideo: false });
      await this._rtc.setLocalDescription(offer);

      const res = await fetch(`https://api.openai.com/v1/realtime?model=${encodeURIComponent(this.model)}`, {
        method: 'POST',
        body: offer.sdp,
        headers: { Authorization: `Bearer ${this.ephemeralKey}`, 'Content-Type': 'application/sdp' },
      });

      const answer = { type: 'answer' as RTCSdpType, sdp: await res.text() };
      await this._rtc.setRemoteDescription(answer);

      window.addEventListener('message', (e) => {
        if (e.data === 'close-connection') this.stop();
      });
    } catch (err) {
      this._onState('error', err);
      throw err;
    }
  }

  private handleServerEvent(raw: string) {
    try {
      const msg = JSON.parse(raw);
      // Minimal handling: emit final assistant text, and (optionally) user transcripts if you want them
      if (msg.type === 'response.done') {
        const out = msg?.response?.output?.[0];
        if (out?.type === 'message' && out?.role === 'assistant') {
          const content = out.content as Array<any>;
          const text = content?.[0]?.transcript ?? '';
          if (text) this._onText(text, { role: 'assistant', origin: 'webrtc' });
        }
      }
      if (msg.type === 'response.content_part.added') {
        const text = msg?.part?.transcript ?? '';
        if (text) this._onText(text, { role: 'user', partial: true, origin: 'webrtc' });
      }
    } catch (e) {
      // ignore parse errors
    }
  }

  // Optional: send text to the realtime session for TTS (depends on model/session settings)
  async sendText(message: string): Promise<void> {
    if (!this._dataChannel || this._dataChannel.readyState !== 'open') return;
    // Most realtime servers accept a "input_text" or similar event — adapt if needed:
    this._dataChannel.send(JSON.stringify({ type: 'input_text', text: message }));
  }

  async stop(): Promise<void> {
    try {
      this._rtc?.close();
      this._rtc = undefined as any;
      this._dataChannel = undefined as any;

      if (this._stream) {
        this._stream.getTracks().forEach(t => t.stop());
      }
      if (this._audioEl && this._audioEl.parentElement) {
        this._audioEl.pause();
        this._audioEl.srcObject = null;
        this._audioEl.parentElement.removeChild(this._audioEl);
      }
      this._onState('stopped');
    } catch {}
  }

  onText(handler: TextHandler): void { this._onText = handler; }
  onAudio(handler: AudioHandler): void { this._onAudio = handler; }
  onState(handler: StateHandler): void { this._onState = handler; }
}
