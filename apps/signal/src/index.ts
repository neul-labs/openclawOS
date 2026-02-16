/**
 * Signal App Entry Point
 *
 * Starts the Signal channel app and connects to the OpenClawOS kernel.
 */

import { SignalApp } from "./app.js";

const app = new SignalApp();

app.start().catch((err) => {
  console.error("Failed to start Signal app:", err);
  process.exit(1);
});

// Export for programmatic use
export { SignalApp };
export * from "./config.js";
