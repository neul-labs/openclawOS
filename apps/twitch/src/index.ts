/**
 * Twitch Channel App Entry Point
 */

export { TwitchApp } from "./app.js";

// Start the app when run directly
import { TwitchApp } from "./app.js";

const app = new TwitchApp();
app.start().catch((error) => {
  console.error("Failed to start Twitch app:", error);
  process.exit(1);
});
