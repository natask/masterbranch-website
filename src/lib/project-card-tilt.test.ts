import { describe, it, expect } from "vitest";
import {
  normaliseMouse,
  buildTiltTransform,
  getTiltTransition,
  TILT_MAX,
  PERSPECTIVE,
} from "./project-card-tilt";

const rect = { left: 0, top: 0, width: 200, height: 300 };

describe("normaliseMouse", () => {
  it("returns 0,0 at the centre of the card", () => {
    const { nx, ny } = normaliseMouse(100, 150, rect);
    expect(nx).toBe(0);
    expect(ny).toBe(0);
  });

  it("returns +1,+1 at the bottom-right corner", () => {
    const { nx, ny } = normaliseMouse(200, 300, rect);
    expect(nx).toBe(1);
    expect(ny).toBe(1);
  });

  it("returns -1,-1 at the top-left corner", () => {
    const { nx, ny } = normaliseMouse(0, 0, rect);
    expect(nx).toBe(-1);
    expect(ny).toBe(-1);
  });

  it("pixel offsets include the rect origin", () => {
    const offset = { left: 50, top: 80, width: 200, height: 300 };
    const { x, y } = normaliseMouse(150, 230, offset);
    expect(x).toBe(100); // 150 - 50
    expect(y).toBe(150); // 230 - 80
  });
});

describe("buildTiltTransform", () => {
  it("produces no rotation at the centre (nx=0, ny=0)", () => {
    const t = buildTiltTransform(0, 0);
    expect(t).toContain("rotateX(0.00deg)");
    expect(t).toContain("rotateY(0.00deg)");
  });

  it("rotates to TILT_MAX degrees at the right edge (nx=1)", () => {
    const t = buildTiltTransform(1, 0);
    expect(t).toContain(`rotateY(${TILT_MAX.toFixed(2)}deg)`);
  });

  it("rotates to -TILT_MAX degrees at the left edge (nx=-1)", () => {
    const t = buildTiltTransform(-1, 0);
    expect(t).toContain(`rotateY(-${TILT_MAX.toFixed(2)}deg)`);
  });

  it("inverts ny so the card tilts toward the cursor (top edge lifts)", () => {
    // ny = -1 (top of card): rotateX should be positive (top tilts toward viewer)
    const t = buildTiltTransform(0, -1);
    expect(t).toContain(`rotateX(${TILT_MAX.toFixed(2)}deg)`);
  });

  it("always includes the correct perspective and translateZ", () => {
    const t = buildTiltTransform(0.5, 0.5);
    expect(t).toContain(`perspective(${PERSPECTIVE}px)`);
    expect(t).toContain("translateZ(3px)");
  });
});

describe("getTiltTransition", () => {
  it("returns the slow entry transition on first enter", () => {
    const t = getTiltTransition(true);
    expect(t).toContain("0.7s");
    expect(t).toContain("cubic-bezier");
  });

  it("returns the fast tracking transition for subsequent moves", () => {
    const t = getTiltTransition(false);
    expect(t).toContain("0.1s");
    expect(t).toContain("linear");
  });
});
