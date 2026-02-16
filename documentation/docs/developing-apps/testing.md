# Testing Apps

Strategies for testing OpenClawOS applications.

## Overview

Testing apps involves:

1. **Unit tests**: Test individual functions
2. **Integration tests**: Test with mock kernel
3. **E2E tests**: Test with real kernel

## Unit Testing

Test handler functions in isolation:

```typescript
import { describe, it, expect } from "vitest";
import { processMessage } from "./handlers";

describe("processMessage", () => {
  it("normalizes whitespace", () => {
    const result = processMessage("  hello   world  ");
    expect(result).toBe("hello world");
  });

  it("handles empty input", () => {
    const result = processMessage("");
    expect(result).toBeNull();
  });
});
```

## Mocking the Kernel

Create a mock kernel client:

```typescript
import { vi } from "vitest";

function createMockKernel() {
  return {
    connect: vi.fn().mockResolvedValue(undefined),
    disconnect: vi.fn().mockResolvedValue(undefined),
    register: vi.fn().mockResolvedValue({
      appId: "@test/app",
      token: "test-token",
      protocolVersion: "1.0",
    }),
    ready: vi.fn().mockResolvedValue({ ok: true }),
    heartbeat: vi.fn().mockResolvedValue({ ok: true }),
    registerCapability: vi.fn().mockResolvedValue({
      capabilityId: "cap-1",
      granted: true,
    }),
    subscribeHooks: vi.fn().mockResolvedValue({
      subscribed: [],
      denied: [],
    }),
    queueAgent: vi.fn().mockResolvedValue({
      runId: "run-1",
      queued: true,
    }),
    onHook: vi.fn(),
  };
}
```

## Testing Channel Apps

```typescript
import { describe, it, expect, vi, beforeEach } from "vitest";
import { TelegramApp } from "./app";

describe("TelegramApp", () => {
  let app: TelegramApp;
  let mockKernel: ReturnType<typeof createMockKernel>;
  let mockBot: { sendMessage: ReturnType<typeof vi.fn> };

  beforeEach(() => {
    mockKernel = createMockKernel();
    mockBot = {
      sendMessage: vi.fn().mockResolvedValue(undefined),
    };

    // Inject mocks
    app = new TelegramApp();
    app["kernel"] = mockKernel as any;
    app["bot"] = mockBot as any;
  });

  describe("handleInbound", () => {
    it("dispatches message to kernel", async () => {
      await app["handleInbound"]({
        from: "123456",
        content: "Hello",
      });

      expect(mockKernel.queueAgent).toHaveBeenCalledWith(
        "telegram:123456",
        "Hello",
        expect.any(Object),
      );
    });

    it("ignores empty messages", async () => {
      await app["handleInbound"]({
        from: "123456",
        content: "",
      });

      expect(mockKernel.queueAgent).not.toHaveBeenCalled();
    });
  });

  describe("sendMessage", () => {
    it("sends via bot API", async () => {
      await app["sendMessage"]({
        target: "123456",
        content: "Hello!",
      });

      expect(mockBot.sendMessage).toHaveBeenCalledWith(123456, "Hello!", expect.any(Object));
    });
  });
});
```

## Testing Plugin Apps

```typescript
import { describe, it, expect, vi, beforeEach } from "vitest";
import { AnalyticsPlugin } from "./app";

describe("AnalyticsPlugin", () => {
  let app: AnalyticsPlugin;
  let mockKernel: ReturnType<typeof createMockKernel>;
  let registeredTools: Map<string, unknown>;

  beforeEach(() => {
    mockKernel = createMockKernel();
    registeredTools = new Map();

    mockKernel.registerCapability = vi.fn().mockImplementation(async (type, config) => {
      if (type === "tool") {
        registeredTools.set(config.name, config);
      }
      return { capabilityId: "cap-1", granted: true };
    });

    app = new AnalyticsPlugin();
    app["kernel"] = mockKernel as any;
  });

  it("registers analytics_summary tool", async () => {
    await app["setup"]();

    expect(registeredTools.has("analytics_summary")).toBe(true);
  });

  it("tracks agent runs via hook", async () => {
    let agentEndHandler: ((data: unknown) => void) | undefined;

    mockKernel.onHook = vi.fn().mockImplementation((event, handler) => {
      if (event === "agent_end") {
        agentEndHandler = handler;
      }
    });

    await app["setup"]();

    // Simulate agent_end hook
    agentEndHandler?.({ success: true });
    agentEndHandler?.({ success: true });
    agentEndHandler?.({ error: "failed" });

    const metrics = app["metrics"];
    expect(metrics.agentRuns).toBe(3);
    expect(metrics.errors).toBe(1);
  });
});
```

## Integration Testing

Test with a real kernel using the test harness:

```typescript
import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { createTestKernel } from "@openclawos/test-utils";

describe("Integration: TelegramApp", () => {
  let kernel: TestKernel;
  let app: TelegramApp;

  beforeAll(async () => {
    kernel = await createTestKernel();
    app = new TelegramApp({
      socketPath: kernel.socketPath,
    });
    await app.start();
  });

  afterAll(async () => {
    await app.stop();
    await kernel.stop();
  });

  it("registers channel capability", async () => {
    const channels = await kernel.getChannels();
    expect(channels).toContain("telegram");
  });

  it("queues messages for agent", async () => {
    // Simulate inbound message
    await app["handleInbound"]({
      from: "123456",
      content: "Hello",
    });

    // Check kernel received it
    const queue = await kernel.getAgentQueue();
    expect(queue).toHaveLength(1);
    expect(queue[0].content).toBe("Hello");
  });
});
```

## E2E Testing

Full end-to-end tests with real services:

```typescript
import { describe, it, expect } from "vitest";

describe("E2E: Telegram", () => {
  it("responds to messages", async () => {
    // Send test message via Telegram API
    const chatId = process.env.TEST_CHAT_ID;
    await sendTelegramMessage(chatId, "/start");

    // Wait for response
    const response = await waitForTelegramMessage(chatId, 5000);

    expect(response).toContain("Welcome");
  });
});
```

## Test Utilities

### Mock Messages

```typescript
function createMockMessage(overrides = {}) {
  return {
    from: "test-user",
    content: "Test message",
    timestamp: Date.now(),
    metadata: {},
    ...overrides,
  };
}
```

### Mock Hook Events

```typescript
function createMockHookEvent(hookName: string, data: unknown) {
  return {
    eventId: `evt-${Date.now()}`,
    hookName,
    data,
    context: {
      sessionKey: "test:session",
      timestamp: Date.now(),
    },
  };
}
```

### Wait Utilities

```typescript
async function waitFor(condition: () => boolean | Promise<boolean>, timeout = 5000): Promise<void> {
  const start = Date.now();
  while (Date.now() - start < timeout) {
    if (await condition()) return;
    await delay(100);
  }
  throw new Error("Timeout waiting for condition");
}
```

## CI/CD

### GitHub Actions

```yaml
name: Test
on: [push, pull_request]
jobs:
  test:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-node@v4
        with:
          node-version: 20
      - run: npm ci
      - run: npm test
```

### Test Coverage

```bash
vitest run --coverage
```

## Best Practices

1. **Isolate tests**: Each test should be independent
2. **Mock external services**: Don't call real APIs in unit tests
3. **Test error paths**: Verify error handling
4. **Use fixtures**: Create reusable test data
5. **Keep tests fast**: Unit tests < 100ms each

## Next Steps

- [SDK Reference](../sdk/index.md)
- [Message Flow](message-flow.md)
