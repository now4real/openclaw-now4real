/**
 * Now4real API client
 */

export interface SendMessageResult {
  id: string;
  success: boolean;
}

class Now4realClient {
  private baseUrl = "https://api.now4real.com/v1";

  private async request<T>(
    path: string,
    options: RequestInit = {},
  ): Promise<T> {
    const response = await fetch(`${this.baseUrl}${path}`, {
      ...options,
      headers: {
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
        page_id: pageId,
        message,
      }),
    });
  }

}

let clientInstance: Now4realClient | null = null;

export function initClient(): Now4realClient {
  clientInstance = new Now4realClient();
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
};
