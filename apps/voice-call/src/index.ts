/**
 * Voice Call App Entry Point
 */

export { VoiceCallApp } from "./app.js";

// Start the app when run directly
import { VoiceCallApp } from "./app.js";

const app = new VoiceCallApp();
app.start().catch((error) => {
  console.error("Failed to start Voice Call app:", error);
  process.exit(1);
});
