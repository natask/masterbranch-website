"use client";

import { useCallback, useRef, useEffect } from "react";

const GLIDE_MS = 300;

/* ─── Input-tier detection ─────────────────────────────────────────────
 *  Tier 1 — Android touch-hover: pointermove fires before pointerdown.
 *           Detected at runtime on first qualifying event.
 *  Tier 2 — Gyroscope: DeviceOrientationEvent maps tilt → light position.
 *           Used on touch devices without hover (most Android + all iOS).
 *  Tier 3 — Touch-on-contact: touchstart/touchmove/touchend.
 *           Intensifies light at contact point, overrides gyro while held.
 *  Tier 0 — Desktop mouse: existing behavior, unchanged.
 * ──────────────────────────────────────────────────────────────────── */

type InputTier = "unknown" | "mouse" | "touch-hover" | "touch-gyro" | "touch-only";

// Shared across all FlashlightBackground instances on the page
let detectedTier: InputTier = "unknown";
let gyroPermissionState: "pending" | "granted" | "denied" | "unavailable" = "pending";

function isTouchDevice(): boolean {
  return "ontouchstart" in window || navigator.maxTouchPoints > 0;
}

async function requestGyroPermission(): Promise<boolean> {
  if (gyroPermissionState === "granted") return true;
  if (gyroPermissionState === "denied" || gyroPermissionState === "unavailable") return false;

  // iOS 13+ requires explicit permission
  const DOE = DeviceOrientationEvent as unknown as {
    requestPermission?: () => Promise<"granted" | "denied">;
  };
  if (typeof DOE.requestPermission === "function") {
    try {
      const state = await DOE.requestPermission();
      gyroPermissionState = state === "granted" ? "granted" : "denied";
      return gyroPermissionState === "granted";
    } catch {
      gyroPermissionState = "denied";
      return false;
    }
  }

  // Android / non-iOS — check if events actually fire
  return new Promise((resolve) => {
    let resolved = false;
    const timeout = setTimeout(() => {
      if (resolved) return;
      resolved = true;
      gyroPermissionState = "unavailable";
      window.removeEventListener("deviceorientation", probe);
      resolve(false);
    }, 1000);

    function probe() {
      if (resolved) return;
      resolved = true;
      clearTimeout(timeout);
      gyroPermissionState = "granted";
      window.removeEventListener("deviceorientation", probe);
      resolve(true);
    }
    window.addEventListener("deviceorientation", probe);
  });
}

/** Wraps the full page and paints a subtle flashlight on the background.
 *
 *  Desktop: tracks cursor directly (glide animation on re-entry).
 *  Touch-hover (Android): tracks finger proximity before contact.
 *  Gyroscope: maps phone tilt to light position (ambient drift).
 *  Touch-on-contact: intensifies + overrides position while finger is down. */
