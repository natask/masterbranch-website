import { describe, it, expect } from "vitest";
import { capitalizeFirst } from "./capitalize";

describe("capitalizeFirst", () => {
  it("capitalizes the first letter of a lowercase string", () => {
    expect(capitalizeFirst("hello world")).toBe("Hello world");
  });

  it("leaves an already-capitalized string unchanged", () => {
    expect(capitalizeFirst("Already good")).toBe("Already good");
  });

  it("trims whitespace before capitalizing", () => {
    expect(capitalizeFirst("  spaced out  ")).toBe("Spaced out");
  });

  it("returns null for null input", () => {
    expect(capitalizeFirst(null)).toBeNull();
  });

  it("returns null for undefined input", () => {
    expect(capitalizeFirst(undefined)).toBeNull();
  });

  it("returns null for empty string", () => {
    expect(capitalizeFirst("")).toBeNull();
  });

  it("returns null for whitespace-only string", () => {
    expect(capitalizeFirst("   ")).toBeNull();
  });

  it("handles single character", () => {
    expect(capitalizeFirst("a")).toBe("A");
  });
});
