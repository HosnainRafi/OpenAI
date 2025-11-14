import { Component } from "@angular/core";
import { RouterOutlet, RouterLink, RouterLinkActive } from "@angular/router";
// Import the main service
import { ConversationService } from "../voicetransport/webrtc-chat.service";

@Component({
  selector: "app-live",
  templateUrl: "./live.component.html",
  styleUrls: ["./live.component.css"],
  standalone: true,
  imports: [RouterOutlet, RouterLink, RouterLinkActive],
  providers: [ConversationService],
})
export class LiveComponent {
  constructor() {}
}
