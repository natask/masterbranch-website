/**
 * Pure helpers for the project card tilt + spotlight effect.
 * Extracted so the math can be unit-tested independently of the DOM.
 */

export const TILT_MAX = 4;
export const PERSPECTIVE = 1000;

export interface Rect {
  left: number;
  top: number;
  width: number;
  height: number;
}

/** Normalise a mouse position inside a rect to [-1, 1] on each axis. */
export function normaliseMouse(
  clientX: number,
  clientY: number,
  rect: Rect
): { x: number; y: number; nx: number; ny: number } {
  const x = clientX - rect.left;
  const y = clientY - rect.top;
  const nx = (x - rect.width / 2) / (rect.width / 2);
  const ny = (y - rect.height / 2) / (rect.height / 2);
  return { x, y, nx, ny };
}

/** Build the CSS transform string for the given normalised position. */
export function buildTiltTransform(nx: number, ny: number): string {
  return (
    `perspective(${PERSPECTIVE}px) ` +
    `rotateX(${(-ny * TILT_MAX).toFixed(2)}deg) ` +
    `rotateY(${(nx * TILT_MAX).toFixed(2)}deg) ` +
    `translateZ(3px)`
  );
}

/** Choose the right CSS transition string depending on whether this is the entry frame. */
export function getTiltTransition(isEntering: boolean): string {
  return isEntering
    ? "transform 0.7s cubic-bezier(0.16, 1, 0.3, 1), box-shadow 0.7s ease"
    : "transform 0.1s linear, box-shadow 0.1s linear";
}
