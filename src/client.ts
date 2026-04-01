/**
 * Now4real API client
 */

export interface SendMessageResult {
  id: string;
  success: boolean;
}

export interface Now4realOutboundUser {
  displayName: string;
  displayIcon?: string;
}

export interface Now4realOutboundMessage {
  content: string;
  replyMessageId?: string;
}

export interface Now4realSendMessageBody {
  user: Now4realOutboundUser;
  newMessages: Now4realOutboundMessage[];
}

export interface SetTypingResult {
  success: boolean;
}

class Now4realClient {
  private baseUrl = "https://api.now4real.com/v1";
  private authorization: string;

  constructor(authorization: string) {
    this.authorization = authorization;
  }

  private async request<T>(
    path: string,
    options: RequestInit = {},
  ): Promise<T> {
    const response = await fetch(`${this.baseUrl}${path}`, {
      ...options,
      headers: {
        "Content-Type": "application/json",
        Authorization: this.authorization,
        ...options.headers,
      },
    });

    if (!response.ok) {
      throw new Error(`Now4real API error: ${response.status}`);
    }

    return response.json();
  }

  async sendMessage(payload: Now4realSendMessageBody): Promise<SendMessageResult> {
    return this.request<SendMessageResult>("/pagechat/message", {
      method: "POST",
      body: JSON.stringify(payload),
    });
  }

  async setTyping(pageId: string, typing: boolean): Promise<SetTypingResult> {
    return this.request<SetTypingResult>("/pagechat/typing", {
      method: "POST",
      body: JSON.stringify({
        page_id: pageId,
        typing,
      }),
    });
  }

}

let clientInstance: Now4realClient | null = null;

export function initClient(authorization: string): Now4realClient {
  clientInstance = new Now4realClient(authorization);
  return clientInstance;
}

export function getClient(): Now4realClient {
  if (!clientInstance) {
    throw new Error("Now4real client not initialized");
  }
  return clientInstance;
}

export const now4realApi = {
  sendMessage: (payload: Now4realSendMessageBody) =>
    getClient().sendMessage(payload),
  setTyping: (pageId: string, typing: boolean) =>
    getClient().setTyping(pageId, typing),
};
