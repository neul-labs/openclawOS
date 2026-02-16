/**
 * Tlon (Urbit) Channel App Entry Point
 */

export { TlonApp } from "./app.js";

// Start the app when run directly
import { TlonApp } from "./app.js";

const app = new TlonApp();
app.start().catch((error) => {
  console.error("Failed to start Tlon app:", error);
  process.exit(1);
});
