import type {
  ChannelAccountSnapshot,
  ChannelsStatusSnapshot,
  ConfigUiHints,
  NostrProfile,
} from "../types.ts";

export type ChannelKey = string;

/**
 * NostrProfileFormState is kept for API compatibility with app-channels.ts
 * functions that manage Nostr profile editing state.
 */
export interface NostrProfileFormState {
  values: NostrProfile;
  original: NostrProfile;
  saving: boolean;
  importing: boolean;
  error: string | null;
  success: string | null;
  fieldErrors: Record<string, string>;
  showAdvanced: boolean;
}

export type ChannelsProps = {
  connected: boolean;
  loading: boolean;
  snapshot: ChannelsStatusSnapshot | null;
  lastError: string | null;
  lastSuccessAt: number | null;
  configSchema: unknown;
  configSchemaLoading: boolean;
  configForm: Record<string, unknown> | null;
  configUiHints: ConfigUiHints;
  configSaving: boolean;
  configFormDirty: boolean;
  onRefresh: (probe: boolean) => void;
  onConfigPatch: (path: Array<string | number>, value: unknown) => void;
  onConfigSave: () => void;
  onConfigReload: () => void;
};
