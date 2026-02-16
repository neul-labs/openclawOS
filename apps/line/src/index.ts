/**
 * LINE Channel App Entry Point
 */

export { LineApp } from "./app.js";

// Start the app when run directly
import { LineApp } from "./app.js";

const app = new LineApp();
app.start().catch((error) => {
  console.error("Failed to start LINE app:", error);
  process.exit(1);
});
