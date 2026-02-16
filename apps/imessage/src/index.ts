/**
 * iMessage Channel App Entry Point
 */

export { IMessageApp } from "./app.js";

// Start the app when run directly
import { IMessageApp } from "./app.js";

const app = new IMessageApp();
app.start().catch((error) => {
  console.error("Failed to start iMessage app:", error);
  process.exit(1);
});
