export type LineAppConfig = {
  channelAccessToken?: string;
  channelSecret?: string;
  webhookUrl?: string;
};

export type LineMessageMeta = {
  userId: string;
  replyToken?: string;
  messageId: string;
};
