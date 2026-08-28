import { describe, expect, it } from "vitest";
import { CREATOR_KEEP_PCT, SITE_DESCRIPTION, absoluteUrl } from "./seo";

describe("seo helpers", () => {
  it("keeps the creator share at 75%", () => {
    expect(CREATOR_KEEP_PCT).toBe(75);
    expect(SITE_DESCRIPTION).toContain("75%");
    expect(SITE_DESCRIPTION).not.toContain("70%");
  });

  it("builds absolute urls from the site origin", () => {
    expect(absoluteUrl("/")).toMatch(/^https?:\/\//);
    expect(absoluteUrl("/privacy")).toMatch(/\/privacy$/);
    expect(absoluteUrl("terms")).toMatch(/\/terms$/);
  });
});
