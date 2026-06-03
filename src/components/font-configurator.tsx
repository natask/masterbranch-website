"use client";

import { useCallback, useEffect, useRef, useState } from "react";

const STYLE_ID = "__font-configurator";

type TextFont = "cinzel" | "cormorant";
type DitherStyle = "dot" | "blueNoise" | "halftone";
type EffectScope = "hero" | "page";
type HeroTitleLayout = "2-line" | "3-line";
type ContentAlignment = "center" | "columnLeft";
type ScheduleLayout = "center" | "alignedGrid";

type Config = {
  textFont: TextFont;
  rootSize: number;
  bodyTextSize: number;
  bodyWeight: number;
  bodyLineHeight: number;
  bodyTracking: number;
  bodyFirstBlockSpacing: number;
  bodyBlockSpacing: number;
  callResponseGap: number;
  contentAlignment: ContentAlignment;
  contentColumnWidth: number;
  scheduleLayout: ScheduleLayout;
  scheduleColumnWidth: number;
  scheduleNumWidth: number;
  scheduleTitleWidth: number;
  scheduleTimeWidth: number;
  listItemSpacing: number;
  headingScale: number;
  headingWeight: number;
  headingTracking: number;
  headingTopSpacing: number;
  brandScale: number;
  brandWeight: number;
  brandTracking: number;
  topbarSize: number;
  topbarWeight: number;
  topbarTracking: number;
  topbarGap: number;
  topbarLogoSize: number;
  socialIconSize: number;
  monoSize: number;
  textBrightness: number;
  cardTextBrightness: number;
  heroTitleLayout: HeroTitleLayout;
  heroIconSize: number;
  heroIconY: number;
  heroIconGap: number;
  heroTitleTracking: number;
  heroTitleScale: number;
  heroContentY: number;
  heroToplineSize: number;
  heroToplineX: number;
  heroToplineY: number;
  heroToplineWeight: number;
  heroToplineTracking: number;
  heroTitleSize: number;
  heroTitleX: number;
  heroTitleY: number;
  heroTitleWeight: number;
  heroTitleLineHeight: number;
  heroTaglineSize: number;
  heroTaglineX: number;
  heroTaglineY: number;
  heroTaglineWeight: number;
  heroTaglineTracking: number;
  heroGradient: number;
  heroDither: number;
  heroDitherStyle: DitherStyle;
  heroDitherSize: number;
  heroDitherPrecision: number;
  heroEffectScope: EffectScope;
  heroNoise: number;
  heroBase: string;
  heroGold: string;
  heroWhite: string;
};

const EFFECT_DEFAULTS: Pick<Config, "heroGradient" | "heroDither" | "heroEffectScope"> = {
  heroGradient: 0,
  heroDither: 3,
  heroEffectScope: "page",
};

const ICON_DEFAULTS: Pick<Config, "topbarLogoSize" | "socialIconSize" | "heroIconSize" | "heroIconY" | "heroIconGap"> = {
  topbarLogoSize: 50,
  socialIconSize: 24,
  heroIconSize: 72,
  heroIconY: 0,
  heroIconGap: 20,
};

const DEFAULTS: Config = {
  textFont: "cormorant",
  rootSize: 28,
  bodyTextSize: 26,
  bodyWeight: 500,
  bodyLineHeight: 1.5,
  bodyTracking: 0.025,
  bodyFirstBlockSpacing: 56,
  bodyBlockSpacing: 42,
  callResponseGap: 10,
  contentAlignment: "center",
  contentColumnWidth: 560,
  scheduleLayout: "alignedGrid",
  scheduleColumnWidth: 520,
  scheduleNumWidth: 42,
  scheduleTitleWidth: 150,
  scheduleTimeWidth: 68,
  listItemSpacing: 56,
  headingScale: 100,
  headingWeight: 400,
  headingTracking: 0,
  headingTopSpacing: 70,
  brandScale: 100,
  brandWeight: 400,
  brandTracking: 0.05,
  topbarSize: 14,
  topbarWeight: 600,
  topbarTracking: 0.05,
  topbarGap: 20,
  topbarLogoSize: ICON_DEFAULTS.topbarLogoSize,
  socialIconSize: ICON_DEFAULTS.socialIconSize,
  monoSize: 14,
  textBrightness: 65,
  cardTextBrightness: 85,
  heroTitleLayout: "2-line",
  heroIconSize: ICON_DEFAULTS.heroIconSize,
  heroIconY: ICON_DEFAULTS.heroIconY,
  heroIconGap: ICON_DEFAULTS.heroIconGap,
  heroTitleTracking: 0.04,
  heroTitleScale: 100,
  heroContentY: 0,
  heroToplineSize: 20,
  heroToplineX: 0,
  heroToplineY: 0,
  heroToplineWeight: 500,
  heroToplineTracking: 0.35,
  heroTitleSize: 158,
  heroTitleX: 0,
  heroTitleY: 0,
  heroTitleWeight: 400,
  heroTitleLineHeight: 1.05,
  heroTaglineSize: 30,
  heroTaglineX: 0,
  heroTaglineY: 0,
  heroTaglineWeight: 400,
  heroTaglineTracking: 0,
  heroGradient: EFFECT_DEFAULTS.heroGradient,
  heroDither: EFFECT_DEFAULTS.heroDither,
  heroDitherStyle: "blueNoise",
  heroDitherSize: 1.1,
  heroDitherPrecision: 2.5,
  heroEffectScope: EFFECT_DEFAULTS.heroEffectScope,
  heroNoise: 0,
  heroBase: "#07060a",
  heroGold: "#c9a55c",
  heroWhite: "#fff7df",
};

