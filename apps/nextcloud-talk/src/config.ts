export type NextcloudTalkAppConfig = {
  serverUrl?: string;
  username?: string;
  appPassword?: string;
};

export type NextcloudTalkMessageMeta = {
  conversationId: string;
  conversationName?: string;
  senderDisplayName: string;
  senderId: string;
  isGroup: boolean;
  messageId: string;
  timestamp?: number;
};
