/**
 * Telegram App Entry Point
 *
 * Starts the Telegram channel app and connects to the OpenClawOS kernel.
 */

import { TelegramApp } from "./app.js";

const app = new TelegramApp();

app.start().catch((err) => {
  console.error("Failed to start Telegram app:", err);
  process.exit(1);
});

// Export for programmatic use
export { TelegramApp };
export * from "./config.js";
