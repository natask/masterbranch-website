"use client";

import { useState } from "react";

function generateId() {
  if (typeof crypto !== "undefined" && crypto.randomUUID) {
    return crypto.randomUUID();
  }
  return Math.random().toString(36).slice(2) + Date.now().toString(36);
}

export function useFingerprint(): string | null {
  const [fingerprint] = useState<string | null>(() => {
    if (typeof window === "undefined") return null;
    const key = "mb_fp";
    let fp = localStorage.getItem(key);
    if (!fp) {
      fp = generateId();
      localStorage.setItem(key, fp);
    }
    return fp;
  });

  return fingerprint;
}
