import { describe, it, expect } from "vitest";
import { slugify } from "./slug";

describe("slugify", () => {
  it("lowercases and joins words with dots", () => {
    expect(slugify("My Branch")).toBe("my.branch");
  });

  it("collapses multiple spaces into one dot", () => {
    expect(slugify("foo   bar")).toBe("foo.bar");
  });

  it("converts special characters to dots", () => {
    expect(slugify("foo bar!!")).toBe("foo.bar");
  });

  it("trims whitespace before slugifying", () => {
    expect(slugify("  My Branch  ")).toBe("my.branch");
  });

  it("strips leading and trailing dots", () => {
    expect(slugify("!!My Branch!!")).toBe("my.branch");
  });

  it("handles single word", () => {
    expect(slugify("London")).toBe("london");
  });

  it("returns empty string for names with no valid characters", () => {
    expect(slugify("!!!")).toBe("");
  });
});
