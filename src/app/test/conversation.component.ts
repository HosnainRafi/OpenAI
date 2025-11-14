// conversation.component.ts
import { Component } from "@angular/core";
import { ConversationService } from "../voicetransport/webrtc-chat.service";

@Component({
  selector: "app-conversation",
  template: `
    <div class="controls">
      <button (click)="toVoice()">Voice</button>
      <button (click)="toChat()">Chat</button>
    </div>

    <div *ngIf="mode === 'chat'">
      <input
        [(ngModel)]="input"
        (keyup.enter)="send()"
        placeholder="Type a message..."
      />
      <button (click)="send()">Send</button>
    </div>
  `,
})
export class ConversationComponent {
  input = "";
  mode: "voice" | "chat" = "voice";

  constructor(private conv: ConversationService) {}

  async ngOnInit() {
    // start in voice mode
    await this.conv.initVoice("<EPHEMERAL_KEY>", {
      companyId: 1,
      userId: 2,
      initiatorId: 3,
      initiatorName: "You",
    });
  }

  async toVoice() {
    this.mode = "voice";
    await this.conv.switchToVoice("<EPHEMERAL_KEY>");
  }

  async toChat() {
    this.mode = "chat";
    // Strongly recommended: proxy via your backend to avoid exposing API keys
    await this.conv.switchToChat("<YOUR_BACKEND_OR_OPENAI_KEY>", {
      useBrowserTts: true,
    });
  }

  async send() {
    if (!this.input.trim()) return;
    await this.conv.sendText(this.input.trim());
    this.input = "";
  }

  async ngOnDestroy() {
    await this.conv.stop();
  }
}
