import { describe, expect, it, vi } from "vitest";
import {
  configurePackage,
  confirmInstall,
  installPackage,
  loadPackageDetails,
  restartPackage,
  saveSelectedPackageConfig,
  setPackageEnabled,
  startPackage,
  stopPackage,
  uninstallPackage,
  updateConfigDraft,
  type AppStoreState,
} from "./appstore.ts";

function createState(
  request: (method: string, params: Record<string, unknown>) => Promise<unknown>,
) {
  return {
    client: { request },
    connected: true,
    appstoreLoading: false,
    appstorePackages: [],
    appstoreError: null,
    appstoreFilter: "",
    appstoreCategory: "all",
    appstoreSelectedId: null,
    appstoreBusyKey: null,
    appstoreMessages: {},
    appstoreInstallPending: null,
    appstoreDetailsLoading: false,
    appstoreDetailsError: null,
    appstoreDetails: null,
    appstoreConfigDraft: "{}",
    appstoreConfigDirty: false,
    appstoreSelectedScopeAccountId: null,
  } as unknown as AppStoreState;
}

describe("appstore controller account scope", () => {
  it("forwards accountId for package actions", async () => {
    const request = vi.fn(async (method: string) => {
      if (method === "apps.list") {
        return { packages: [] };
      }
      return { ok: true };
    });
    const state = createState(request);
    const packageId = "@openclawos/telegram";
    const scope = { accountId: "alerts" };

    await installPackage(state, packageId, scope);
    expect(request.mock.calls[0]).toEqual(["apps.install", { packageId, accountId: "alerts" }]);

    await uninstallPackage(state, packageId, true, scope);
    expect(request.mock.calls[2]).toEqual([
      "apps.uninstall",
      { packageId, purgeData: true, accountId: "alerts" },
    ]);

    await setPackageEnabled(state, packageId, false, scope);
    expect(request.mock.calls[4]).toEqual([
      "apps.setEnabled",
      { packageId, enabled: false, accountId: "alerts" },
    ]);

    await configurePackage(state, packageId, { dmPolicy: "allowlist" }, scope);
    expect(request.mock.calls[6]).toEqual([
      "apps.configure",
      { packageId, config: { dmPolicy: "allowlist" }, accountId: "alerts" },
    ]);

    await startPackage(state, packageId, scope);
    expect(request.mock.calls[8]).toEqual(["apps.start", { packageId, accountId: "alerts" }]);

    await stopPackage(state, packageId, scope);
    expect(request.mock.calls[10]).toEqual(["apps.stop", { packageId, accountId: "alerts" }]);

    await restartPackage(state, packageId, scope);
    expect(request.mock.calls[12]).toEqual(["apps.restart", { packageId, accountId: "alerts" }]);
  });

  it("omits accountId when scope is empty or whitespace", async () => {
    const request = vi.fn(async (method: string) => {
      if (method === "apps.list") {
        return { packages: [] };
      }
      return { ok: true };
    });
    const state = createState(request);
    const packageId = "@openclawos/telegram";

    await configurePackage(state, packageId, { dmPolicy: "open" }, { accountId: "  " });

    expect(request.mock.calls[0]).toEqual([
      "apps.configure",
      { packageId, config: { dmPolicy: "open" } },
    ]);
  });

  it("confirmInstall forwards scope to installPackage", async () => {
    const request = vi.fn(async (method: string) => {
      if (method === "apps.list") {
        return { packages: [] };
      }
      return { ok: true };
    });
    const state = createState(request);
    state.appstoreInstallPending = {
      id: "@openclawos/telegram",
      name: "Telegram",
      type: "app",
      version: "0.1.0",
      installed: false,
      builtin: true,
    } as never;

    await confirmInstall(state, { accountId: "alerts" });

    expect(request.mock.calls[0]).toEqual([
      "apps.install",
      { packageId: "@openclawos/telegram", accountId: "alerts" },
    ]);
    expect(state.appstoreInstallPending).toBeNull();
  });

  it("loadPackageDetails forwards accountId to apps.info", async () => {
    const request = vi.fn(async (method: string) => {
      if (method === "apps.info") {
        return {
          package: {
            id: "@openclawos/telegram",
            name: "Telegram",
            type: "app",
            version: "0.1.0",
            installed: true,
            builtin: true,
          },
          config: { dmPolicy: "allowlist" },
        };
      }
      return { ok: true };
    });
    const state = createState(request);

    await loadPackageDetails(state, "@openclawos/telegram", { accountId: "alerts" });

    expect(request.mock.calls[0]).toEqual([
      "apps.info",
      { packageId: "@openclawos/telegram", accountId: "alerts" },
    ]);
    expect(state.appstoreDetails?.config).toEqual({ dmPolicy: "allowlist" });
    expect(state.appstoreSelectedScopeAccountId).toBe("alerts");
  });

  it("saveSelectedPackageConfig sends scoped apps.configure from draft", async () => {
    const request = vi.fn(async (method: string) => {
      if (method === "apps.info") {
        return {
          package: {
            id: "@openclawos/telegram",
            name: "Telegram",
            type: "app",
            version: "0.1.0",
            installed: true,
            builtin: true,
          },
          config: { dmPolicy: "allowlist" },
        };
      }
      if (method === "apps.list") {
        return { packages: [] };
      }
      return { ok: true };
    });
    const state = createState(request);
    await loadPackageDetails(state, "@openclawos/telegram", { accountId: "alerts" });
    updateConfigDraft(state, JSON.stringify({ dmPolicy: "open" }));

    await saveSelectedPackageConfig(state, { accountId: "alerts" });

    const configureCall = request.mock.calls.find(([method]) => method === "apps.configure");
    expect(configureCall).toEqual([
      "apps.configure",
      {
        packageId: "@openclawos/telegram",
        config: { dmPolicy: "open" },
        accountId: "alerts",
      },
    ]);
  });
});
