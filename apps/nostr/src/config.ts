export type NostrAppConfig = {
  privateKey: string;
  relays: string[];
};

export type NostrMessageMeta = {
  pubkey: string;
  eventId: string;
  createdAt: number;
};