const STORAGE_KEY = "masterbranch-hero-config-v6";
const LEGACY_STORAGE_KEYS = ["masterbranch-hero-config-v5", "masterbranch-hero-config-v4", "masterbranch-font-config"];

function parseStoredConfig(raw: string, forceEffectDefaults = false, forceIconDefaults = false): Config {
  const stored = JSON.parse(raw) as Partial<Config>;
  const config = { ...DEFAULTS, ...stored, ...(forceEffectDefaults ? EFFECT_DEFAULTS : {}) };

  if (stored.topbarLogoSize === 44 || stored.topbarLogoSize === 48) config.topbarLogoSize = ICON_DEFAULTS.topbarLogoSize;

  if (forceIconDefaults) {
    if (stored.topbarLogoSize === undefined || stored.topbarLogoSize === 36) config.topbarLogoSize = ICON_DEFAULTS.topbarLogoSize;
    if (stored.socialIconSize === undefined) config.socialIconSize = ICON_DEFAULTS.socialIconSize;
    if (stored.heroIconSize === undefined) config.heroIconSize = ICON_DEFAULTS.heroIconSize;
    if (stored.heroIconY === undefined) config.heroIconY = ICON_DEFAULTS.heroIconY;
    if (stored.heroIconGap === undefined) config.heroIconGap = ICON_DEFAULTS.heroIconGap;
  }

  return config;
}

