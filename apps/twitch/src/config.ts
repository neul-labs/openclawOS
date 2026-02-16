export type TwitchAppConfig = {
  clientId?: string;
  clientSecret?: string;
  accessToken?: string;
  refreshToken?: string;
  channels?: string[];
};

export type TwitchMessageMeta = {
  channel: string;
  userId: string;
  userName: string;
  userDisplayName: string;
  messageId: string;
  isGroup: boolean;
};
