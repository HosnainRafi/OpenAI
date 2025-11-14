export interface ChatMessage {
  text: string;
  sender: "user" | "bot";
  timestamp: Date;
}
