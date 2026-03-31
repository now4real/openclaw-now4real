import { describe, it, expect } from "vitest";
import { now4realPlugin } from "./channel.js";

describe("now4real plugin", () => {
  it("resolves account from config", () => {
    const cfg = {
      channels: {
        "now4real": {
          webhookAuthorization: "test-secret",
        },
      },
    } as any;
    const account = now4realPlugin.setup!.resolveAccount(cfg, undefined);
    expect(account.accountId).toBeNull();
    expect(account.webhookAuthorization).toBe("test-secret");
  });

  it("inspects account without materializing secrets", () => {
    const cfg = {
      channels: {
        "now4real": {
          webhookAuthorization: "test-secret",
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

  it("throws when webhookAuthorization is missing", () => {
    const cfg = {
      channels: {
        "now4real": {},
      },
    } as any;
    expect(() => now4realPlugin.setup!.resolveAccount(cfg, undefined)).toThrow(
      "now4real: webhookAuthorization is required",
    );
  });
});
