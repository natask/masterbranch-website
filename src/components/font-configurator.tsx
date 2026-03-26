"use client";

import { useCallback, useEffect, useRef, useState } from "react";

const STYLE_ID = "__font-configurator";

type Config = {
  rootSize: number;
  bodyWeight: number;
  bodyTracking: number;
  headingScale: number;
  headingWeight: number;
  headingTracking: number;
  brandScale: number;
  brandWeight: number;
  brandTracking: number;
  monoSize: number;
  textBrightness: number; // foreground opacity 0-100
  cardTextBrightness: number;
};

const DEFAULTS: Config = {
  rootSize: 28,
  bodyWeight: 400,
  bodyTracking: 0,
  headingScale: 100,
  headingWeight: 700,
  headingTracking: 0,
  brandScale: 100,
  brandWeight: 700,
  brandTracking: 0.05,
  monoSize: 14,
  textBrightness: 65,
  cardTextBrightness: 85,
};

const STORAGE_KEY = "masterbranch-font-config";

function loadConfig(): Config {
  if (typeof window === "undefined") return DEFAULTS;
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return DEFAULTS;
    return { ...DEFAULTS, ...JSON.parse(raw) };
  } catch {
    return DEFAULTS;
  }
}

function saveConfig(config: Config) {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(config));
  } catch {}
}

function applyConfig(c: Config) {
  let el = document.getElementById(STYLE_ID);
  if (!el) {
    el = document.createElement("style");
    el.id = STYLE_ID;
    document.head.appendChild(el);
  }

  const rules: string[] = [];

  // Root font size — drives all rem-based Tailwind sizes
  rules.push(`html { font-size: ${c.rootSize}px !important; }`);

  // Body text
  if (c.bodyWeight !== 400) {
    rules.push(`body { font-weight: ${c.bodyWeight} !important; }`);
  }
  if (c.bodyTracking !== 0) {
    rules.push(`body { letter-spacing: ${c.bodyTracking}em !important; }`);
  }

  // Foreground brightness
  rules.push(`
    :root, .dark {
      --foreground: rgba(255, 255, 255, ${c.textBrightness / 100}) !important;
      --card-foreground: rgba(255, 255, 255, ${c.cardTextBrightness / 100}) !important;
    }
  `);

  // Headings (.font-serif = Cormorant headings)
  const hRules: string[] = [];
  if (c.headingScale !== 100) {
    hRules.push(`font-size: calc(1em * ${(c.headingScale / 100).toFixed(2)})`);
  }
  if (c.headingWeight !== 700) {
    hRules.push(`font-weight: ${c.headingWeight}`);
  }
  if (c.headingTracking !== 0) {
    hRules.push(`letter-spacing: ${c.headingTracking}em`);
  }
  if (hRules.length > 0) {
    rules.push(`.font-serif { ${hRules.map(r => r + " !important").join("; ")}; }`);
  }

  // Brand (.font-cinzel = "The Master Branch" wordmark)
  const bRules: string[] = [];
  if (c.brandScale !== 100) {
    bRules.push(`font-size: calc(1em * ${(c.brandScale / 100).toFixed(2)})`);
  }
  if (c.brandWeight !== 700) {
    bRules.push(`font-weight: ${c.brandWeight}`);
  }
  if (c.brandTracking !== 0.05) {
    bRules.push(`letter-spacing: ${c.brandTracking}em`);
  }
  if (bRules.length > 0) {
    rules.push(`.font-cinzel { ${bRules.map(r => r + " !important").join("; ")}; }`);
  }

  // Mono
  if (c.monoSize !== 14) {
    rules.push(`.font-mono, code, pre { font-size: ${c.monoSize}px !important; }`);
  }

  el.textContent = rules.join("\n");
}

function clearConfig() {
  const el = document.getElementById(STYLE_ID);
  if (el) el.textContent = "";
  try { localStorage.removeItem(STORAGE_KEY); } catch {}
}

