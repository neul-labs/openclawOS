/**
 * Nextcloud Talk Channel App Entry Point
 */

export { NextcloudTalkApp } from "./app.js";

// Start the app when run directly
import { NextcloudTalkApp } from "./app.js";

const app = new NextcloudTalkApp();
app.start().catch((error) => {
  console.error("Failed to start Nextcloud Talk app:", error);
  process.exit(1);
});
