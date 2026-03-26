import { describe, it, expect } from "vitest";
import { getBranchSlug } from "./middleware";

// Slugs are generated at branch creation time:
//   "My Branch"  → "my.branch"
//   "foo bar!!"  → "foo.bar"
// Spaces and special characters become dots.

describe("getBranchSlug", () => {
  describe("production domain", () => {
    it("returns slug for simple branch name", () => {
      expect(getBranchSlug("my.branch.masterbranch.club")).toBe("my.branch");
    });

    it("returns slug for single-word branch name", () => {
      expect(getBranchSlug("london.masterbranch.club")).toBe("london");
    });

    it("returns slug when www prefix is present", () => {
      expect(getBranchSlug("www.my.branch.masterbranch.club")).toBe("my.branch");
    });

    it("returns null for bare domain", () => {
      expect(getBranchSlug("masterbranch.club")).toBeNull();
    });

    it("returns null for www only", () => {
      expect(getBranchSlug("www.masterbranch.club")).toBeNull();
    });

    it("returns null for unrelated domain", () => {
      expect(getBranchSlug("evil.com")).toBeNull();
    });

    it("returns null for domain that ends with but is not the site domain", () => {
      expect(getBranchSlug("fakemasterbranch.club")).toBeNull();
    });
  });

  describe("local dev", () => {
    it("returns slug for subdomain on localhost", () => {
      expect(getBranchSlug("my.branch.localhost:3000")).toBe("my.branch");
    });

    it("returns slug when www prefix is present on localhost", () => {
      expect(getBranchSlug("www.my.branch.localhost:3000")).toBe("my.branch");
    });

    it("returns null for bare localhost", () => {
      expect(getBranchSlug("localhost:3000")).toBeNull();
    });
  });
});
