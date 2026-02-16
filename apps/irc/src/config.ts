export type IrcAppConfig = {
  host?: string;
  port?: number;
  tls?: boolean;
  nick?: string;
  username?: string;
  realname?: string;
  password?: string;
  passwordFile?: string;
  nickserv?: {
    enabled?: boolean;
    service?: string;
    password?: string;
    register?: boolean;
    registerEmail?: string;
  };
  channels?: string[];
};

export type IrcMessageMeta = {
  target: string;
  senderNick: string;
  senderUser?: string;
  senderHost?: string;
  isGroup: boolean;
  messageId: string;
};

export function isChannelTarget(target: string): boolean {
  return target.startsWith("#") || target.startsWith("&");
}
