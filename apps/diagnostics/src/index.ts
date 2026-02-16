/**
 * Diagnostics App Entry Point
 */

export { DiagnosticsApp } from "./app.js";

// Start the app when run directly
import { DiagnosticsApp } from "./app.js";

const app = new DiagnosticsApp();
app.start().catch((error) => {
  console.error("Failed to start diagnostics app:", error);
  process.exit(1);
});
