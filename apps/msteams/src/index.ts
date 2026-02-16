/**
 * Microsoft Teams Channel App Entry Point
 */

export { MSTeamsApp } from "./app.js";

// Start the app when run directly
import { MSTeamsApp } from "./app.js";

const app = new MSTeamsApp();
app.start().catch((error) => {
  console.error("Failed to start Microsoft Teams app:", error);
  process.exit(1);
});
