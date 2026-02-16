/**
 * IRC Channel App Entry Point
 */

export { IrcApp } from "./app.js";

// Start the app when run directly
import { IrcApp } from "./app.js";

const app = new IrcApp();
app.start().catch((error) => {
  console.error("Failed to start IRC app:", error);
  process.exit(1);
});