function loadConfig(): Config {
  if (typeof window === "undefined") return DEFAULTS;
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (raw) return parseStoredConfig(raw);

    for (const key of LEGACY_STORAGE_KEYS) {
      const legacy = localStorage.getItem(key);
      if (legacy) return parseStoredConfig(legacy, key !== "masterbranch-hero-config-v5", true);
    }

    return DEFAULTS;
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
  const bodyFontVar = c.textFont === "cormorant" ? "var(--font-cormorant)" : "var(--font-cinzel)";
  rules.push(`:root { --font-body-text: ${bodyFontVar}; }`);
  rules.push(`html { font-size: ${c.rootSize}px !important; }`);

  rules.push(`
    :root, .dark {
      --foreground: rgba(255, 255, 255, ${c.textBrightness / 100}) !important;
      --card-foreground: rgba(255, 255, 255, ${c.cardTextBrightness / 100}) !important;
    }
  `);

  const hRules: string[] = [];
  if (c.headingScale !== 100) hRules.push(`font-size: calc(1em * ${(c.headingScale / 100).toFixed(2)})`);
  if (c.headingWeight !== 400) hRules.push(`font-weight: ${c.headingWeight}`);
  if (c.headingTracking !== 0) hRules.push(`letter-spacing: ${c.headingTracking}em`);
  if (hRules.length > 0) rules.push(`.landing-section-heading, .landing-step-title, .landing-principle-title { ${hRules.map((r) => r + " !important").join("; ")}; }`);
  rules.push(`.landing-section-heading { margin-top: ${c.headingTopSpacing}px !important; }`);

  const bRules: string[] = [];
  if (c.brandScale !== 100) bRules.push(`font-size: calc(1em * ${(c.brandScale / 100).toFixed(2)})`);
  if (c.brandWeight !== 400) bRules.push(`font-weight: ${c.brandWeight}`);
  if (c.brandTracking !== 0.05) bRules.push(`letter-spacing: ${c.brandTracking}em`);
  if (bRules.length > 0) rules.push(`.landing-hero-title { ${bRules.map((r) => r + " !important").join("; ")}; }`);

  if (c.monoSize !== 14) rules.push(`.font-mono, code, pre { font-size: ${c.monoSize}px !important; }`);

  rules.push(`
    .topbar-text {
      font-size: ${c.topbarSize}px !important;
      font-weight: ${c.topbarWeight} !important;
      letter-spacing: ${c.topbarTracking}em !important;
    }
    .topbar-brand-group,
    .topbar-link-group {
      gap: ${c.topbarGap}px !important;
    }
    .topbar-nav {
      min-height: max(44px, calc(${c.topbarLogoSize}px + 10px)) !important;
    }
    .topbar-logo {
      width: ${c.topbarLogoSize}px !important;
      height: ${c.topbarLogoSize}px !important;
      filter: none !important;
    }
    .topbar-social-icon {
      width: ${c.socialIconSize}px !important;
      height: ${c.socialIconSize}px !important;
    }
    .landing-body-text {
      font-size: ${c.bodyTextSize}px !important;
      font-weight: ${c.bodyWeight} !important;
      line-height: ${c.bodyLineHeight} !important;
      letter-spacing: ${c.bodyTracking}em !important;
    }
    .landing-copy-block {
      margin-top: ${c.bodyBlockSpacing}px !important;
    }
    .landing-copy-block-first {
      margin-top: ${c.bodyFirstBlockSpacing}px !important;
    }
    .landing-qa-pair > * + * {
      margin-top: ${c.callResponseGap}px !important;
    }
    .landing-list > * + * {
      margin-top: ${c.listItemSpacing}px !important;
    }
  `);

  if (c.contentAlignment === "columnLeft") {
    rules.push(`
      #manifesto .landing-section-body {
        width: fit-content !important;
        max-width: min(100%, ${c.contentColumnWidth}px) !important;
        margin-inline: auto !important;
        text-align: left !important;
      }
      #manifesto .landing-section-body .landing-call-response {
        align-items: stretch !important;
        text-align: left !important;
      }
      #manifesto .landing-section-body .landing-call-response > div {
        width: 100% !important;
      }
    `);
  } else {
    rules.push(`
      #manifesto .landing-section-body {
        width: auto !important;
        max-width: none !important;
        margin-inline: 0 !important;
        text-align: center !important;
      }
      #manifesto .landing-section-body .landing-call-response {
        align-items: center !important;
        text-align: center !important;
      }
    `);
  }

  if (c.scheduleLayout === "alignedGrid") {
    rules.push(`
      .landing-schedule-list {
        width: min(100%, ${c.scheduleColumnWidth}px) !important;
        margin-inline: auto !important;
        display: block !important;
      }
      .landing-schedule-item {
        display: block !important;
      }
      .landing-schedule-row {
        display: grid !important;
        grid-template-columns: minmax(0, 1fr) minmax(${c.scheduleTitleWidth}px, 288px) minmax(0, 1fr) !important;
        align-items: baseline !important;
        column-gap: clamp(24px, 4vw, 48px) !important;
        margin-inline: auto !important;
        width: min(100%, 768px) !important;
        text-align: center !important;
      }
      .landing-schedule-num {
        grid-column: 1 !important;
        justify-self: end !important;
        text-align: right !important;
      }
      .landing-schedule-main {
        display: block !important;
        grid-column: 2 !important;
        min-width: 0 !important;
        text-align: center !important;
      }
      .landing-schedule-main .landing-step-title,
      .landing-schedule-desc {
        white-space: nowrap !important;
      }
      .landing-schedule-time {
        grid-column: 3 !important;
        justify-self: start !important;
        text-align: left !important;
        white-space: nowrap !important;
      }
      .landing-schedule-desc {
        max-width: none !important;
        text-align: center !important;
      }
    `);
  } else {
    rules.push(`
      .landing-schedule-list {
        width: auto !important;
        margin-inline: 0 !important;
      }
      .landing-schedule-row {
        display: grid !important;
        grid-template-columns: minmax(0, 1fr) minmax(${c.scheduleTitleWidth}px, 288px) minmax(0, 1fr) !important;
        align-items: baseline !important;
        column-gap: clamp(24px, 4vw, 48px) !important;
        margin-inline: auto !important;
        width: min(100%, 768px) !important;
        text-align: center !important;
      }
      .landing-schedule-main {
        display: block !important;
        margin-inline: auto !important;
        width: min(100%, ${c.scheduleTitleWidth}px) !important;
        min-width: 0 !important;
        text-align: center !important;
      }
      .landing-schedule-main .landing-step-title,
      .landing-schedule-desc {
        white-space: nowrap !important;
      }
      .landing-schedule-desc {
        max-width: none !important;
        text-align: center !important;
      }
      .landing-schedule-num {
        grid-column: 1 !important;
        justify-self: end !important;
        text-align: right !important;
      }
      .landing-schedule-time {
        grid-column: 3 !important;
        justify-self: start !important;
        text-align: left !important;
        white-space: nowrap !important;
      }
    `);
  }

  const effectTarget = c.heroEffectScope === "page" ? "body" : "#hero";
  const contentZIndex = c.heroEffectScope === "page" ? "auto" : "1";
  const effectZIndex = c.heroEffectScope === "page" ? "60" : "0";
  const pct = (value: number) => Math.max(0, Math.min(100, Math.round(value)));
  const alpha = (value: number) => Math.max(0, Math.min(0.72, value));
  const dotAlpha = alpha(c.heroDither / 140);
  const dotSize = Math.max(0.2, Math.min(2.4, c.heroDitherSize));
  const precision = Math.max(1.5, Math.min(12, c.heroDitherPrecision));
  const blueNoisePattern = [
    "15% 18%", "42% 9%", "76% 22%", "91% 48%", "58% 61%", "24% 72%", "8% 91%", "69% 88%",
    "34% 38%", "83% 74%", "51% 29%", "4% 55%", "96% 6%", "63% 43%", "18% 49%", "47% 82%",
  ].map((pos) => `radial-gradient(circle at ${pos}, rgba(255,255,255,${dotAlpha}) 0 ${dotSize}px, transparent ${dotSize + 0.35}px)`).join(",\n        ");
  const ditherPattern = c.heroDitherStyle === "halftone"
    ? `radial-gradient(circle, rgba(255,255,255,${dotAlpha}) 0 ${dotSize}px, transparent ${dotSize + 0.8}px)`
    : c.heroDitherStyle === "blueNoise"
      ? blueNoisePattern
      : `radial-gradient(circle, rgba(255,255,255,${dotAlpha}) 0 ${dotSize}px, transparent ${dotSize + 0.35}px)`;
  const ditherCell = c.heroDitherStyle === "blueNoise" ? precision * 8 : precision;
  const ditherSize = c.heroDitherStyle === "blueNoise"
    ? Array.from({ length: 16 }, () => `${ditherCell}px ${ditherCell}px`).join(", ")
    : `${ditherCell}px ${ditherCell}px`;

  rules.push(`
    ${effectTarget} {
      isolation: isolate;
      background:
        radial-gradient(ellipse 72% 46% at 50% 110%, color-mix(in srgb, ${c.heroGold} ${pct(c.heroGradient * 0.86)}%, transparent), transparent 64%),
        radial-gradient(ellipse 54% 36% at 0% 0%, color-mix(in srgb, ${c.heroWhite} ${pct(c.heroGradient * 0.26)}%, transparent), transparent 68%),
        linear-gradient(
          180deg,
          ${c.heroBase} 0%,
          color-mix(in srgb, #060504 ${pct(c.heroGradient)}%, ${c.heroBase}) 48%,
          color-mix(in srgb, #0f0b05 ${pct(c.heroGradient)}%, ${c.heroBase}) 78%,
          color-mix(in srgb, #1c1408 ${pct(c.heroGradient)}%, ${c.heroBase}) 100%
        ) !important;
    }

    ${effectTarget}::before,
    ${effectTarget}::after {
      content: "";
      position: ${c.heroEffectScope === "page" ? "fixed" : "absolute"};
      inset: 0;
      pointer-events: none;
    }

    ${effectTarget}::before {
      z-index: ${effectZIndex};
      opacity: ${alpha(c.heroNoise / 160)};
      mix-blend-mode: soft-light;
      background-image: url("data:image/svg+xml,%3Csvg viewBox='0 0 180 180' xmlns='http://www.w3.org/2000/svg'%3E%3Cfilter id='n'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='.92' numOctaves='3' stitchTiles='stitch'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23n)' opacity='.72'/%3E%3C/svg%3E");
    }

    ${effectTarget}::after {
      z-index: ${effectZIndex};
      opacity: 1;
      background-image: ${ditherPattern};
      background-size: ${ditherSize};
      mix-blend-mode: screen;
    }

    #hero > * {
      position: relative;
      z-index: ${contentZIndex};
    }

    #hero .landing-hero-icon {
      width: ${c.heroIconSize}px !important;
      height: ${c.heroIconSize}px !important;
      margin-bottom: ${c.heroIconGap}px !important;
      transform: translateY(${c.heroIconY}px) !important;
    }
    #hero .landing-hero-content { transform: translateY(${c.heroContentY}px) !important; }
    #hero .landing-hero-topline {
      font-size: ${c.heroToplineSize}px !important;
      font-weight: ${c.heroToplineWeight} !important;
      letter-spacing: ${c.heroToplineTracking}em !important;
      transform: translate(${c.heroToplineX}px, ${c.heroToplineY}px) !important;
    }
    #hero .landing-hero-title {
      font-size: ${c.heroTitleSize}px !important;
      font-weight: ${c.heroTitleWeight} !important;
      line-height: ${c.heroTitleLineHeight} !important;
      letter-spacing: ${c.heroTitleTracking}em !important;
      transform: translate(${c.heroTitleX}px, ${c.heroTitleY}px) scale(${(c.heroTitleScale / 100).toFixed(2)}) !important;
      transform-origin: center;
    }
    #hero .landing-hero-title span { font-weight: inherit !important; letter-spacing: inherit !important; }
    #hero .landing-hero-title-two { display: ${c.heroTitleLayout === "2-line" ? "block" : "none"} !important; }
    #hero .landing-hero-title-three { display: ${c.heroTitleLayout === "3-line" ? "block" : "none"} !important; }
    #hero .landing-hero-tagline {
      font-size: ${c.heroTaglineSize}px !important;
      font-weight: ${c.heroTaglineWeight} !important;
      letter-spacing: ${c.heroTaglineTracking}em !important;
      transform: translate(${c.heroTaglineX}px, ${c.heroTaglineY}px) !important;
    }
  `);

  el.textContent = rules.join("\n");
  requestAnimationFrame(() => window.dispatchEvent(new Event("resize")));
}

