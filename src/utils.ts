import { timingSafeEqual } from "crypto";

const KLIPY_GIF_URL_REGEX =
  /^https:\/\/klipy\.com\/gifs\/(\d+)#f=[a-z0-9\/]+&webp=[A-Za-z0-9]+&jpeg=[A-Za-z0-9]+&gif=[A-Za-z0-9]+$/;

/**
 * Compares two strings in constant time to prevent timing attacks.
 */
export function timingSafeStringEqual(a: string, b: string): boolean {
  const bufA = Buffer.from(a);
  const bufB = Buffer.from(b);
  return bufA.length === bufB.length && timingSafeEqual(bufA, bufB);
}

export function parseWebhookPayload<T>(body: string): T {
  return JSON.parse(body) as T;
}

function escapeRegExp(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

export function containsBotMention(content: string, botName: string): boolean {
  const normalizedName = botName.trim();
  if (!normalizedName) {
    return false;
  }

  const namePattern = normalizedName
    .split(/\s+/)
    .filter(Boolean)
    .map((token) => escapeRegExp(token))
    .join("\\s+");

  const mentionRegex = new RegExp(`(?:^|\\s)@\\s*${namePattern}(?=$|[\\s.,!?;:])`, "i");
  return mentionRegex.test(content);
}

export function extractKlipyGifId(content: string): string | null {
  const normalizedContent = String(content ?? "").trim();
  const match = KLIPY_GIF_URL_REGEX.exec(normalizedContent);
  return match?.[1] ?? null;
}
