/**
 * Google Chat Channel App Entry Point
 */

export { GoogleChatApp } from "./app.js";

// Start the app when run directly
import { GoogleChatApp } from "./app.js";

const app = new GoogleChatApp();
app.start().catch((error) => {
  console.error("Failed to start Google Chat app:", error);
  process.exit(1);
});
