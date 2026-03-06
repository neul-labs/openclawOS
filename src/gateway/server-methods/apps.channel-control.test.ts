import { beforeEach, describe, expect, it, vi } from "vitest";

type LooseConfig = Record<string, unknown>;

let runtimeMode: "in-process" | "ipc" = "in-process";
let currentConfig: LooseConfig = {};
let writtenConfig: LooseConfig | null = null;

const setAccountEnabled = vi.fn(
  ({ cfg, accountId, enabled }: { cfg: LooseConfig; accountId: string; enabled: boolean }) => {
    const channels = (cfg.channels as LooseConfig | undefined) ?? {};
    const telegram = (channels.telegram as LooseConfig | undefined) ?? {};
    const currentAccounts = (telegram.accounts as LooseConfig | undefined) ?? {};
    if (accountId === "default") {
      return {
        ...cfg,
        channels: {
          ...channels,
          telegram: {
            ...telegram,
            enabled,
          },
        },
      };
    }
    return {
      ...cfg,
      channels: {
        ...channels,
        telegram: {
          ...telegram,
          accounts: {
            ...currentAccounts,
            [accountId]: {
              ...(currentAccounts[accountId] as LooseConfig | undefined),
              enabled,
            },
          },
        },
      },
    };
  },
);

const channelPlugin = {
  id: "telegram",
  configSchema: {
    schema: {
      type: "object",
      properties: {
        dmPolicy: { type: "string" },
      },
    },
    uiHints: {
      dmPolicy: { label: "DM Policy" },
    },
  },
  config: {
    defaultAccountId: () => "default",
    resolveAccount: (_cfg: unknown, accountId?: string | null) => {
      const channels = (currentConfig.channels as LooseConfig | undefined) ?? {};
      const section = (channels.telegram as LooseConfig | undefined) ?? {};
      const accounts = (section.accounts as LooseConfig | undefined) ?? {};
      const scoped = accountId ? (accounts[accountId] as LooseConfig | undefined) : undefined;
      const merged = { ...section, ...scoped };
      const enabled = typeof merged.enabled === "boolean" ? merged.enabled : true;
      return {
        ...merged,
        enabled,
        config: { runtime: runtimeMode },
      };
    },
    setAccountEnabled,
    isEnabled: (account: unknown) =>
      !account || typeof account !== "object"
        ? true
        : (account as { enabled?: boolean }).enabled !== false,
  },
};

const telegramPackage = {
  id: "@openclawos/telegram",
  name: "Telegram",
  type: "app",
  version: "0.1.0",
  installed: true,
  builtin: true,
  enabled: true,
  status: "stopped",
};

const registry = {
  listAvailable: vi.fn(async () => []),
  getPackage: vi.fn(async () => telegramPackage),
  getManifest: vi.fn(async () => ({
    configSchema: { type: "object", properties: { botToken: { type: "string" } } },
    configUiHints: { botToken: { label: "Bot Token" } },
  })),
  getConfig: vi.fn(async () => ({})),
  install: vi.fn(async () => ({ ok: true, packageId: "@openclawos/telegram", version: "0.1.0" })),
  uninstall: vi.fn(async () => ({ ok: true, packageId: "@openclawos/telegram" })),
  setConfig: vi.fn(async () => ({ ok: true, packageId: "@openclawos/telegram", config: {} })),
  setEnabled: vi.fn(async () => {}),
  getStatus: vi.fn(async () => "stopped"),
  startPackage: vi.fn(async () => {}),
  stopPackage: vi.fn(async () => {}),
  restartPackage: vi.fn(async () => {}),
};

vi.mock("../../packages/index.js", () => ({
  createPackageRegistry: () => registry,
}));

vi.mock("../../channels/plugins/index.js", () => ({
  getChannelPlugin: (id: string) => (id === "telegram" ? channelPlugin : null),
}));

vi.mock("../../config/config.js", () => ({
  loadConfig: () => currentConfig,
  writeConfigFile: async (cfg: LooseConfig) => {
    writtenConfig = cfg;
    currentConfig = cfg;
  },
}));

const { appsHandlers } = await import("./apps.js");

function createContext(runtimeOverride?: {
  channels?: Record<string, unknown>;
  channelAccounts?: Record<string, Record<string, unknown>>;
}) {
  return {
    startChannel: vi.fn(async () => {}),
    stopChannel: vi.fn(async () => {}),
    getRuntimeSnapshot: () => ({
      channels: {
        telegram: { accountId: "default", running: false, lastError: null },
        ...runtimeOverride?.channels,
      },
      channelAccounts: {
        telegram: {},
        ...runtimeOverride?.channelAccounts,
      },
    }),
    logGateway: {
      warn: vi.fn(),
    },
  };
}