function clearConfig() {
  const el = document.getElementById(STYLE_ID);
  if (el) el.textContent = "";
  try {
    localStorage.removeItem(STORAGE_KEY);
    for (const key of LEGACY_STORAGE_KEYS) localStorage.removeItem(key);
  } catch {}
}

export function FontConfigurator() {
  const [open, setOpen] = useState(false);
  const [copied, setCopied] = useState(false);
  const [config, setConfig] = useState<Config>(() => loadConfig());
  const panelRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const isPreviewFrame = new URLSearchParams(window.location.search).has("viewportFrame");
    document.documentElement.classList.toggle("viewport-frame", isPreviewFrame);
    return () => document.documentElement.classList.remove("viewport-frame");
  }, []);

  useEffect(() => {
    applyConfig(config);
    saveConfig(config);
  }, [config]);

  useEffect(() => {
    const handler = (e: StorageEvent) => {
      if (e.storageArea !== localStorage) return;
      if (e.key !== STORAGE_KEY && !LEGACY_STORAGE_KEYS.includes(e.key ?? "")) return;
      setConfig(loadConfig());
    };
    window.addEventListener("storage", handler);
    return () => window.removeEventListener("storage", handler);
  }, []);

  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.shiftKey && e.key === "F") {
        e.preventDefault();
        setOpen((o) => !o);
      }
      if (e.key === "Escape" && open) setOpen(false);
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

  const handleCopy = useCallback(async () => {
    try {
      await navigator.clipboard.writeText(JSON.stringify({ storageKey: STORAGE_KEY, config }, null, 2));
      setCopied(true);
      window.setTimeout(() => setCopied(false), 1200);
    } catch {}
  }, [config]);

  if (!open) {
    return <button className="font-configurator-fab" onClick={() => setOpen(true)} style={fabStyle} title="Font Configurator (Cmd+Shift+F)">Aa</button>;
  }

  return (
    <div ref={panelRef} className="font-configurator-panel" style={panelStyle}>
      <div style={headerStyle}>
        <span style={titleStyle}>Hero Configurator</span>
        <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
          <button onClick={handleCopy} style={resetBtnStyle}>{copied ? "Copied" : "Copy"}</button>
          <button onClick={handleReset} style={resetBtnStyle}>Reset</button>
          <button onClick={() => setOpen(false)} style={closeBtnStyle}>&times;</button>
        </div>
      </div>

      <Section title="Hero Effects" subtitle="Gradient, noise, dither">
        <Segmented label="Scope" value={config.heroEffectScope} options={["hero", "page"]} onChange={(v) => update("heroEffectScope", v as EffectScope)} />
        <Slider label="Gradient" value={config.heroGradient} onChange={(v) => update("heroGradient", v)} min={0} max={100} step={5} unit="%" />
        <Slider label="Dither" value={config.heroDither} onChange={(v) => update("heroDither", v)} min={0} max={100} step={1} unit="%" />
        <Segmented label="Dither" value={config.heroDitherStyle} options={["blueNoise", "dot", "halftone"]} onChange={(v) => update("heroDitherStyle", v as DitherStyle)} />
        <Slider label="Dot size" value={config.heroDitherSize} onChange={(v) => update("heroDitherSize", v)} min={0.3} max={2.4} step={0.1} unit="px" />
        <Slider label="Precision" value={config.heroDitherPrecision} onChange={(v) => update("heroDitherPrecision", v)} min={1.5} max={12} step={0.5} unit="px" />
        <Slider label="Noise" value={config.heroNoise} onChange={(v) => update("heroNoise", v)} min={0} max={100} step={5} unit="%" />
        <ColorInput label="Black" value={config.heroBase} onChange={(v) => update("heroBase", v)} />
        <ColorInput label="Gold" value={config.heroGold} onChange={(v) => update("heroGold", v)} />
        <ColorInput label="White" value={config.heroWhite} onChange={(v) => update("heroWhite", v)} />
      </Section>

      <Section title="Icons" subtitle="Top nav and hero marks">
        <Slider label="Nav mark" value={config.topbarLogoSize} onChange={(v) => update("topbarLogoSize", v)} min={24} max={72} step={1} unit="px" />
        <Slider label="Social" value={config.socialIconSize} onChange={(v) => update("socialIconSize", v)} min={14} max={40} step={1} unit="px" />
        <Slider label="Hero mark" value={config.heroIconSize} onChange={(v) => update("heroIconSize", v)} min={32} max={140} step={2} unit="px" />
        <Slider label="Hero Y" value={config.heroIconY} onChange={(v) => update("heroIconY", v)} min={-80} max={80} step={2} unit="px" />
        <Slider label="Hero gap" value={config.heroIconGap} onChange={(v) => update("heroIconGap", v)} min={0} max={80} step={1} unit="px" />
      </Section>

      <Section title="Hero Layout" subtitle="Direct layer controls">
        <Segmented label="Layout" value={config.heroTitleLayout} options={["2-line", "3-line"]} onChange={(v) => update("heroTitleLayout", v as HeroTitleLayout)} />
        <Slider label="Group Y" value={config.heroContentY} onChange={(v) => update("heroContentY", v)} min={-180} max={180} step={4} unit="px" />
        <Slider label="Top size" value={config.heroToplineSize} onChange={(v) => update("heroToplineSize", v)} min={10} max={64} step={1} unit="px" />
        <Slider label="Top X" value={config.heroToplineX} onChange={(v) => update("heroToplineX", v)} min={-160} max={160} step={2} unit="px" />
        <Slider label="Top Y" value={config.heroToplineY} onChange={(v) => update("heroToplineY", v)} min={-120} max={120} step={2} unit="px" />
        <Slider label="Top wt" value={config.heroToplineWeight} onChange={(v) => update("heroToplineWeight", v)} min={300} max={900} step={100} unit="" />
        <Slider label="Top trk" value={config.heroToplineTracking} onChange={(v) => update("heroToplineTracking", v)} min={-0.05} max={0.6} step={0.01} unit="em" />
        <Slider label="Title px" value={config.heroTitleSize} onChange={(v) => update("heroTitleSize", v)} min={56} max={260} step={2} unit="px" />
        <Slider label="Title X" value={config.heroTitleX} onChange={(v) => update("heroTitleX", v)} min={-160} max={160} step={2} unit="px" />
        <Slider label="Title Y" value={config.heroTitleY} onChange={(v) => update("heroTitleY", v)} min={-160} max={160} step={2} unit="px" />
        <Slider label="Title wt" value={config.heroTitleWeight} onChange={(v) => update("heroTitleWeight", v)} min={300} max={900} step={100} unit="" />
        <Slider label="Leading" value={config.heroTitleLineHeight} onChange={(v) => update("heroTitleLineHeight", v)} min={0.72} max={1.3} step={0.01} unit="" />
        <Slider label="Scale" value={config.heroTitleScale} onChange={(v) => update("heroTitleScale", v)} min={70} max={140} step={5} unit="%" />
        <Slider label="Tracking" value={config.heroTitleTracking} onChange={(v) => update("heroTitleTracking", v)} min={-0.08} max={0.16} step={0.005} unit="em" />
        <Slider label="Tag size" value={config.heroTaglineSize} onChange={(v) => update("heroTaglineSize", v)} min={12} max={92} step={1} unit="px" />
        <Slider label="Tag X" value={config.heroTaglineX} onChange={(v) => update("heroTaglineX", v)} min={-160} max={160} step={2} unit="px" />
        <Slider label="Tag Y" value={config.heroTaglineY} onChange={(v) => update("heroTaglineY", v)} min={-140} max={140} step={2} unit="px" />
        <Slider label="Tag wt" value={config.heroTaglineWeight} onChange={(v) => update("heroTaglineWeight", v)} min={300} max={900} step={100} unit="" />
        <Slider label="Tag trk" value={config.heroTaglineTracking} onChange={(v) => update("heroTaglineTracking", v)} min={-0.05} max={0.2} step={0.005} unit="em" />
      </Section>

      <Section title="Top Bar" subtitle="Logo, nav text, spacing">
        <Slider label="Size" value={config.topbarSize} onChange={(v) => update("topbarSize", v)} min={10} max={28} step={1} unit="px" />
        <Slider label="Weight" value={config.topbarWeight} onChange={(v) => update("topbarWeight", v)} min={300} max={900} step={100} unit="" />
        <Slider label="Tracking" value={config.topbarTracking} onChange={(v) => update("topbarTracking", v)} min={-0.04} max={0.2} step={0.005} unit="em" />
        <Slider label="Gap" value={config.topbarGap} onChange={(v) => update("topbarGap", v)} min={4} max={48} step={1} unit="px" />
      </Section>

      <Section title="Body Font" subtitle="Regular page text typeface">
        <div style={{ display: "flex", gap: 6, padding: "5px 10px" }}>
          {(["cinzel", "cormorant"] as const).map((f) => (
            <button key={f} onClick={() => update("textFont", f)} style={{ ...toggleStyle, border: config.textFont === f ? "1px solid rgba(201,165,92,0.5)" : "1px solid rgba(255,255,255,0.08)", background: config.textFont === f ? "rgba(201,165,92,0.12)" : "rgba(255,255,255,0.03)", color: config.textFont === f ? "#c9a55c" : "#9d97aa" }}>{f}</button>
          ))}
        </div>
      </Section>

      <Section title="Headings" subtitle="Section and list titles">
        <Slider label="Scale" value={config.headingScale} onChange={(v) => update("headingScale", v)} min={70} max={180} step={5} unit="%" />
        <Slider label="Weight" value={config.headingWeight} onChange={(v) => update("headingWeight", v)} min={300} max={900} step={100} unit="" />
        <Slider label="Tracking" value={config.headingTracking} onChange={(v) => update("headingTracking", v)} min={-0.05} max={0.18} step={0.005} unit="em" />
        <Slider label="Top gap" value={config.headingTopSpacing} onChange={(v) => update("headingTopSpacing", v)} min={0} max={120} step={2} unit="px" />
      </Section>

      <Section title="Content Layout" subtitle="Body column and schedule rows">
        <Segmented label="Copy" value={config.contentAlignment} options={["center", "columnLeft"]} onChange={(v) => update("contentAlignment", v as ContentAlignment)} />
        <Slider label="Copy col" value={config.contentColumnWidth} onChange={(v) => update("contentColumnWidth", v)} min={320} max={760} step={10} unit="px" />
        <Segmented label="Schedule" value={config.scheduleLayout} options={["center", "alignedGrid"]} onChange={(v) => update("scheduleLayout", v as ScheduleLayout)} />
        <Slider label="Sched col" value={config.scheduleColumnWidth} onChange={(v) => update("scheduleColumnWidth", v)} min={320} max={760} step={10} unit="px" />
        <Slider label="Num col" value={config.scheduleNumWidth} onChange={(v) => update("scheduleNumWidth", v)} min={24} max={96} step={2} unit="px" />
        <Slider label="Title col" value={config.scheduleTitleWidth} onChange={(v) => update("scheduleTitleWidth", v)} min={90} max={300} step={5} unit="px" />
        <Slider label="Time col" value={config.scheduleTimeWidth} onChange={(v) => update("scheduleTimeWidth", v)} min={48} max={130} step={2} unit="px" />
      </Section>

      <Section title="Body Text" subtitle="Regular page copy only">
        <Slider label="Size" value={config.bodyTextSize} onChange={(v) => update("bodyTextSize", v)} min={12} max={42} step={1} unit="px" />
        <Slider label="Weight" value={config.bodyWeight} onChange={(v) => update("bodyWeight", v)} min={300} max={700} step={100} unit="" />
        <Slider label="Leading" value={config.bodyLineHeight} onChange={(v) => update("bodyLineHeight", v)} min={1} max={2.2} step={0.05} unit="" />
        <Slider label="Tracking" value={config.bodyTracking} onChange={(v) => update("bodyTracking", v)} min={-0.05} max={0.14} step={0.005} unit="em" />
        <Slider label="First gap" value={config.bodyFirstBlockSpacing} onChange={(v) => update("bodyFirstBlockSpacing", v)} min={0} max={120} step={2} unit="px" />
        <Slider label="Text gap" value={config.bodyBlockSpacing} onChange={(v) => update("bodyBlockSpacing", v)} min={0} max={100} step={2} unit="px" />
        <Slider label="QA gap" value={config.callResponseGap} onChange={(v) => update("callResponseGap", v)} min={0} max={80} step={2} unit="px" />
        <Slider label="List gap" value={config.listItemSpacing} onChange={(v) => update("listItemSpacing", v)} min={0} max={120} step={2} unit="px" />
      </Section>

      <Section title="Text Brightness" subtitle="Foreground opacity">
        <Slider label="Body" value={config.textBrightness} onChange={(v) => update("textBrightness", v)} min={30} max={100} step={5} unit="%" />
        <Slider label="Cards" value={config.cardTextBrightness} onChange={(v) => update("cardTextBrightness", v)} min={40} max={100} step={5} unit="%" />
      </Section>

      <div style={footerStyle}>Cmd+Shift+F to toggle &middot; Settings persist across reloads</div>
    </div>
  );
}

