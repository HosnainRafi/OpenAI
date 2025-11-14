// webrtc-chat.service.ts (replacement for your WebRTCService)
import { Injectable } from '@angular/core';
import { ConversationTransport } from './conversation-transport';
import { VoiceTransport } from './voice-transport';
import { ChatTransport } from './chat-transport';
import { VoiceMessageWithOpenAIService } from '../services/VoiceMessageWithOpenAI.service';


export type Mode = 'voice' | 'chat';

@Injectable({ providedIn: 'root' })
export class ConversationService {
  private transport!: ConversationTransport;
  private mode: Mode = 'voice';

  // your existing context
  public _userCompanyId = 0;
  public _userId = 0;
  public _initiatorId = 0;
  public _initiatorName = '';

  constructor(private _voiceMessageWithOpenAIService: VoiceMessageWithOpenAIService) {}

  // ---- public API used by components ----
  async initVoice(ephemeralKey: string, initiator: { companyId:number; userId:number; initiatorId:number; initiatorName:string }, model = 'gpt-4o-realtime-preview-2024-12-17') {
    this._userCompanyId = initiator.companyId;
    this._userId = initiator.userId;
    this._initiatorId = initiator.initiatorId;
    this._initiatorName = initiator.initiatorName;

    const v = new VoiceTransport(ephemeralKey, model);
    this.wireCommonHandlers(v);
    this.transport = v;
    this.mode = 'voice';
    await this.transport.start();
  }

  async initChat(apiKeyOrBackendUrl: string, { useBrowserTts = false, model = 'gpt-4.1-mini' } = {}) {
    const c = new ChatTransport(apiKeyOrBackendUrl, useBrowserTts, model);
    this.wireCommonHandlers(c);
    this.transport = c;
    this.mode = 'chat';
    await this.transport.start();
  }

  async switchToVoice(ephemeralKey: string, model?: string) {
    await this.transport?.stop();
    await this.initVoice(ephemeralKey, {
      companyId: this._userCompanyId,
      userId: this._userId,
      initiatorId: this._initiatorId,
      initiatorName: this._initiatorName
    }, model);
  }

  async switchToChat(apiKeyOrBackendUrl: string, opts?: { useBrowserTts?: boolean; model?: string }) {
    await this.transport?.stop();
    await this.initChat(apiKeyOrBackendUrl, opts);
  }

  async stop() { await this.transport?.stop(); }

  async sendText(message: string) { await this.transport?.sendText(message); }

  // ---- shared event wiring (persists your existing post logic) ----
  private wireCommonHandlers(t: ConversationTransport) {
    t.onText((text, meta) => {
      const isAnswerByAI = meta?.role === 'assistant';
      this.postVoiceMessageWithOpenAIModel({
        meta,
        text,
        isAnswerByAI
      });
    });

    t.onState((state, info) => {
      // hook for UI to show connection state / errors if you like
      // console.log('[state]', state, info);
    });
  }

  // your existing post, adapted to accept simpler input
  private postVoiceMessageWithOpenAIModel(payload: { text: string; isAnswerByAI: boolean; meta?: any }) {
    const { text, isAnswerByAI, meta } = payload;

    const model: any = {
      initiatorId: this._initiatorId,
      userCompanyId: this._userCompanyId,
      userId: this._userId,
      initiatorName: isAnswerByAI ? 'Melodie' : this._initiatorName,
      isAnswerByAI,
      responseId: meta?.responseId ?? '',
      responseStatus: meta?.status ?? '',
      responseAnswerId: meta?.answerId ?? '',
      responseAnswerRole: meta?.role ?? (isAnswerByAI ? 'assistant' : 'user'),
      responseAnswerStatus: 'Completed',
      responseAnswerContent: text,
      responseAnswerType: 'text',
      remarks: ''
    };

    this._voiceMessageWithOpenAIService
      .postVoiceMessageWithOpenAIWithMMServer(model)
      .subscribe({
        next: () => {},
        error: (e) => console.error(e)
      });
  }
}
