/**
 * Now4real API client
 */

export interface Now4realConfig {
  apiKey: string;
  siteKey: string;
}

export interface SendMessageResult {
  id: string;
  success: boolean;
}

class Now4realClient {
  private apiKey: string;
  private siteKey: string;
  private baseUrl = "https://api.now4real.com/v1";

  constructor(config: Now4realConfig) {
    this.apiKey = config.apiKey;
    this.siteKey = config.siteKey;
  }

  private async request<T>(
    path: string,
    options: RequestInit = {},
  ): Promise<T> {
    const response = await fetch(`${this.baseUrl}${path}`, {
      ...options,
      headers: {
        Authorization: `Bearer ${this.apiKey}`,
        "Content-Type": "application/json",
        ...options.headers,
      },
    });

    if (!response.ok) {
      throw new Error(`Now4real API error: ${response.status}`);
    }

    return response.json();
  }

  async sendMessage(pageId: string, message: string): Promise<SendMessageResult> {
    return this.request<SendMessageResult>("/pagechat/message", {
      method: "POST",
      body: JSON.stringify({
        site_key: this.siteKey,
        page_id: pageId,
        message,
      }),
    });
  }

  async sendDm(userId: string, message: string): Promise<SendMessageResult> {
    return this.request<SendMessageResult>("/dm/send", {
      method: "POST",
      body: JSON.stringify({
        site_key: this.siteKey,
        user_id: userId,
        message,
      }),
    });
  }
}

let clientInstance: Now4realClient | null = null;

export function initClient(config: Now4realConfig): Now4realClient {
  clientInstance = new Now4realClient(config);
  return clientInstance;
}

export function getClient(): Now4realClient {
  if (!clientInstance) {
    throw new Error("Now4real client not initialized");
  }
  return clientInstance;
}

export const now4realApi = {
  sendMessage: (pageId: string, message: string) =>
    getClient().sendMessage(pageId, message),
  sendDm: (userId: string, message: string) =>
    getClient().sendDm(userId, message),
};
