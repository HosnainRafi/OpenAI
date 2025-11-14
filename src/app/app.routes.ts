import { Routes } from "@angular/router";
// Remove old imports - we don't need them anymore
// import { LiveComponent } from "./live/live.component";
// import { ChatComponent } from "./chat/chat.component";
// import { LiveTalkComponent } from "../app/livetalk/livetalk.component";

// Add new import for unified component
import { UnifiedConversationComponent } from "./unified-conversation/unified-conversation.component";

export const routes: Routes = [
  // Default route redirects to unified conversation
  { path: "", redirectTo: "conversation", pathMatch: "full" },

  // Unified conversation route (replaces live/chat/livetalk)
  {
    path: "conversation",
    component: UnifiedConversationComponent,
  },

  // Redirect any unknown paths to conversation
  { path: "**", redirectTo: "conversation" },
];