function Section({ title, subtitle, children }: { title: string; subtitle: string; children: React.ReactNode }) {
  return (
    <div style={{ borderBottom: "1px solid rgba(255,255,255,0.04)" }}>
      <div style={{ padding: "10px 16px 2px" }}>
        <div
          style={{
            fontSize: 11,
            fontWeight: 600,
            letterSpacing: "0.08em",
            textTransform: "uppercase",
            color: "#c9a55c",
          }}
        >
          {title}
        </div>
        <div style={{ fontSize: 10, color: "#555", marginTop: 1 }}>{subtitle}</div>
      </div>
      <div style={{ padding: "4px 8px 8px" }}>{children}</div>
    </div>
  );
}

function Slider({ label, value, onChange, min, max, step, unit }: { label: string; value: number; onChange: (v: number) => void; min: number; max: number; step: number; unit: string }) {
  const display = step < 1 ? value.toFixed(step < 0.01 ? 3 : 2) : value;
  return (
    <div style={rowStyle}>
      <span style={labelStyle}>{label}</span>
      <input
        type="range"
        min={min}
        max={max}
        step={step}
        value={value}
        onChange={(e) => onChange(parseFloat(e.target.value))}
        style={rangeStyle}
      />
      <span style={valueStyle}>
        {display}
        {unit}
      </span>
    </div>
  );
}

