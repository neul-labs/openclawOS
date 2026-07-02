# @openclawos/sdk

**The SDK for building apps, skills, agents, and extensions on [OpenClawOS](https://github.com/neul-labs/openclawOS)** — an OS-like architecture for self-hosted AI assistants.

[![npm](https://img.shields.io/npm/v/@openclawos/sdk.svg)](https://www.npmjs.com/package/@openclawos/sdk)
[![License](https://img.shields.io/badge/License-MIT-blue.svg)](https://github.com/neul-labs/openclawOS/blob/main/LICENSE)

Part of [OpenClawOS](https://github.com/neul-labs/openclawOS), a community fork of [OpenClaw](https://github.com/openclaw/openclaw) by [Neul Labs](https://www.neullabs.com). The SDK provides the `ChannelApp`, `KernelClient`, skill, agent, and extension primitives used to build process-isolated apps that run on the OpenClawOS kernel.

## Installation

```bash
npm install @openclawos/sdk
```

## Usage

```typescript
import { ChannelApp } from "@openclawos/sdk/app";

class MyChannelApp extends ChannelApp {
  protected channelId = "mychannel";
  manifest = { /* ... */ };

  protected async setupChannel(): Promise<void> {
    // Initialize channel connection
  }

  protected async handleInbound(event): Promise<void> {
    await this.dispatchInbound(event.from, event.content);
  }

  protected async sendMessage(params): Promise<void> {
    // Send via platform API
  }
}

new MyChannelApp().start();
```

## Links

- [Website](https://openclawos.neullabs.com)
- [Documentation](https://docs.neullabs.com/openclawos)
- [GitHub](https://github.com/neul-labs/openclawOS)
- Related packages: [`@openclawos/kernel`](https://www.npmjs.com/package/@openclawos/kernel), [`@openclawos/protocol`](https://www.npmjs.com/package/@openclawos/protocol)

## License

MIT
