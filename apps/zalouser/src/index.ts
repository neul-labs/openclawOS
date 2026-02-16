/**
 * Zalo User Channel App Entry Point
 */

export { ZalouserApp } from "./app.js";

// Start the app when run directly
import { ZalouserApp } from "./app.js";

const app = new ZalouserApp();
app.start().catch((error) => {
  console.error("Failed to start Zalo User app:", error);
  process.exit(1);
});