function Segmented({ label, value, options, onChange }: { label: string; value: string; options: string[]; onChange: (v: string) => void }) {
  return (
    <div style={rowStyle}>
      <span style={labelStyle}>{label}</span>
      <div style={{ display: "flex", flex: 1, gap: 5 }}>
        {options.map((option) => {
          const active = value === option;
          return (
            <button
              key={option}
              onClick={() => onChange(option)}
              style={{
                ...segmentStyle,
                border: active ? "1px solid rgba(201,165,92,0.5)" : "1px solid rgba(255,255,255,0.08)",
                background: active ? "rgba(201,165,92,0.12)" : "rgba(255,255,255,0.03)",
                color: active ? "#c9a55c" : "#9d97aa",
              }}
            >
              {option}
            </button>
          );
        })}
      </div>
    </div>
  );
}

function ColorInput({ label, value, onChange }: { label: string; value: string; onChange: (v: string) => void }) {
  return (
    <div style={rowStyle}>
      <span style={labelStyle}>{label}</span>
      <input type="color" value={value} onChange={(e) => onChange(e.target.value)} style={colorStyle} />
      <input value={value} onChange={(e) => onChange(e.target.value)} style={textInputStyle} />
    </div>
  );
}

const panelStyle: React.CSSProperties = {
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
};

