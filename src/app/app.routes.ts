import { Routes } from "@angular/router";
import { ChatWithAIComponent } from "./chat-with-ai/chat-with-ai.component";
import { UnifiedConversationComponent } from "./unified-conversation/unified-conversation.component";

// Remove old imports - we don't need them anymore
// import { LiveComponent } from "./live/live.component";
// import { ChatComponent } from "./chat/chat.component";
// import { LiveTalkComponent } from "../app/livetalk/livetalk.component";

// Add new import for unified component

export const routes: Routes = [
  // Default route redirects to unified conversation
  { path: '', redirectTo: 'conversation', pathMatch: 'full' },

  // Unified conversation route (replaces live/chat/livetalk)
  {
    path: 'conversation',
    component: UnifiedConversationComponent,
  },
  {
    path: 'chat-with-ai',
    component: ChatWithAIComponent,
  },

  // Redirect any unknown paths to conversation
  { path: '**', redirectTo: 'conversation' },
];
