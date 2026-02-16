/**
 * IPC Module
 *
 * Unix domain socket server and connection handling for kernel-app communication.
 */

export { IPCServer, type IPCServerOptions, type IPCServerEvents } from "./server.js";
export { IPCConnection, type IPCMethodHandler, type IPCConnectionEvents } from "./connection.js";
export { registerCoreHandlers, type HandlerDependencies } from "./handlers.js";