const fabStyle: React.CSSProperties = {
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
  backdropFilter: "blur(10px)",
};

const headerStyle: React.CSSProperties = {
  display: "flex",
  justifyContent: "space-between",
  alignItems: "center",
  padding: "14px 16px",
  borderBottom: "1px solid rgba(255,255,255,0.06)",
};

const titleStyle: React.CSSProperties = {
  fontSize: 11,
  fontWeight: 600,
  letterSpacing: "0.1em",
  textTransform: "uppercase",
  color: "#c9a55c",
};

const resetBtnStyle: React.CSSProperties = {
  fontSize: 10,
  color: "#9d97aa",
  background: "rgba(255,255,255,0.05)",
  border: "1px solid rgba(255,255,255,0.08)",
  borderRadius: 4,
  padding: "4px 8px",
  cursor: "pointer",
  letterSpacing: "0.05em",
  textTransform: "uppercase",
};

const closeBtnStyle: React.CSSProperties = {
  fontSize: 16,
  color: "#9d97aa",
  background: "none",
  border: "none",
  cursor: "pointer",
  padding: "0 2px",
};

const footerStyle: React.CSSProperties = {
  padding: "10px 16px",
  borderTop: "1px solid rgba(255,255,255,0.06)",
  fontSize: 10,
  color: "#555",
  textAlign: "center",
  letterSpacing: "0.04em",
};

