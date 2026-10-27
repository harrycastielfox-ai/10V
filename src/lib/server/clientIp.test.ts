import { describe, expect, it } from "vitest";
import { getTrustedClientIp } from "../../../supabase/functions/_shared/clientIp.ts";

describe("getTrustedClientIp", () => {
  it("prefers the edge-provided address over forwarded input", () => {
    const headers = new Headers({
      "cf-connecting-ip": "203.0.113.10",
      "x-forwarded-for": "198.51.100.99, 203.0.113.10",
    });

    expect(getTrustedClientIp(headers)).toBe("203.0.113.10");
  });

  it("uses the first forwarded address only as a fallback", () => {
    const headers = new Headers({ "x-forwarded-for": "198.51.100.20, 203.0.113.4" });
    expect(getTrustedClientIp(headers)).toBe("198.51.100.20");
  });

  it("rejects empty and oversized values", () => {
    expect(getTrustedClientIp(new Headers())).toBeNull();
    expect(getTrustedClientIp(new Headers({ "cf-connecting-ip": "x".repeat(129) }))).toBeNull();
  });
});
