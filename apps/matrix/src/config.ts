export type MatrixAppConfig = {
  homeserver?: string;
  userId?: string;
  accessToken?: string;
  password?: string;
  deviceName?: string;
  initialSyncLimit?: number;
};

export type MatrixMessageMeta = {
  roomId: string;
  eventId: string;
  senderId: string;
  isGroup: boolean;
  threadId?: string;
};
