export type MattermostAppConfig = {
  serverUrl?: string;
  botToken?: string;
  personalAccessToken?: string;
  username?: string;
  password?: string;
};

export type MattermostMessageMeta = {
  channelId: string;
  userId: string;
  messageId: string;
  timestamp: number;
  isDirectMessage: boolean;
};
