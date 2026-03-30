import { describe, it, expect } from "vitest";
import { now4realPlugin } from "./channel.js";

describe("now4real plugin", () => {
  it("resolves account from config", () => {
    const cfg = {
      channels: {
        "now4real": {
          apiKey: "test-api-key",
          siteKey: "test-site-key",
          allowFrom: ["user1"],
        },
      },
    } as any;
    const account = now4realPlugin.setup!.resolveAccount(cfg, undefined);
    expect(account.apiKey).toBe("test-api-key");
    expect(account.siteKey).toBe("test-site-key");
  });

  it("inspects account without materializing secrets", () => {
    const cfg = {
      channels: {
        "now4real": {
          apiKey: "test-api-key",
          siteKey: "test-site-key",
        },
      },
    } as any;
    const result = now4realPlugin.setup!.inspectAccount!(cfg, undefined);
    expect(result.configured).toBe(true);
    expect(result.tokenStatus).toBe("available");
  });

  it("reports missing config", () => {
    const cfg = { channels: {} } as any;
    const result = now4realPlugin.setup!.inspectAccount!(cfg, undefined);
    expect(result.configured).toBe(false);
  });

  it("throws when apiKey is missing", () => {
    const cfg = {
      channels: {
        "now4real": { siteKey: "test-site-key" },
      },
    } as any;
    expect(() => now4realPlugin.setup!.resolveAccount(cfg, undefined)).toThrow(
      "now4real: apiKey is required",
    );
  });

  it("throws when siteKey is missing", () => {
    const cfg = {
      channels: {
        "now4real": { apiKey: "test-api-key" },
      },
    } as any;
    expect(() => now4realPlugin.setup!.resolveAccount(cfg, undefined)).toThrow(
      "now4real: siteKey is required",
    );
  });
});
