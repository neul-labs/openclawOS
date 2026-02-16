export type GoogleChatAppConfig = {
  serviceAccountKey?: string;
  projectId?: string;
};

export type GoogleChatMessageMeta = {
  spaceId: string;
  senderId: string;
  senderName: string;
  messageId: string;
  threadId?: string;
};