export function FlashlightBackground({
  children,
  className = "",
}: {
  children: React.ReactNode;
  className?: string;
}) {
  const ref = useRef<HTMLDivElement>(null);
  const cursor = useRef({ x: 0, y: 0 });
  const pos = useRef({ x: -900, y: -900 });
  const glideFrom = useRef({ x: 0, y: 0 });
  const glideT0 = useRef(0);
  const rafId = useRef<number>(0);

  // Touch state
  const touchActive = useRef(false);
  const touchHoverDetected = useRef(false);
  const pointerDownActive = useRef(false);

  // Gyro state
  const gyroActive = useRef(false);
  const gyroBase = useRef<{ beta: number; gamma: number } | null>(null);

  const set = useCallback((x: number, y: number) => {
    const el = ref.current;
    if (!el) return;
    pos.current.x = x;
    pos.current.y = y;
    el.style.setProperty("--fl-x", `${x}px`);
    el.style.setProperty("--fl-y", `${y}px`);
  }, []);

  // ─── Intensity control (touch brightens the flashlight) ───
  const setIntensity = useCallback((level: "ambient" | "full") => {
    const el = ref.current;
    if (!el) return;
    el.style.setProperty(
      "--fl-intensity",
      level === "full" ? "1" : "0.45",
    );
  }, []);

  // ─── Desktop: glide animation on re-entry ───
  const endGlide = useCallback(() => {
    glideT0.current = 0;
    cancelAnimationFrame(rafId.current);
    set(cursor.current.x, cursor.current.y);
  }, [set]);

  const glideTick = useCallback(
    (now: number) => {
      const t = Math.min((now - glideT0.current) / GLIDE_MS, 1);
      const e = 1 - (1 - t) * (1 - t) * (1 - t);
      const x = glideFrom.current.x + (cursor.current.x - glideFrom.current.x) * e;
      const y = glideFrom.current.y + (cursor.current.y - glideFrom.current.y) * e;

      if (Math.abs(x - cursor.current.x) < 15 && Math.abs(y - cursor.current.y) < 15) {
        endGlide();
        return;
      }
      set(x, y);
      if (t < 1) {
        rafId.current = requestAnimationFrame(glideTick);
      } else {
        endGlide();
      }
    },
    [set, endGlide],
  );

  // ─── Tier 0: Desktop mouse handlers ───
  const handleMouseMove = useCallback(
    (e: React.MouseEvent<HTMLDivElement>) => {
      if (detectedTier !== "unknown" && detectedTier !== "mouse") return;
      cursor.current.x = e.clientX;
      cursor.current.y = e.clientY;
      if (glideT0.current > 0) return;
      set(e.clientX, e.clientY);
    },
    [set],
  );

  const handleMouseEnter = useCallback(
    (e: React.MouseEvent<HTMLDivElement>) => {
      if (detectedTier !== "unknown" && detectedTier !== "mouse") return;
      if (detectedTier === "unknown" && !isTouchDevice()) {
        detectedTier = "mouse";
      }
      cursor.current.x = e.clientX;
      cursor.current.y = e.clientY;
      const dx = Math.abs(pos.current.x - e.clientX);
      const dy = Math.abs(pos.current.y - e.clientY);
      if (pos.current.x <= -900 || (dx < 5 && dy < 5)) {
        set(e.clientX, e.clientY);
        return;
      }
      glideFrom.current = { x: pos.current.x, y: pos.current.y };
      glideT0.current = performance.now();
      cancelAnimationFrame(rafId.current);
      rafId.current = requestAnimationFrame(glideTick);
    },
    [set, glideTick],
  );

  const handleMouseLeave = useCallback(() => {
    if (detectedTier !== "mouse") return;
    cancelAnimationFrame(rafId.current);
    glideT0.current = 0;
  }, []);

  // ─── Tier 1: Android touch-hover (pointermove without pointerdown) ───
  const handlePointerMove = useCallback(
    (e: React.PointerEvent<HTMLDivElement>) => {
      if (e.pointerType !== "touch") return;

      // If pointer is moving but no finger is down → hover-capable panel
      if (!pointerDownActive.current) {
        if (!touchHoverDetected.current) {
          touchHoverDetected.current = true;
          detectedTier = "touch-hover";
        }
        set(e.clientX, e.clientY);
        setIntensity("ambient");
        return;
      }

      // Finger is down — direct tracking, full intensity
      if (detectedTier === "touch-hover") {
        set(e.clientX, e.clientY);
        setIntensity("full");
      }
    },
    [set, setIntensity],
  );

  const handlePointerDown = useCallback(
    (e: React.PointerEvent<HTMLDivElement>) => {
      if (e.pointerType !== "touch") return;
      pointerDownActive.current = true;
      if (detectedTier === "touch-hover" || detectedTier === "touch-gyro" || detectedTier === "touch-only") {
        set(e.clientX, e.clientY);
        setIntensity("full");
        touchActive.current = true;
      }
    },
    [set, setIntensity],
  );

  const handlePointerUp = useCallback(
    (e: React.PointerEvent<HTMLDivElement>) => {
      if (e.pointerType !== "touch") return;
      pointerDownActive.current = false;
      touchActive.current = false;
      if (detectedTier === "touch-hover") {
        setIntensity("ambient");
      } else if (detectedTier === "touch-gyro") {
        setIntensity("ambient");
        // Position returns to gyro control — no action needed
      } else if (detectedTier === "touch-only") {
        setIntensity("ambient");
      }
    },
    [setIntensity],
  );

  // ─── Tier 3: Touch-on-contact (touchmove for position while held) ───
  const handleTouchMove = useCallback(
    (e: React.TouchEvent<HTMLDivElement>) => {
      if (detectedTier !== "touch-gyro" && detectedTier !== "touch-only") return;
      if (!touchActive.current) return;
      const t = e.touches[0];
      if (!t) return;
      set(t.clientX, t.clientY);
    },
    [set],
  );

  const handleTouchStart = useCallback(
    (e: React.TouchEvent<HTMLDivElement>) => {
      if (detectedTier !== "touch-gyro" && detectedTier !== "touch-only") return;
      touchActive.current = true;
      const t = e.touches[0];
      if (!t) return;
      set(t.clientX, t.clientY);
      setIntensity("full");
    },
    [set, setIntensity],
  );

  const handleTouchEnd = useCallback(() => {
    touchActive.current = false;
    if (detectedTier === "touch-gyro") {
      setIntensity("ambient");
    } else if (detectedTier === "touch-only") {
      setIntensity("ambient");
    }
  }, [setIntensity]);

  // ─── Tier 2: Gyroscope setup ───
  useEffect(() => {
    if (!isTouchDevice()) {
      detectedTier = "mouse";
      return;
    }

    let gyroHandler: ((e: DeviceOrientationEvent) => void) | null = null;

    // Wait briefly to see if touch-hover fires first
    const timer = setTimeout(async () => {
      if (touchHoverDetected.current) return; // Tier 1 won, skip gyro

      const hasGyro = await requestGyroPermission();
      if (touchHoverDetected.current) return; // Tier 1 detected during gyro probe

      if (hasGyro) {
        detectedTier = "touch-gyro";
        gyroActive.current = true;
        setIntensity("ambient");

        gyroHandler = (e: DeviceOrientationEvent) => {
          if (touchActive.current) return; // Finger overrides gyro
          const beta = e.beta ?? 0;   // front-back tilt
          const gamma = e.gamma ?? 0; // left-right tilt

          // Calibrate: first reading becomes center
          if (!gyroBase.current) {
            gyroBase.current = { beta, gamma };
          }

          const db = beta - gyroBase.current.beta;
          const dg = gamma - gyroBase.current.gamma;

          // Map tilt degrees to viewport pixels
          // ±30° maps to full viewport width/height
          const vw = window.innerWidth;
          const vh = window.innerHeight;
          const x = vw / 2 + (dg / 30) * (vw / 2);
          const y = vh / 2 + (db / 30) * (vh / 2);

          set(
            Math.max(0, Math.min(vw, x)),
            Math.max(0, Math.min(vh, y)),
          );
        };

        window.addEventListener("deviceorientation", gyroHandler);
      } else {
        detectedTier = "touch-only";
        setIntensity("ambient");
      }
    }, 300);

    return () => {
      clearTimeout(timer);
      if (gyroHandler) {
        window.removeEventListener("deviceorientation", gyroHandler);
      }
      gyroActive.current = false;
    };
  }, [set, setIntensity]);

  // Cleanup rAF on unmount
  useEffect(() => () => cancelAnimationFrame(rafId.current), []);

  return (
    <div
      ref={ref}
      onMouseEnter={handleMouseEnter}
      onMouseMove={handleMouseMove}
      onMouseLeave={handleMouseLeave}
      onPointerMove={handlePointerMove}
      onPointerDown={handlePointerDown}
      onPointerUp={handlePointerUp}
      onTouchStart={handleTouchStart}
      onTouchMove={handleTouchMove}
      onTouchEnd={handleTouchEnd}
      className={`flashlight-bg ${className}`}
    >
      {children}
    </div>
  );
}

/** @deprecated — kept for bento grid cells; no longer has flashlight pseudo-elements. */
export function FlashlightCard({
  children,
  className = "",
}: {
  children: React.ReactNode;
  className?: string;
}) {
  return <div className={className}>{children}</div>;
}