const rowStyle: React.CSSProperties = {
  display: "flex",
  alignItems: "center",
  gap: 8,
  padding: "5px 10px",
};

const labelStyle: React.CSSProperties = {
  fontSize: 10,
  color: "#9d97aa",
  minWidth: 55,
  textTransform: "uppercase",
  letterSpacing: "0.04em",
};

const rangeStyle: React.CSSProperties = {
  flex: 1,
  height: 4,
  accentColor: "#c9a55c",
  cursor: "pointer",
};

const valueStyle: React.CSSProperties = {
  fontSize: 11,
  color: "#e0c882",
  minWidth: 44,
  textAlign: "right",
  fontVariantNumeric: "tabular-nums",
};

const colorStyle: React.CSSProperties = {
  width: 38,
  height: 24,
  padding: 0,
  border: "1px solid rgba(255,255,255,0.12)",
  borderRadius: 4,
  background: "transparent",
  cursor: "pointer",
};

const textInputStyle: React.CSSProperties = {
  flex: 1,
  height: 24,
  border: "1px solid rgba(255,255,255,0.08)",
  borderRadius: 4,
  background: "rgba(255,255,255,0.04)",
  color: "#e0c882",
  padding: "0 7px",
  fontSize: 11,
  fontFamily: "monospace",
};

const segmentStyle: React.CSSProperties = {
  flex: 1,
  padding: "5px 4px",
  fontSize: 10,
  fontWeight: 600,
  borderRadius: 4,
  cursor: "pointer",
};

const toggleStyle: React.CSSProperties = {
  flex: 1,
  padding: "5px 0",
  fontSize: 10,
  fontWeight: 600,
  letterSpacing: "0.08em",
  textTransform: "uppercase",
  borderRadius: 4,
  cursor: "pointer",
};
