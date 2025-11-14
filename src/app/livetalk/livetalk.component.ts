// import { Component, OnInit, OnDestroy, ChangeDetectorRef } from "@angular/core";
// import { CommonModule } from "@angular/common";
// import { ConversationService } from "../voicetransport/webrtc-chat.service";

// @Component({
//   selector: "app-livetalk",
//   templateUrl: "./livetalk.component.html",
//   styleUrls: ["./livetalk.component.css"],
//   standalone: true,
//   imports: [CommonModule],
//   providers: [ConversationService],
// })
// export class LiveTalkComponent implements OnInit, OnDestroy {
//   public statusText: string = "Initializing...";

//   constructor(
//     private conversationService: ConversationService,
//     private cdr: ChangeDetectorRef
//   ) {}

//   async ngOnInit(): Promise<void> {
//     // When this component loads, it takes over and switches to voice mode.
//     try {
//       // IMPORTANT: Replace with your actual keys and configuration
//       await this.conversationService.initVoice("<EPHEMERAL_KEY>", {
//         companyId: 1,
//         userId: 2,
//         initiatorId: 3,
//         initiatorName: "You",
//       });
//       await this.conversationService.switchToVoice("<EPHEMERAL_KEY>");
//       this.statusText = "Ready to speak";
//       this.cdr.detectChanges();
//     } catch (error) {
//       this.statusText = "Error starting voice mode";
//       console.error("Error initializing voice service:", error);
//       this.cdr.detectChanges();
//     }
//   }

//   // The click logic is now handled by the service's internal state.
//   // The UI is now just a visual indicator.

//   ngOnDestroy(): void {
//     // When the user leaves this tab, stop the connection.
//     this.conversationService.stop();
//   }
// }

import { Component, OnInit, OnDestroy, ChangeDetectorRef } from "@angular/core";
import { CommonModule } from "@angular/common";
import { ConversationService } from "../voicetransport/webrtc-chat.service";

@Component({
  selector: "app-livetalk",
  templateUrl: "./livetalk.component.html",
  styleUrls: ["./livetalk.component.css"],
  standalone: true,
  imports: [CommonModule],
  // We REMOVED 'providers' from here
})
export class LiveTalkComponent implements OnInit, OnDestroy {
  public statusText: string = "Initializing...";

  constructor(
    private conversationService: ConversationService,
    private cdr: ChangeDetectorRef
  ) {}

  async ngOnInit(): Promise<void> {
    try {
      // IMPORTANT: REPLACE these placeholders with your actual keys!
      await this.conversationService.initVoice("<YOUR_EPHEMERAL_KEY>", {
        companyId: 1,
        userId: 2,
        initiatorId: 3,
        initiatorName: "User",
      });
      await this.conversationService.switchToVoice("<YOUR_EPHEMERAL_KEY>");
      this.statusText = "Ready to speak";
      this.cdr.detectChanges();
    } catch (error) {
      this.statusText = "Error starting voice mode";
      console.error("Error initializing voice service:", error);
      this.cdr.detectChanges();
    }
  }

  ngOnDestroy(): void {
    // When the user leaves this tab, we can choose to stop the connection,
    // or leave it running for a quick switch back. For simplicity, we'll stop it.
    this.conversationService.stop();
  }
}