export function FontConfigurator() {
  const [open, setOpen] = useState(false);
  const [config, setConfig] = useState<Config>(DEFAULTS);
  const panelRef = useRef<HTMLDivElement>(null);
  const initialized = useRef(false);

  // Load saved config on mount
  useEffect(() => {
    const saved = loadConfig();
    setConfig(saved);
    applyConfig(saved);
    initialized.current = true;
  }, []);

  // Apply whenever config changes (after init)
  useEffect(() => {
    if (!initialized.current) return;
    applyConfig(config);
    saveConfig(config);
  }, [config]);

  // Keyboard shortcut
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.shiftKey && e.key === "F") {
        e.preventDefault();
        setOpen((o) => !o);
      }
      if (e.key === "Escape" && open) {
        setOpen(false);
      }
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [open]);

  const update = useCallback(<K extends keyof Config>(key: K, value: Config[K]) => {
    setConfig((prev) => ({ ...prev, [key]: value }));
  }, []);

  const handleReset = useCallback(() => {
    setConfig(DEFAULTS);
    clearConfig();
    applyConfig(DEFAULTS);
  }, []);

  if (!open) {
    return (
      <button
        onClick={() => setOpen(true)}
        style={{
          position: "fixed",
          bottom: 16,
          right: 16,
          zIndex: 9999,
          width: 40,
          height: 40,
          borderRadius: "50%",
          background: "rgba(201, 165, 92, 0.15)",
          border: "1px solid rgba(201, 165, 92, 0.3)",
          color: "#c9a55c",
          fontSize: 14,
          fontWeight: 700,
          cursor: "pointer",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          transition: "all 0.2s",
          backdropFilter: "blur(10px)",
        }}
        title="Font Configurator (Cmd+Shift+F)"
      >
        Aa
      </button>
    );
  }

  return (
    <div
      ref={panelRef}
      style={{
        position: "fixed",
        bottom: 16,
        right: 16,
        zIndex: 9999,
        width: 380,
        maxHeight: "calc(100vh - 32px)",
        overflowY: "auto",
        background: "rgba(13, 12, 16, 0.96)",
        border: "1px solid rgba(255, 255, 255, 0.1)",
        borderRadius: 12,
        padding: 0,
        boxShadow: "0 16px 48px rgba(0,0,0,0.5), 0 0 80px -20px rgba(201,165,92,0.08)",
        backdropFilter: "blur(20px)",
        fontFamily: "system-ui, sans-serif",
        fontSize: 13,
        color: "#fff",
      }}
    >
      {/* Header */}
      <div style={headerStyle}>
        <span style={titleStyle}>Font Configurator</span>
        <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
          <button onClick={handleReset} style={resetBtnStyle}>Reset</button>
          <button onClick={() => setOpen(false)} style={closeBtnStyle}>&times;</button>
        </div>
      </div>

      {/* Brand — Cinzel ("The Master Branch") */}
      <Section title="Brand — Cinzel" subtitle="The Master Branch wordmark">
        <Slider label="Scale" value={config.brandScale} onChange={(v) => update("brandScale", v)} min={70} max={160} step={5} unit="%" />
        <Slider label="Weight" value={config.brandWeight} onChange={(v) => update("brandWeight", v)} min={400} max={900} step={100} unit="" />
        <Slider label="Tracking" value={config.brandTracking} onChange={(v) => update("brandTracking", v)} min={-0.02} max={0.2} step={0.01} unit="em" />
      </Section>

      {/* Headings — Cormorant */}
      <Section title="Headings — Cormorant" subtitle="H1-H3, card titles, section headers">
        <Slider label="Scale" value={config.headingScale} onChange={(v) => update("headingScale", v)} min={70} max={180} step={5} unit="%" />
        <Slider label="Weight" value={config.headingWeight} onChange={(v) => update("headingWeight", v)} min={300} max={700} step={100} unit="" />
        <Slider label="Tracking" value={config.headingTracking} onChange={(v) => update("headingTracking", v)} min={-0.03} max={0.15} step={0.01} unit="em" />
      </Section>

      {/* Body — Cormorant */}
      <Section title="Body — Cormorant" subtitle="Paragraphs, labels, nav links">
        <Slider label="Root size" value={config.rootSize} onChange={(v) => update("rootSize", v)} min={16} max={40} step={1} unit="px" />
        <Slider label="Weight" value={config.bodyWeight} onChange={(v) => update("bodyWeight", v)} min={300} max={700} step={100} unit="" />
        <Slider label="Tracking" value={config.bodyTracking} onChange={(v) => update("bodyTracking", v)} min={-0.02} max={0.1} step={0.005} unit="em" />
      </Section>

      {/* Mono — JetBrains */}
      <Section title="Mono — JetBrains" subtitle="Code, data, technical">
        <Slider label="Size" value={config.monoSize} onChange={(v) => update("monoSize", v)} min={10} max={22} step={1} unit="px" />
      </Section>

      {/* Colors */}
      <Section title="Text Brightness" subtitle="Foreground opacity">
        <Slider label="Body" value={config.textBrightness} onChange={(v) => update("textBrightness", v)} min={30} max={100} step={5} unit="%" />
        <Slider label="Cards" value={config.cardTextBrightness} onChange={(v) => update("cardTextBrightness", v)} min={40} max={100} step={5} unit="%" />
      </Section>

      {/* Footer */}
      <div style={footerStyle}>
        Cmd+Shift+F to toggle &middot; Settings persist across reloads
      </div>
    </div>
  );
}

