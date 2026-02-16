export type ZaloAppConfig = {
  appId?: string;
  secretKey?: string;
  accessToken?: string;
  refreshToken?: string;
};

export type ZaloMessageMeta = {
  userId: string;
  messageId: string;
};
