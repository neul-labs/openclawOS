/**
 * LLM Task App Entry Point
 */

export { LlmTaskApp } from "./app.js";

// Start the app when run directly
import { LlmTaskApp } from "./app.js";

const app = new LlmTaskApp();
app.start().catch((error) => {
  console.error("Failed to start LLM Task app:", error);
  process.exit(1);
});
