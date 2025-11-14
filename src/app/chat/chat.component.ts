import {
  Component,
  OnInit,
  OnDestroy,
  ChangeDetectorRef,
  NgZone,
} from "@angular/core";
import { CommonModule } from "@angular/common";
import { FormsModule } from "@angular/forms";
import { ChatMessage } from "../models/chat-message.model";
import { ConversationService } from "../voicetransport/webrtc-chat.service";

@Component({
  selector: "app-chat",
  templateUrl: "./chat.component.html",
  styleUrls: ["./chat.component.css"],
  standalone: true,
  imports: [CommonModule, FormsModule],
  // providers array is correctly removed
})
export class ChatComponent implements OnInit, OnDestroy {
  public newMessage: string = "";
  public messages: ChatMessage[] = [];

  // Define the event handler as a class property
  private messageHandler = (event: Event) => {
    // We must cast the event to a CustomEvent to access the 'detail' property
    const customEvent = event as CustomEvent;
    const msg = customEvent.detail;

    this.ngZone.run(() => {
      const text = msg?.results?.[0]?.alternatives?.[0]?.transcript;
      if (text) {
        const botMessage: ChatMessage = {
          text: text,
          sender: "bot",
          timestamp: new Date(),
        };
        this.messages.push(botMessage);
      }
    });
  };

  constructor(
    private conversationService: ConversationService,
    private ngZone: NgZone
  ) {}

  async ngOnInit(): Promise<void> {
    try {
      // IMPORTANT: Fill in your actual config and keys
      await this.conversationService.initVoice("<YOUR_EPHEMERAL_KEY>", {
        companyId: 1,
        userId: 2,
        initiatorId: 3,
        initiatorName: "User",
      });
      await this.conversationService.switchToChat("<YOUR_KEY>", {
        useBrowserTts: true,
      });

      // **THE FINAL, CORRECT FIX**
      // Listen for a global event on the window object
      window.addEventListener("message", this.messageHandler);
    } catch (error) {
      console.error("Error initializing chat service:", error);
    }
  }

  async sendMessage(): Promise<void> {
    const trimmedMessage = this.newMessage.trim();
    if (!trimmedMessage) return;

    const userMessage: ChatMessage = {
      text: trimmedMessage,
      sender: "user",
      timestamp: new Date(),
    };
    this.messages.push(userMessage);
    this.newMessage = "";

    try {
      await this.conversationService.sendText(trimmedMessage);
    } catch (error) {
      console.error("Error sending message:", error);
    }
  }

  ngOnDestroy(): void {
    // IMPORTANT: Always remove the event listener when the component is destroyed
    window.removeEventListener("message", this.messageHandler);
    this.conversationService.stop();
  }
}
