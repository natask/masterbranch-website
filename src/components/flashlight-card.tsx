"use client";

import { useCallback, useRef, useEffect } from "react";

const GLIDE_MS = 300;

/* ─── Input-tier detection ─────────────────────────────────────────────
 *  Tier 1 — Android touch-hover: pointermove fires before pointerdown.
 *           Detected at runtime on first qualifying event.
 *  Tier 2 — Gyroscope: DeviceOrientationEvent maps tilt → light position.
 *           Primary mobile tier. Permission requested on first touch.
 *  Tier 0 — Desktop mouse: existing behavior, unchanged.
 *
 *  No touch-on-contact tier — the flashlight should never appear on tap.
 * ──────────────────────────────────────────────────────────────────── */

type InputTier = "unknown" | "mouse" | "touch-hover" | "touch-gyro" | "touch-none";

let detectedTier: InputTier = "unknown";
let gyroPermissionState: "pending" | "granted" | "denied" | "unavailable" = "pending";
let gyroPermissionRequested = false;

function isTouchDevice(): boolean {
  return "ontouchstart" in window || navigator.maxTouchPoints > 0;
}

async function requestGyroPermission(): Promise<boolean> {
  if (gyroPermissionState === "granted") return true;
  if (gyroPermissionState === "denied" || gyroPermissionState === "unavailable") return false;

  const DOE = DeviceOrientationEvent as unknown as {
    requestPermission?: () => Promise<"granted" | "denied">;
  };

  // iOS 13+ requires explicit permission (must be triggered by user gesture)
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

  // Android — check if events actually fire
  return new Promise((resolve) => {
    let resolved = false;
    const timeout = setTimeout(() => {
      if (resolved) return;
      resolved = true;
      gyroPermissionState = "unavailable";
      window.removeEventListener("deviceorientation", probe);
      resolve(false);
    }, 800);

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

  // Touch-hover detection
  const touchHoverDetected = useRef(false);
  const pointerDownActive = useRef(false);

  // Gyro state
  const gyroBase = useRef<{ beta: number; gamma: number } | null>(null);
  const gyroCleanup = useRef<(() => void) | null>(null);

  const set = useCallback((x: number, y: number) => {
    const el = ref.current;
    if (!el) return;
    pos.current.x = x;
    pos.current.y = y;
    el.style.setProperty("--fl-x", `${x}px`);
    el.style.setProperty("--fl-y", `${y}px`);
  }, []);

  const setIntensity = useCallback((level: "ambient" | "full") => {
    const el = ref.current;
    if (!el) return;
    el.style.setProperty("--fl-intensity", level === "full" ? "1" : "0.45");
  }, []);

  // ─── Gyro binding ───
  const bindGyro = useCallback(() => {
    if (gyroCleanup.current) return; // already bound

    const handler = (e: DeviceOrientationEvent) => {
      const beta = e.beta ?? 0;
      const gamma = e.gamma ?? 0;

      if (!gyroBase.current) {
        gyroBase.current = { beta, gamma };
      }

      const db = beta - gyroBase.current.beta;
      const dg = gamma - gyroBase.current.gamma;

      const vw = window.innerWidth;
      const vh = window.innerHeight;
      const x = vw / 2 + (dg / 30) * (vw / 2);
      const y = vh / 2 + (db / 30) * (vh / 2);

      set(Math.max(0, Math.min(vw, x)), Math.max(0, Math.min(vh, y)));
    };

    window.addEventListener("deviceorientation", handler);
    gyroCleanup.current = () => {
      window.removeEventListener("deviceorientation", handler);
      gyroCleanup.current = null;
    };
  }, [set]);

  // ─── Try to activate gyro (called on first touch interaction) ───
  const tryActivateGyro = useCallback(async () => {
    if (gyroPermissionRequested) return;
    gyroPermissionRequested = true;

    const hasGyro = await requestGyroPermission();
    if (touchHoverDetected.current) return; // Tier 1 won during probe

    if (hasGyro) {
      detectedTier = "touch-gyro";
      setIntensity("ambient");
      bindGyro();
    } else {
      detectedTier = "touch-none";
      // No flashlight on mobile without gyro or hover — intentional
    }
  }, [setIntensity, bindGyro]);

  // ─── Desktop: glide animation on re-entry ───
  const endGlide = useCallback(() => {
    glideT0.current = 0;
    cancelAnimationFrame(rafId.current);
    set(cursor.current.x, cursor.current.y);
  }, [set]);

  const glideTick = useCallback(
    function tick(now: number) {
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
        rafId.current = requestAnimationFrame(tick);
      } else {
        endGlide();
      }
    },
    [set, endGlide],
  );

  // ─── Tier 0: Desktop mouse ───
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

      if (!pointerDownActive.current) {
        if (!touchHoverDetected.current) {
          touchHoverDetected.current = true;
          detectedTier = "touch-hover";
        }
        set(e.clientX, e.clientY);
        setIntensity("ambient");
      }
    },
    [set, setIntensity],
  );

  const handlePointerDown = useCallback(
    (e: React.PointerEvent<HTMLDivElement>) => {
      if (e.pointerType !== "touch") return;
      pointerDownActive.current = true;

      // First touch interaction on a touch device — request gyro permission
      // iOS requires this to happen inside a user gesture handler
      if (detectedTier === "unknown") {
        tryActivateGyro();
      }
    },
    [tryActivateGyro],
  );

  const handlePointerUp = useCallback(
    (e: React.PointerEvent<HTMLDivElement>) => {
      if (e.pointerType !== "touch") return;
      pointerDownActive.current = false;
    },
    [],
  );

  // ─── Auto-detect on mount (Android gyro doesn't need user gesture) ───
  useEffect(() => {
    if (!isTouchDevice()) {
      detectedTier = "mouse";
      return;
    }

    // Wait briefly to see if touch-hover fires
    const timer = setTimeout(async () => {
      if (touchHoverDetected.current) return;

      // On Android, we can probe gyro without a gesture
      const DOE = DeviceOrientationEvent as unknown as {
        requestPermission?: () => Promise<string>;
      };
      const needsGesture = typeof DOE.requestPermission === "function";

      if (!needsGesture && !gyroPermissionRequested) {
        const hasGyro = await requestGyroPermission();
        if (touchHoverDetected.current) return;
        if (hasGyro) {
          detectedTier = "touch-gyro";
          gyroPermissionRequested = true;
          setIntensity("ambient");
          bindGyro();
        }
        // If no gyro and no hover, tier stays unknown until first touch
        // triggers iOS permission request
      }
    }, 300);

    return () => {
      clearTimeout(timer);
      gyroCleanup.current?.();
    };
  }, [setIntensity, bindGyro]);

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
