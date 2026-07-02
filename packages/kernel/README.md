# @openclawos/kernel

**The kernel for [OpenClawOS](https://github.com/neul-labs/openclawOS)** — IPC server, process supervisor, and app registry for self-hosted AI assistants.

[![npm](https://img.shields.io/npm/v/@openclawos/kernel.svg)](https://www.npmjs.com/package/@openclawos/kernel)
[![License](https://img.shields.io/badge/License-MIT-blue.svg)](https://github.com/neul-labs/openclawOS/blob/main/LICENSE)

Part of [OpenClawOS](https://github.com/neul-labs/openclawOS), a community fork of [OpenClaw](https://github.com/openclaw/openclaw) by [Neul Labs](https://www.neullabs.com). The kernel is the core supervisor: it hosts the IPC server, spawns and manages process-isolated apps, and maintains the app registry that routes messages across channels.

## Installation

```bash
npm install @openclawos/kernel
```

## Exports

- `@openclawos/kernel` — kernel entry point
- `@openclawos/kernel/ipc` — IPC server
- `@openclawos/kernel/supervisor` — process supervisor
- `@openclawos/kernel/registry` — app registry

## Links

- [Website](https://openclawos.neullabs.com)
- [Documentation](https://docs.neullabs.com/openclawos)
- [GitHub](https://github.com/neul-labs/openclawOS)
- Related packages: [`@openclawos/sdk`](https://www.npmjs.com/package/@openclawos/sdk), [`@openclawos/protocol`](https://www.npmjs.com/package/@openclawos/protocol)

## License

MIT
