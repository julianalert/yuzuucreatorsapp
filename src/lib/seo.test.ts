import { describe, expect, it } from "vitest";
import { CREATOR_KEEP_PCT, SITE_DESCRIPTION, absoluteUrl } from "./seo";

describe("seo helpers", () => {
  it("keeps the creator share at 70%", () => {
    expect(CREATOR_KEEP_PCT).toBe(70);
    expect(SITE_DESCRIPTION).toContain("70%");
    expect(SITE_DESCRIPTION).not.toContain("75%");
  });

  it("builds absolute urls from the site origin", () => {
    expect(absoluteUrl("/")).toMatch(/^https?:\/\//);
    expect(absoluteUrl("/privacy")).toMatch(/\/privacy$/);
    expect(absoluteUrl("terms")).toMatch(/\/terms$/);
  });
});
