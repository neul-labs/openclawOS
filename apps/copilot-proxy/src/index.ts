/**
 * GitHub Copilot Proxy App Entry Point
 */

export { CopilotProxyApp } from "./app.js";

// Start the app when run directly
import { CopilotProxyApp } from "./app.js";

const app = new CopilotProxyApp();
app.start().catch((error) => {
  console.error("Failed to start Copilot Proxy app:", error);
  process.exit(1);
});
