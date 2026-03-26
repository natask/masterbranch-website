import { describe, it, expect } from "vitest";
import { readFileSync } from "fs";
import { join } from "path";

const css = readFileSync(join(__dirname, "globals.css"), "utf-8");

describe("shimmer-pill + border-beam CSS compatibility", () => {
  it("shimmer-pill uses ::before (not ::after) for the shimmer sweep", () => {
    expect(css).toContain(".shimmer-pill::before");
    expect(css).not.toMatch(/\.shimmer-pill::after/);
  });

  it("border-beam uses ::after for the rotating beam", () => {
    expect(css).toContain(".border-beam::after");
  });

  it("border-beam does not use ::before (reserved for shimmer-pill)", () => {
    expect(css).not.toMatch(/\.border-beam::before/);
  });

  it("shimmer-pill ::before has z-index: 2", () => {
    const shimmerBlock = css.match(/\.shimmer-pill::before\s*\{[^}]+\}/)?.[0] ?? "";
    expect(shimmerBlock).toContain("z-index: 2");
  });

  it("border-beam ::after has z-index: 3", () => {
    const beamBlock = css.match(/\.border-beam::after\s*\{[^}]+\}/)?.[0] ?? "";
    expect(beamBlock).toContain("z-index: 3");
  });
});
