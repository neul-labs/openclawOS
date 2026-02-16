export type MSTeamsAppConfig = {
  appId?: string;
  appPassword?: string;
  tenantId?: string;
};

export type MSTeamsMessageMeta = {
  conversationId: string;
  senderId: string;
  senderName?: string;
  messageId: string;
  channelId?: string;
  teamId?: string;
};
