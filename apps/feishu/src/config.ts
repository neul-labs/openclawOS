export type FeishuAppConfig = {
  appId: string;
  appSecret: string;
  encryptKey?: string;
  verificationToken?: string;
};

export type FeishuMessageMeta = {
  openId: string;
  messageId: string;
  chatType: string;
};
