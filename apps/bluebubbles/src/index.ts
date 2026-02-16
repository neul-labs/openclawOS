/**
 * BlueBubbles Channel App Entry Point
 */

export { BlueBubblesApp } from "./app.js";

// Start the app when run directly
import { BlueBubblesApp } from "./app.js";

const app = new BlueBubblesApp();
app.start().catch((error) => {
  console.error("Failed to start BlueBubbles app:", error);
  process.exit(1);
});
