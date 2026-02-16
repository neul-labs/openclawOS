/**
 * Feishu Channel App Entry Point
 */

export { FeishuApp } from "./app.js";

// Start the app when run directly
import { FeishuApp } from "./app.js";

const app = new FeishuApp();
app.start().catch((error) => {
  console.error("Failed to start Feishu app:", error);
  process.exit(1);
});
