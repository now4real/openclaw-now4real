/**
 * Now4real API client
 */

export interface SendMessageResult {
}

export interface Now4realOutboundUser {
  displayName: string;
  displayIcon?: string;
}

export interface Now4realOutboundMessage {
  content: string;
  replyMessageId?: string;
}

export interface Now4realContext {
  site: string;
  page: string;
}

export interface Now4realSendMessageBody {
  context: Now4realContext;
  user: Now4realOutboundUser;
  newMessages: Now4realOutboundMessage[];
}

export interface Now4realSetTypingBody {
  context: Now4realContext;
  user: Now4realOutboundUser;
  typing: boolean;
  timeout?: number; // in seconds, optional, for how long the typing status should be active (only applicable when typing=true)
}

export interface SetTypingResult {
}

class Now4realClient {
  private baseUrl = "https://api.now4real.com/rest/v1";
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
    console.log("Now4real sendMessage:", payload);

    return this.request<SendMessageResult>("/chatbot/message", {
      method: "PUT",
      body: JSON.stringify(payload),
    });
  }

  async setTyping(payload: Now4realSetTypingBody): Promise<SetTypingResult> {
    console.log("Now4real setTyping:", payload);

    return this.request<SetTypingResult>("/chatbot/typing", {
      method: "POST",
      body: JSON.stringify(payload),
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
  setTyping: (payload: Now4realSetTypingBody) =>
    getClient().setTyping(payload),
};