function invokeHandler(
  params: Record<string, unknown>,
  method: keyof typeof appsHandlers,
  context: unknown,
) {
  let ok: boolean | null = null;
  let payload: unknown;
  let error: unknown;
  return appsHandlers[method]({
    params,
    context,
    respond: (success, result, err) => {
      ok = success;
      payload = result;
      error = err;
    },
  } as never).then(() => ({ ok, payload, error }));
}

describe("apps channel control-plane behavior", () => {
  beforeEach(() => {
    runtimeMode = "in-process";
    currentConfig = { channels: { telegram: { enabled: true } }, apps: {} };
    writtenConfig = null;
    setAccountEnabled.mockClear();
    registry.setConfig.mockClear();
    registry.install.mockClear();
    registry.uninstall.mockClear();
    registry.startPackage.mockClear();
    registry.stopPackage.mockClear();
    registry.restartPackage.mockClear();
    registry.listAvailable.mockReset();
    registry.getPackage.mockReset().mockResolvedValue(telegramPackage);
    registry.getManifest.mockReset().mockResolvedValue({
      configSchema: { type: "object", properties: { botToken: { type: "string" } } },
      configUiHints: { botToken: { label: "Bot Token" } },
    });
  });

  it("apps.configure writes to channels.<id> for channel apps", async () => {
    const context = createContext();
    const res = await invokeHandler(
      { packageId: "@openclawos/telegram", config: { botToken: "test-token" }, merge: true },
      "apps.configure",
      context,
    );

    expect(res.ok).toBe(true);
    expect(registry.setConfig).not.toHaveBeenCalled();
    expect(writtenConfig).toMatchObject({
      channels: {
        telegram: {
          enabled: true,
          botToken: "test-token",
        },
      },
    });
    expect(res.payload).toMatchObject({
      ok: true,
      packageId: "@openclawos/telegram",
      config: { enabled: true, botToken: "test-token" },
    });
  });

  it("apps.start uses in-process channel lifecycle when runtime is in-process", async () => {
    runtimeMode = "in-process";
    const context = createContext();
    const res = await invokeHandler({ packageId: "@openclawos/telegram" }, "apps.start", context);

    expect(res.ok).toBe(true);
    expect(context.startChannel).toHaveBeenCalledWith("telegram", undefined);
    expect(registry.startPackage).not.toHaveBeenCalled();
  });

  it("apps.start uses registry lifecycle when runtime is ipc", async () => {
    runtimeMode = "ipc";
    const context = createContext();
    const res = await invokeHandler({ packageId: "@openclawos/telegram" }, "apps.start", context);

    expect(res.ok).toBe(true);
    expect(context.startChannel).not.toHaveBeenCalled();
    expect(registry.startPackage).toHaveBeenCalledWith("@openclawos/telegram");
  });

  it("apps.setEnabled persists apps override and channel enabled state", async () => {
    runtimeMode = "in-process";
    const context = createContext();
    const res = await invokeHandler(
      { packageId: "@openclawos/telegram", enabled: false },
      "apps.setEnabled",
      context,
    );

    expect(res.ok).toBe(true);
    expect(setAccountEnabled).toHaveBeenCalledTimes(1);
    expect(writtenConfig).toMatchObject({
      apps: {
        "@openclawos/telegram": { enabled: false },
      },
      channels: {
        telegram: {
          enabled: false,
        },
      },
    });
    expect(context.stopChannel).toHaveBeenCalledWith("telegram", undefined);
  });

  it("apps.setEnabled with accountId updates only that account and targets account lifecycle", async () => {
    runtimeMode = "in-process";
    currentConfig = {
      channels: {
        telegram: {
          enabled: true,
          accounts: {
            alerts: { enabled: true, dmPolicy: "allowlist" },
          },
        },
      },
      apps: {},
    };
    const context = createContext();
    const res = await invokeHandler(
      { packageId: "@openclawos/telegram", accountId: "alerts", enabled: false },
      "apps.setEnabled",
      context,
    );

    expect(res.ok).toBe(true);
    expect(setAccountEnabled).toHaveBeenCalledWith(
      expect.objectContaining({ accountId: "alerts", enabled: false }),
    );
    expect(writtenConfig).toMatchObject({
      apps: {},
      channels: {
        telegram: {
          enabled: true,
          accounts: {
            alerts: {
              enabled: false,
              dmPolicy: "allowlist",
            },
          },
        },
      },
    });
    expect(context.stopChannel).toHaveBeenCalledWith("telegram", "alerts");
  });

  it("apps.install for channel app writes canonical config and starts in-process lifecycle", async () => {
    runtimeMode = "in-process";
    const context = createContext();
    const res = await invokeHandler({ packageId: "@openclawos/telegram" }, "apps.install", context);

    expect(res.ok).toBe(true);
    expect(registry.install).not.toHaveBeenCalled();
    expect(context.startChannel).toHaveBeenCalledWith("telegram", undefined);
    expect(writtenConfig).toMatchObject({
      apps: { "@openclawos/telegram": { enabled: true } },
      channels: { telegram: { enabled: true } },
    });
    expect(res.payload).toMatchObject({
      ok: true,
      packageId: "@openclawos/telegram",
      version: "0.1.0",
    });
  });

  it("apps.install with accountId enables only that account without global app override", async () => {
    runtimeMode = "in-process";
    currentConfig = {
      channels: {
        telegram: {
          enabled: true,
          accounts: {
            alerts: { enabled: false },
          },
        },
      },
      apps: {},
    };
    const context = createContext();
    const res = await invokeHandler(
      { packageId: "@openclawos/telegram", accountId: "alerts" },
      "apps.install",
      context,
    );

    expect(res.ok).toBe(true);
    expect(writtenConfig).toMatchObject({
      apps: {},
      channels: {
        telegram: {
          accounts: {
            alerts: { enabled: true },
          },
        },
      },
    });
    expect(context.startChannel).toHaveBeenCalledWith("telegram", "alerts");
  });

  it("apps.uninstall for channel app writes canonical config and stops ipc lifecycle", async () => {
    runtimeMode = "ipc";
    currentConfig = {
      channels: { telegram: { enabled: true } },
      apps: { "@openclawos/telegram": { enabled: true } },
    };
    const context = createContext();
    const res = await invokeHandler(
      { packageId: "@openclawos/telegram", purgeData: true },
      "apps.uninstall",
      context,
    );

    expect(res.ok).toBe(true);
    expect(registry.uninstall).not.toHaveBeenCalled();
    expect(registry.stopPackage).toHaveBeenCalledWith("@openclawos/telegram");
    expect(context.stopChannel).not.toHaveBeenCalled();
    expect(writtenConfig).toMatchObject({
      apps: { "@openclawos/telegram": { enabled: false } },
      channels: { telegram: { enabled: false } },
    });
    expect(res.payload).toMatchObject({
      ok: true,
      packageId: "@openclawos/telegram",
      dataPurged: false,
    });
  });

  it("apps.uninstall with accountId disables only that account", async () => {
    runtimeMode = "in-process";
    currentConfig = {
      channels: {
        telegram: {
          enabled: true,
          accounts: {
            alerts: { enabled: true, dmPolicy: "allowlist" },
          },
        },
      },
      apps: {},
    };
    const context = createContext();
    const res = await invokeHandler(
      { packageId: "@openclawos/telegram", accountId: "alerts" },
      "apps.uninstall",
      context,
    );

    expect(res.ok).toBe(true);
    expect(writtenConfig).toMatchObject({
      apps: {},
      channels: {
        telegram: {
          enabled: true,
          accounts: {
            alerts: {
              enabled: false,
              dmPolicy: "allowlist",
            },
          },
        },
      },
    });
    expect(context.stopChannel).toHaveBeenCalledWith("telegram", "alerts");
  });

  it("apps.list applies enabled filter after channel-aware adaptation", async () => {
    runtimeMode = "in-process";
    currentConfig = {
      channels: { telegram: { enabled: true } },
      apps: { "@openclawos/telegram": { enabled: false } },
    };
    registry.listAvailable.mockResolvedValue([telegramPackage]);
    const context = createContext();

    const res = await invokeHandler({ enabled: false }, "apps.list", context);

    expect(res.ok).toBe(true);
    expect(registry.listAvailable).toHaveBeenCalledWith(
      expect.objectContaining({ enabled: undefined }),
    );
    expect(
      (res.payload as { packages: Array<{ id: string; enabled?: boolean }> }).packages,
    ).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ id: "@openclawos/telegram", enabled: false }),
      ]),
    );
  });

  it("apps.list uses accountId scope for channel-enabled adaptation", async () => {
    runtimeMode = "in-process";
    currentConfig = {
      channels: {
        telegram: {
          enabled: true,
          accounts: {
            alerts: { enabled: false },
          },
        },
      },
      apps: {},
    };
    registry.listAvailable.mockResolvedValue([telegramPackage]);
    const context = createContext();

    const scoped = await invokeHandler(
      { accountId: "alerts", enabled: false },
      "apps.list",
      context,
    );
    expect(scoped.ok).toBe(true);
    expect(
      (scoped.payload as { packages: Array<{ id: string; enabled?: boolean }> }).packages,
    ).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ id: "@openclawos/telegram", enabled: false }),
      ]),
    );

    const unscoped = await invokeHandler({ enabled: true }, "apps.list", context);
    expect(unscoped.ok).toBe(true);
    expect(
      (unscoped.payload as { packages: Array<{ id: string; enabled?: boolean }> }).packages,
    ).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ id: "@openclawos/telegram", enabled: true }),
      ]),
    );
  });

  it("apps.configure supports account-scoped channel config writes", async () => {
    runtimeMode = "in-process";
    currentConfig = {
      channels: {
        telegram: {
          enabled: true,
          dmPolicy: "pairing",
          accounts: {
            alerts: { enabled: true, dmPolicy: "allowlist" },
          },
        },
      },
      apps: {},
    };
    const context = createContext();
    const res = await invokeHandler(
      {
        packageId: "@openclawos/telegram",
        accountId: "alerts",
        config: { dmPolicy: "open" },
        merge: true,
      },
      "apps.configure",
      context,
    );

    expect(res.ok).toBe(true);
    expect(writtenConfig).toMatchObject({
      channels: {
        telegram: {
          dmPolicy: "pairing",
          accounts: {
            alerts: {
              enabled: true,
              dmPolicy: "open",
            },
          },
        },
      },
    });
    expect(res.payload).toMatchObject({
      ok: true,
      config: {
        enabled: true,
        dmPolicy: "open",
      },
    });
  });

  it("apps.getConfig supports account-scoped merged channel config", async () => {
    currentConfig = {
      channels: {
        telegram: {
          enabled: true,
          dmPolicy: "pairing",
          accounts: {
            alerts: { enabled: true, dmPolicy: "allowlist" },
          },
        },
      },
      apps: {},
    };
    const context = createContext();
    const res = await invokeHandler(
      { packageId: "@openclawos/telegram", accountId: "alerts" },
      "apps.getConfig",
      context,
    );

    expect(res.ok).toBe(true);
    expect(res.payload).toMatchObject({
      config: {
        enabled: true,
        dmPolicy: "allowlist",
      },
    });
  });

  it("apps.info uses channel plugin config schema when available", async () => {
    const context = createContext();
    const res = await invokeHandler({ packageId: "@openclawos/telegram" }, "apps.info", context);

    expect(res.ok).toBe(true);
    expect(res.payload).toMatchObject({
      configSchema: channelPlugin.configSchema.schema,
      configUiHints: channelPlugin.configSchema.uiHints,
    });
  });

  it("apps.info accepts accountId and returns account-aware config", async () => {
    currentConfig = {
      channels: {
        telegram: {
          enabled: true,
          dmPolicy: "pairing",
          accounts: {
            alerts: { enabled: false, dmPolicy: "allowlist" },
          },
        },
      },
      apps: {},
    };
    const context = createContext();
    const res = await invokeHandler(
      { packageId: "@openclawos/telegram", accountId: "alerts" },
      "apps.info",
      context,
    );

    expect(res.ok).toBe(true);
    expect(res.payload).toMatchObject({
      config: {
        enabled: false,
        dmPolicy: "allowlist",
      },
    });
  });

  it("apps.start forwards accountId to in-process channel lifecycle", async () => {
    runtimeMode = "in-process";
    const context = createContext();
    const res = await invokeHandler(
      { packageId: "@openclawos/telegram", accountId: "alerts" },
      "apps.start",
      context,
    );

    expect(res.ok).toBe(true);
    expect(context.startChannel).toHaveBeenCalledWith("telegram", "alerts");
  });

  it("apps.status with accountId reflects account runtime and enabled state", async () => {
    runtimeMode = "in-process";
    currentConfig = {
      channels: {
        telegram: {
          enabled: true,
          accounts: {
            alerts: { enabled: false },
          },
        },
      },
      apps: {},
    };
    const context = createContext({
      channelAccounts: {
        telegram: {
          alerts: {
            accountId: "alerts",
            running: false,
            lastError: "disabled",
            lastStartAt: 123,
            restartCount: 2,
          },
        },
      },
    });
    const res = await invokeHandler(
      { packageId: "@openclawos/telegram", accountId: "alerts" },
      "apps.status",
      context,
    );

    expect(res.ok).toBe(true);
    expect(res.payload).toMatchObject({
      packageId: "@openclawos/telegram",
      status: "stopped",
      enabled: false,
      lastError: "disabled",
      startedAt: 123,
      restartCount: 2,
    });
  });
});