/* --- Sub-components --- */

function Section({ title, subtitle, children }: { title: string; subtitle: string; children: React.ReactNode }) {
  return (
    <div style={{ borderBottom: "1px solid rgba(255,255,255,0.04)" }}>
      <div style={{ padding: "10px 16px 2px" }}>
        <div style={{ fontSize: 11, fontWeight: 600, letterSpacing: "0.08em", textTransform: "uppercase" as const, color: "#c9a55c" }}>{title}</div>
        <div style={{ fontSize: 10, color: "#555", marginTop: 1 }}>{subtitle}</div>
      </div>
      <div style={{ padding: "4px 8px 8px" }}>{children}</div>
    </div>
  );
}

function Slider({ label, value, onChange, min, max, step, unit }: {
  label: string; value: number; onChange: (v: number) => void;
  min: number; max: number; step: number; unit: string;
}) {
  const display = step < 1 ? value.toFixed(step < 0.01 ? 3 : 2) : value;
  return (
    <div style={{ display: "flex", alignItems: "center", gap: 8, padding: "5px 10px" }}>
      <span style={{ fontSize: 10, color: "#9d97aa", minWidth: 55, textTransform: "uppercase" as const, letterSpacing: "0.04em" }}>{label}</span>
      <input
        type="range" min={min} max={max} step={step} value={value}
        onChange={(e) => onChange(parseFloat(e.target.value))}
        style={{ flex: 1, height: 4, accentColor: "#c9a55c", cursor: "pointer" }}
      />
      <span style={{ fontSize: 11, color: "#e0c882", minWidth: 44, textAlign: "right" as const, fontVariantNumeric: "tabular-nums" }}>{display}{unit}</span>
    </div>
  );
}

/* --- Styles --- */
const headerStyle: React.CSSProperties = {
  display: "flex", justifyContent: "space-between", alignItems: "center",
  padding: "14px 16px", borderBottom: "1px solid rgba(255,255,255,0.06)",
};
const titleStyle: React.CSSProperties = {
  fontSize: 11, fontWeight: 600, letterSpacing: "0.1em", textTransform: "uppercase", color: "#c9a55c",
};
const resetBtnStyle: React.CSSProperties = {
  fontSize: 10, color: "#9d97aa", background: "rgba(255,255,255,0.05)",
  border: "1px solid rgba(255,255,255,0.08)", borderRadius: 4, padding: "4px 8px",
  cursor: "pointer", letterSpacing: "0.05em", textTransform: "uppercase",
};
const closeBtnStyle: React.CSSProperties = {
  fontSize: 16, color: "#9d97aa", background: "none", border: "none", cursor: "pointer", padding: "0 2px",
};
const footerStyle: React.CSSProperties = {
  padding: "10px 16px", borderTop: "1px solid rgba(255,255,255,0.06)",
  fontSize: 10, color: "#555", textAlign: "center", letterSpacing: "0.04em",
};
