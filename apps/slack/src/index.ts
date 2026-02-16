/**
 * Slack App Entry Point
 *
 * Starts the Slack channel app and connects to the OpenClawOS kernel.
 */

import { SlackApp } from "./app.js";

const app = new SlackApp();

app.start().catch((err) => {
  console.error("Failed to start Slack app:", err);
  process.exit(1);
});

// Export for programmatic use
export { SlackApp };
export * from "./config.js";
