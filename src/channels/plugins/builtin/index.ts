/**
 * Built-in Channel Plugins
 *
 * Re-exports channel plugins from extensions for use in tests and in-process mode.
 * These are the in-process ChannelPlugin implementations, NOT the IPC-based apps.
 *
 * Note: For production use, prefer IPC mode with apps/ implementations.
 * These exports exist for:
 * - Backwards compatibility with runtime: "in-process" config
 * - Unit tests that need channel plugin behavior
 *
 * @deprecated Use IPC mode (apps/) for new development
 */

// Telegram
export { telegramPlugin } from "../../../../extensions/telegram/src/channel.js";
export {
  getTelegramRuntime,
  setTelegramRuntime,
} from "../../../../extensions/telegram/src/runtime.js";

// Discord
export { discordPlugin } from "../../../../extensions/discord/src/channel.js";
export {
  getDiscordRuntime,
  setDiscordRuntime,
} from "../../../../extensions/discord/src/runtime.js";

// Slack
export { slackPlugin } from "../../../../extensions/slack/src/channel.js";
export { getSlackRuntime, setSlackRuntime } from "../../../../extensions/slack/src/runtime.js";

// WhatsApp
export { whatsappPlugin } from "../../../../extensions/whatsapp/src/channel.js";
export {
  getWhatsAppRuntime,
  setWhatsAppRuntime,
} from "../../../../extensions/whatsapp/src/runtime.js";

// Signal
export { signalPlugin } from "../../../../extensions/signal/src/channel.js";
export { getSignalRuntime, setSignalRuntime } from "../../../../extensions/signal/src/runtime.js";

// iMessage
export { imessagePlugin } from "../../../../extensions/imessage/src/channel.js";
export {
  getIMessageRuntime,
  setIMessageRuntime,
} from "../../../../extensions/imessage/src/runtime.js";
