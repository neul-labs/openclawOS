import { describe, expect, it } from "vitest";
import type { AppViewState } from "./app-view-state.ts";
import { resolveAppStoreScope } from "./app-render.ts";

function createState(): AppViewState {
  return {
    appstoreAccountScopeByChannel: {},
    channelsSnapshot: {
      ts: Date.now(),
      channelOrder: [],
      channelLabels: {},
      channels: {},
      channelAccounts: {},
      channelDefaultAccountId: {},
    },
  } as unknown as AppViewState;
}

describe("resolveAppStoreScope", () => {
  it("prefers explicit appstore channel scope override", () => {
    const state = createState();
    state.appstoreAccountScopeByChannel = { telegram: "alerts" };
    state.channelsSnapshot!.channelDefaultAccountId.telegram = "default";

    expect(resolveAppStoreScope(state, "@openclawos/telegram")).toEqual({ accountId: "alerts" });
  });

  it("falls back to channel default account", () => {
    const state = createState();
    state.channelsSnapshot!.channelDefaultAccountId.telegram = "default";

    expect(resolveAppStoreScope(state, "@openclawos/telegram")).toEqual({ accountId: "default" });
  });

  it("falls back to first known channel account when no default is present", () => {
    const state = createState();
    state.channelsSnapshot!.channelAccounts.telegram = [{ accountId: "ops-bot" }] as never;

    expect(resolveAppStoreScope(state, "@openclawos/telegram")).toEqual({ accountId: "ops-bot" });
  });

  it("returns undefined for non-channel package ids", () => {
    const state = createState();

    expect(resolveAppStoreScope(state, "community/pkg")).toBeUndefined();
  });
});
