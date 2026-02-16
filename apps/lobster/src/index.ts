/**
 * Lobster App Entry Point
 */

export { LobsterApp } from "./app.js";

// Start the app when run directly
import { LobsterApp } from "./app.js";

const app = new LobsterApp();
app.start().catch((error) => {
  console.error("Failed to start Lobster app:", error);
  process.exit(1);
});
