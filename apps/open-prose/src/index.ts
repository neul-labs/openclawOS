/**
 * Open Prose App Entry Point
 */

export { OpenProseApp } from "./app.js";

// Start the app when run directly
import { OpenProseApp } from "./app.js";

const app = new OpenProseApp();
app.start().catch((error) => {
  console.error("Failed to start Open Prose app:", error);
  process.exit(1);
});
