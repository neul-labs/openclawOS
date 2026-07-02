# @openclawos/protocol

**IPC protocol types and schemas for [OpenClawOS](https://github.com/neul-labs/openclawOS)** — the wire format that connects the kernel and its process-isolated apps.

[![npm](https://img.shields.io/npm/v/@openclawos/protocol.svg)](https://www.npmjs.com/package/@openclawos/protocol)
[![License](https://img.shields.io/badge/License-MIT-blue.svg)](https://github.com/neul-labs/openclawOS/blob/main/LICENSE)

Part of [OpenClawOS](https://github.com/neul-labs/openclawOS), a community fork of [OpenClaw](https://github.com/openclaw/openclaw) by [Neul Labs](https://www.neullabs.com). This package defines the IPC message types, manifest schema, and capability definitions shared by the kernel and the SDK.

## Installation

```bash
npm install @openclawos/protocol
```

## Exports

- `@openclawos/protocol` — protocol entry point
- `@openclawos/protocol/messages` — IPC message types
- `@openclawos/protocol/manifest` — app manifest schema
- `@openclawos/protocol/capabilities` — capability definitions

## Links

- [Website](https://openclawos.neullabs.com)
- [Documentation](https://docs.neullabs.com/openclawos)
- [GitHub](https://github.com/neul-labs/openclawOS)
- Related packages: [`@openclawos/sdk`](https://www.npmjs.com/package/@openclawos/sdk), [`@openclawos/kernel`](https://www.npmjs.com/package/@openclawos/kernel)

## License

MIT
