/**
 * Zalo OA Channel App Entry Point
 */

export { ZaloApp } from "./app.js";

// Start the app when run directly
import { ZaloApp } from "./app.js";

const app = new ZaloApp();
app.start().catch((error) => {
  console.error("Failed to start Zalo app:", error);
  process.exit(1);
});
