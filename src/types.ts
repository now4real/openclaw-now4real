export type Now4realUser = {
  id: string;
  displayName: string;
  jwtSub?: string;
  authProvider?: string;
};

export type Now4realMessage = {
  id: string;
  time?: string;
  user: Now4realUser;
  content: string;
  replyMessageId?: string;
};

export type Now4realWebhookRequest = {
  context: {
    site: string;
    page: string;
  };
  chat: {
    messages: Now4realMessage[];
  };
  newMessage: Now4realMessage;
};

export type Now4realWebhookResponse = {
  user?: {
    displayName: string;
    displayIcon?: string;
  };
  newMessages?: Array<{
    content: string;
    replyMessageId?: string;
  }>;
  suggestions?: string[];
  moderation?: {
    publish: boolean;
  };
};

export type ActivationMode = "always" | "reply-to-bot" | "mention-or-reply";
export type SessionMode = "page" | "page-user";

export type Now4realChannelConfig = {
  enabled?: boolean;
  agentId?: string;
  displayName?: string;
  displayIcon?: string;
  activation?: ActivationMode;
  sessionMode?: SessionMode;
  groupRequireMention?: boolean;
  siteAllowlist?: string[];
  allowedQueryTokens?: string[];
  suggestions?: string[];
  maxContextMessages?: number;
  webhookPath?: string;
};

export type ResolvedNow4realAccount = {
  accountId: string | null;
  enabled: boolean;
  agentId: string;
  displayName: string;
  displayIcon?: string;
  activation: ActivationMode;
  sessionMode: SessionMode;
  groupRequireMention: boolean;
  siteAllowlist: string[];
  allowedQueryTokens: string[];
  suggestions: string[];
  maxContextMessages: number;
  webhookPath: string;
};

export type CollectedReply = {
  text: string;
  replyToId?: string;
};
