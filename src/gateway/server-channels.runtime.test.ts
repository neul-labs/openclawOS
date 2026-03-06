import { describe, expect, it, vi } from "vitest";

const startAccount = vi.fn(async () => {});

const plugin = {
  id: "telegram",
  config: {
    listAccountIds: () => ["default"],
    resolveAccount: () => ({
      enabled: true,
      config: { runtime: "ipc" as const },
    }),
    isEnabled: () => true,
    isConfigured: async () => true,
    describeAccount: () => ({ configured: true }),
  },
  gateway: {
    startAccount,
  },
  status: {
    defaultRuntime: {
      accountId: "default",
      running: false,
      lastStartAt: null,
      lastStopAt: null,
      lastError: null,
    },
  },
};

vi.mock("../channels/plugins/index.js", () => ({
  getChannelPlugin: () => plugin,
  listChannelPlugins: () => [plugin],
}));

vi.mock("../channels/plugins/helpers.js", () => ({
  resolveChannelDefaultAccountId: () => "default",
}));

vi.mock("../infra/outbound/target-resolver.js", () => ({
  resetDirectoryCache: () => {},
}));

const { createChannelManager } = await import("./server-channels.js");

describe("createChannelManager runtime mode", () => {
  it("skips in-process startup when resolved account config runtime is ipc", async () => {
    startAccount.mockClear();

    const manager = createChannelManager({
      loadConfig: () => ({ channels: { telegram: { runtime: "ipc" } } }) as never,
      channelLogs: { telegram: { info: vi.fn() } } as never,
      channelRuntimeEnvs: { telegram: {} } as never,
    });

    await manager.startChannels();

    expect(startAccount).not.toHaveBeenCalled();

    const snapshot = manager.getRuntimeSnapshot();
    expect(snapshot.channels.telegram).toMatchObject({
      accountId: "default",
      running: false,
      mode: "ipc",
    });
    expect(snapshot.channelAccounts.telegram?.default).toMatchObject({
      mode: "ipc",
      running: false,
    });
  });
});
