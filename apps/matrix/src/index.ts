/**
 * Matrix Channel App Entry Point
 */

export { MatrixApp } from "./app.js";

// Start the app when run directly
import { MatrixApp } from "./app.js";

const app = new MatrixApp();
app.start().catch((error) => {
  console.error("Failed to start Matrix app:", error);
  process.exit(1);
});
