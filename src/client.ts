/**
 * Now4real API client
 */

export interface SendMessageResult {
  id?: string;
}

export interface Now4realOutboundUser {
  displayName: string;
  displayIcon?: string;
  jwtSub: string;
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

export interface Now4realClientOptions {
  baseOrigin?: string;
}

const NOW4REAL_DEFAULT_ORIGIN = "https://integrator-api.now4real.com";
const NOW4REAL_API_BASE_PATH = "/rest/v1";

function resolveApiOrigin(baseOrigin?: string): string {
  const raw = String(baseOrigin ?? "").trim();
  if (!raw) {
    return NOW4REAL_DEFAULT_ORIGIN;
  }

  try {
    return new URL(raw).origin;
  } catch {
    return NOW4REAL_DEFAULT_ORIGIN;
  }
}

class Now4realClient {
  private baseUrl: string;
  private authorization: string;

  constructor(authorization: string, options: Now4realClientOptions = {}) {
    this.authorization = authorization;
    this.baseUrl = `${resolveApiOrigin(options.baseOrigin)}${NOW4REAL_API_BASE_PATH}`;
  }

  private async request<T>(
    path: string,
    options: RequestInit = {},
  ): Promise<T> {
    const method = options.method ?? "GET";

    const response = await fetch(`${this.baseUrl}${path}`, {
      ...options,
      headers: {
        "Content-Type": "application/json",
        Authorization: this.authorization,
        ...options.headers,
      },
    });

    if (!response.ok) {
      const responseBody = await response.text().catch(() => "");
      throw new Error(
        `Now4real API error ${method} ${path}: ${response.status} ${response.statusText}${responseBody ? ` - ${responseBody}` : ""}`,
      );
    }

    return response.json();
  }

  async sendMessage(payload: Now4realSendMessageBody): Promise<SendMessageResult> {
    //console.log("Now4real sendMessage:", payload);

    return this.request<SendMessageResult>("/chatbot/message", {
      method: "PUT",
      body: JSON.stringify(payload),
    });
  }

  async setTyping(payload: Now4realSetTypingBody): Promise<SetTypingResult> {
    //console.log("Now4real setTyping:", payload);

    return this.request<SetTypingResult>("/chatbot/typing", {
      method: "POST",
      body: JSON.stringify(payload),
    });
  }

}

let clientInstance: Now4realClient | null = null;

export function initClient(
  authorization: string,
  options: Now4realClientOptions = {},
): Now4realClient {
  clientInstance = new Now4realClient(authorization, options);
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
