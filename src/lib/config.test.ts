import { describe, expect, it } from "vitest";
import {
  COMMUNITY_URL,
  FOOTER_TAGLINE,
  SITE_DESCRIPTION,
  SITE_DOMAIN,
  SITE_NAME,
} from "./config";

describe("config", () => {
  it("keeps brand constants non-empty", () => {
    expect(SITE_NAME.trim().length).toBeGreaterThan(0);
    expect(SITE_DESCRIPTION.trim().length).toBeGreaterThan(0);
    expect(FOOTER_TAGLINE.trim().length).toBeGreaterThan(0);
  });

  it("keeps domain and community url valid", () => {
    expect(SITE_DOMAIN).toMatch(/^[a-z0-9.-]+\.[a-z]{2,}$/i);

    const parsed = new URL(COMMUNITY_URL);
    expect(parsed.protocol).toBe("https:");
    expect(parsed.hostname).toBe("x.com");
    expect(parsed.pathname.startsWith("/i/communities/")).toBe(true);
  });
});
