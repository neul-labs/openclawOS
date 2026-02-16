/**
 * Discord App Entry Point
 *
 * Starts the Discord channel app and connects to the OpenClawOS kernel.
 */

import { DiscordApp } from "./app.js";

const app = new DiscordApp();

app.start().catch((err) => {
  console.error("Failed to start Discord app:", err);
  process.exit(1);
});

// Export for programmatic use
export { DiscordApp };
export * from "./config.js";
