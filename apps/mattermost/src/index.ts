/**
 * Mattermost Channel App Entry Point
 */

export { MattermostApp } from "./app.js";

// Start the app when run directly
import { MattermostApp } from "./app.js";

const app = new MattermostApp();
app.start().catch((error) => {
  console.error("Failed to start Mattermost app:", error);
  process.exit(1);
});
