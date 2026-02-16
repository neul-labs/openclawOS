/**
 * Nostr Channel App Entry Point
 */

export { NostrApp } from "./app.js";

// Start the app when run directly
import { NostrApp } from "./app.js";

const app = new NostrApp();
app.start().catch((error) => {
  console.error("Failed to start Nostr app:", error);
  process.exit(1);
});
