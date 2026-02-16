/**
 * WhatsApp App Entry Point
 *
 * Starts the WhatsApp channel app and connects to the OpenClawOS kernel.
 */

import { WhatsAppApp } from "./app.js";

const app = new WhatsAppApp();

app.start().catch((err) => {
  console.error("Failed to start WhatsApp app:", err);
  process.exit(1);
});

// Export for programmatic use
export { WhatsAppApp };
export * from "./config.js";
