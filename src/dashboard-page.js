"use strict";

let cachedHtml = null;

function renderDashboardHtml() {
  if (cachedHtml) return cachedHtml;
  cachedHtml = `<!doctype html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <title>DigiByte Pool Dashboard</title>
  <meta name="color-scheme" content="dark light">
  <link rel="preconnect" href="https://fonts.googleapis.com">
  <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
  <link href="https://fonts.googleapis.com/css2?family=JetBrains+Mono:wght@500;600;700&family=Outfit:wght@400;500;600;700;800&display=swap" rel="stylesheet">
  <style>
    :root {
      --bg-0: #020202;
      --bg-1: #080808;
      --bg-2: #111111;
      --bg-3: #1a1a1a;
      --surface: rgba(9, 9, 9, 0.82);
      --surface-strong: rgba(8, 8, 8, 0.94);
      --surface-soft: rgba(17, 17, 17, 0.88);
      --ink-0: #f2f2f2;
      --ink-1: #cbced6;
      --ink-2: #9a9da6;
      --ink-3: #6b6e78;
      --line: rgba(255, 255, 255, 0.16);
      --line-soft: rgba(255, 255, 255, 0.08);
      --aqua: #5af3d9;
      --cyan: #74bfff;
      --blue: #95acff;
      --amber: #ffc15f;
      --orange: #ff974f;
      --green: #6df3a2;
      --red: #ff7478;
      --lime: #a6ff6f;
      --teal: #56e9cf;
      --radius-xs: 10px;
      --radius-sm: 14px;
      --radius: 18px;
      --radius-lg: 24px;
      --shadow-xs: 0 8px 24px rgba(0, 0, 0, 0.32);
      --shadow-sm: 0 16px 40px rgba(0, 0, 0, 0.4);
      --shadow: 0 24px 70px rgba(0, 0, 0, 0.46);
      --shadow-lg: 0 36px 100px rgba(0, 0, 0, 0.54);
      --mono: "JetBrains Mono", "SF Mono", Consolas, monospace;
      --sans: "Outfit", "Avenir Next", "Segoe UI", sans-serif;
    }

    [data-theme="light"] {
      --bg-0: #f8f3e8;
      --bg-1: #fffdf8;
      --bg-2: #f2ebdf;
      --bg-3: #e8dfd0;
      --surface: rgba(255, 253, 247, 0.82);
      --surface-strong: rgba(255, 253, 247, 0.94);
      --surface-soft: rgba(244, 236, 224, 0.9);
      --ink-0: #1d2734;
      --ink-1: #3a495e;
      --ink-2: #66778e;
      --ink-3: #8795a8;
      --line: rgba(36, 52, 76, 0.18);
      --line-soft: rgba(36, 52, 76, 0.08);
      --aqua: #0cae99;
      --cyan: #2f76dd;
      --blue: #4f76db;
      --amber: #d68d24;
      --orange: #c96a33;
      --green: #269960;
      --red: #c94e5a;
      --lime: #5e9b31;
      --teal: #1f9886;
      --shadow-xs: 0 8px 20px rgba(52, 68, 94, 0.09);
      --shadow-sm: 0 15px 34px rgba(52, 68, 94, 0.12);
      --shadow: 0 22px 52px rgba(52, 68, 94, 0.16);
      --shadow-lg: 0 34px 82px rgba(52, 68, 94, 0.2);
    }

    * {
      box-sizing: border-box;
      margin: 0;
      padding: 0;
    }

    html,
    body {
      min-height: 100%;
      min-height: 100dvh;
      overflow-x: clip;
      -webkit-text-size-adjust: 100%;
      text-size-adjust: 100%;
    }

    body {
      font-family: var(--sans);
      color: var(--ink-0);
      line-height: 1.45;
      background:
        linear-gradient(145deg, #040404, #080808 45%, #0d0d0d 100%);
      -webkit-font-smoothing: antialiased;
      -moz-osx-font-smoothing: grayscale;
      transition: background 0.35s ease, color 0.35s ease;
    }

    body[data-theme="light"] {
      background:
        radial-gradient(980px 560px at 50% 118%, rgba(126, 204, 180, 0.14), transparent 70%),
        linear-gradient(145deg, #f8f3e8, #f1eadf 45%, #e9e1d4 100%);
    }

    .bg-grid::before {
      content: "";
      position: fixed;
      inset: 0;
      pointer-events: none;
      z-index: 0;
      background-image:
        linear-gradient(rgba(255, 255, 255, 0.04) 1px, transparent 1px),
        linear-gradient(90deg, rgba(255, 255, 255, 0.04) 1px, transparent 1px);
      background-size: 34px 34px;
      mask-image: radial-gradient(ellipse at 50% 5%, rgba(0, 0, 0, 0.95) 20%, transparent 72%);
      opacity: 0.28;
    }

    body[data-theme="light"].bg-grid::before {
      background-image:
        linear-gradient(rgba(49, 67, 95, 0.06) 1px, transparent 1px),
        linear-gradient(90deg, rgba(49, 67, 95, 0.06) 1px, transparent 1px);
      opacity: 0.38;
    }

    .wrap {
      --page-pad: clamp(14px, 1.8vw, 30px);
      position: relative;
      z-index: 1;
      width: min(1680px, 100%);
      margin: 0 auto;
      padding: var(--page-pad);
      padding-top: max(var(--page-pad), env(safe-area-inset-top));
      padding-right: max(var(--page-pad), env(safe-area-inset-right));
      padding-bottom: max(var(--page-pad), env(safe-area-inset-bottom));
      padding-left: max(var(--page-pad), env(safe-area-inset-left));
      display: grid;
      gap: clamp(14px, 1.4vw, 22px);
    }

    .hero {
      position: relative;
      border: 1px solid var(--line);
      border-radius: clamp(18px, 2.4vw, 30px);
      padding: clamp(18px, 2.4vw, 36px);
      background:
        linear-gradient(140deg, rgba(16, 16, 16, 0.9), rgba(8, 8, 8, 0.96)),
        var(--surface-strong);
      backdrop-filter: blur(18px);
      box-shadow: var(--shadow-lg);
      display: grid;
      gap: clamp(16px, 2vw, 30px);
      grid-template-columns: minmax(0, 1.2fr) minmax(0, 1fr);
      overflow: hidden;
      isolation: isolate;
    }

    [data-theme="light"] .hero {
      background:
        linear-gradient(140deg, rgba(255, 253, 248, 0.96), rgba(245, 237, 225, 0.94)),
        var(--surface-strong);
    }

    .hero::before {
      content: "";
      position: absolute;
      inset: 0;
      background: none;
      z-index: -1;
      pointer-events: none;
    }

    [data-theme="light"] .hero::before {
      background: none;
    }

    .hero::after {
      content: "";
      position: absolute;
      top: -38%;
      right: -12%;
      width: 360px;
      height: 360px;
      background: none;
      filter: none;
      transform: none;
      pointer-events: none;
      z-index: -1;
    }

    [data-theme="light"] .hero::after {
      background: none;
    }

    .headline {
      display: grid;
      gap: 14px;
      min-width: 0;
      align-content: start;
    }

    .title-row {
      display: flex;
      flex-wrap: wrap;
      gap: 12px;
      align-items: center;
    }

    h1 {
      font-size: clamp(1.35rem, 2.8vw, 2.8rem);
      line-height: 1.18;
      font-weight: 800;
      letter-spacing: -0.01em;
      margin-right: auto;
      display: inline-block;
      padding-bottom: 0.08em;
      text-wrap: pretty;
      max-width: 100%;
      overflow-wrap: anywhere;
      color: transparent;
      background: linear-gradient(180deg, #ffffff 0%, #c5ccd6 100%);
      -webkit-background-clip: text;
      background-clip: text;
    }

    [data-theme="light"] h1 {
      background: linear-gradient(180deg, #2a3648 0%, #4f6b93 100%);
      -webkit-background-clip: text;
      background-clip: text;
    }

    [data-theme="light"] .hero-copy {
      color: #43536a;
    }

    .hero-copy {
      font-size: clamp(0.88rem, 1.1vw, 1rem);
      line-height: 1.65;
      max-width: 66ch;
      color: #b6bcc6;
    }

    .hero-copy strong {
      color: var(--ink-0);
      font-weight: 700;
    }

    .hero-meta-strip {
      display: grid;
      grid-template-columns: repeat(auto-fit, minmax(180px, 1fr));
      gap: 10px;
      margin-top: 2px;
      min-width: 0;
    }

    .hero-signal {
      padding: clamp(12px, 1.3vw, 16px);
      display: grid;
      gap: 10px;
      align-content: start;
      min-width: 0;
      background:
        linear-gradient(140deg, rgba(12, 14, 16, 0.96), rgba(8, 9, 11, 0.98)),
        var(--surface-strong);
    }

    [data-theme="light"] .hero-signal {
      background:
        linear-gradient(140deg, rgba(255, 252, 245, 0.98), rgba(245, 237, 225, 0.95)),
        var(--surface-strong);
    }

    .hero-signal-head {
      display: flex;
      align-items: center;
      justify-content: space-between;
      gap: 10px;
      border-bottom: 1px solid var(--line-soft);
      padding-bottom: 10px;
      min-width: 0;
      flex-wrap: wrap;
    }

    .hero-signal-title {
      font-size: 11px;
      letter-spacing: 0.16em;
      text-transform: uppercase;
      color: var(--ink-1);
      font-weight: 700;
    }

    .hero-signal-meta {
      font-family: var(--mono);
      font-size: 11px;
      color: var(--ink-2);
      border: 1px solid var(--line-soft);
      border-radius: 999px;
      padding: 4px 9px;
      background: rgba(255, 255, 255, 0.03);
      white-space: nowrap;
    }

    [data-theme="light"] .hero-signal-meta {
      background: rgba(255, 255, 255, 0.78);
      border-color: rgba(42, 60, 85, 0.14);
    }

    .hero-signal-grid {
      display: grid;
      gap: 10px;
      min-width: 0;
    }

    .hero-diff-wrap {
      position: relative;
      border: 1px solid var(--line-soft);
      border-radius: 12px;
      padding: 10px;
      min-height: 170px;
      background:
        linear-gradient(rgba(255, 255, 255, 0.04) 1px, transparent 1px) 0 0 / 100% 25%,
        linear-gradient(90deg, rgba(255, 255, 255, 0.03) 1px, transparent 1px) 0 0 / 12.5% 100%,
        rgba(7, 8, 9, 0.86);
      overflow: hidden;
      min-width: 0;
    }

    [data-theme="light"] .hero-diff-wrap {
      background:
        linear-gradient(rgba(65, 88, 122, 0.08) 1px, transparent 1px) 0 0 / 100% 25%,
        linear-gradient(90deg, rgba(65, 88, 122, 0.06) 1px, transparent 1px) 0 0 / 12.5% 100%,
        rgba(252, 248, 241, 0.94);
      border-color: rgba(42, 60, 85, 0.14);
    }

    .hero-diff-legend {
      display: flex;
      flex-wrap: wrap;
      align-items: center;
      gap: 8px;
      color: var(--ink-2);
      font-family: var(--mono);
      font-size: 11px;
    }

    .legend-item {
      display: inline-flex;
      align-items: center;
      gap: 6px;
    }

    .legend-dot {
      width: 8px;
      height: 8px;
      border-radius: 999px;
      display: inline-block;
    }

    .legend-dot.acc {
      background: #6df3a2;
      box-shadow: 0 0 8px rgba(109, 243, 162, 0.55);
    }

    .legend-dot.rej {
      background: #ff7478;
      box-shadow: 0 0 8px rgba(255, 116, 120, 0.52);
    }

    .legend-range {
      margin-left: auto;
      border: 1px solid var(--line-soft);
      border-radius: 999px;
      padding: 4px 8px;
      background: rgba(255, 255, 255, 0.03);
      color: var(--ink-1);
      white-space: nowrap;
    }

    [data-theme="light"] .legend-range {
      border-color: rgba(42, 60, 85, 0.14);
      background: rgba(255, 255, 255, 0.78);
    }

    .meta-pill {
      border-radius: 999px;
      border: 1px solid var(--line-soft);
      background: rgba(255, 255, 255, 0.03);
      padding: 9px 14px;
      font-size: 11px;
      letter-spacing: 0.1em;
      text-transform: uppercase;
      color: var(--ink-3);
      display: inline-flex;
      align-items: center;
      justify-content: center;
      flex-wrap: wrap;
      gap: 8px;
      min-height: 40px;
      text-align: center;
      min-width: 0;
      width: 100%;
    }

    [data-theme="light"] .meta-pill {
      background: rgba(255, 255, 255, 0.78);
      border-color: rgba(42, 60, 85, 0.13);
      color: #70839c;
    }

    .meta-pill span {
      font-family: var(--mono);
      font-size: 10px;
      color: var(--ink-0);
      letter-spacing: 0.03em;
      text-transform: none;
      min-width: 0;
    }

    .status-chip {
      border-radius: 999px;
      border: 1px solid var(--line-soft);
      background: rgba(255, 255, 255, 0.03);
      color: var(--ink-0);
      min-height: 40px;
      padding: 8px 14px;
      display: inline-flex;
      align-items: center;
      gap: 9px;
      font-size: 12px;
      font-weight: 700;
      letter-spacing: 0.08em;
      text-transform: uppercase;
      box-shadow: var(--shadow-xs);
    }

    [data-theme="light"] .status-chip {
      background: rgba(255, 255, 255, 0.86);
      border-color: rgba(42, 60, 85, 0.16);
      color: #2b3a4f;
    }

    .dot {
      width: 10px;
      height: 10px;
      border-radius: 999px;
      display: inline-block;
      background: var(--amber);
      box-shadow: 0 0 0 0 rgba(255, 182, 72, 0.5);
    }

    .dot.ok {
      background: var(--green);
      box-shadow: 0 0 0 0 rgba(103, 243, 147, 0.45);
      animation: ping 1.9s infinite;
    }

    .dot.warn {
      background: var(--amber);
      box-shadow: 0 0 14px rgba(255, 182, 72, 0.5);
    }

    .dot.err {
      background: var(--red);
      box-shadow: 0 0 14px rgba(255, 110, 114, 0.55);
    }

    @keyframes ping {
      0% {
        box-shadow: 0 0 0 0 rgba(103, 243, 147, 0.44);
      }
      70% {
        box-shadow: 0 0 0 10px rgba(103, 243, 147, 0);
      }
      100% {
        box-shadow: 0 0 0 0 rgba(103, 243, 147, 0);
      }
    }

    .controls {
      display: inline-flex;
      align-items: center;
      flex-wrap: wrap;
      gap: 8px;
    }

    .icon-btn {
      appearance: none;
      border: 1px solid var(--line-soft);
      width: 40px;
      height: 40px;
      border-radius: 12px;
      background: rgba(255, 255, 255, 0.02);
      color: var(--ink-1);
      display: inline-flex;
      align-items: center;
      justify-content: center;
      font-size: 17px;
      cursor: pointer;
      transition: transform 0.2s ease, border-color 0.2s ease, box-shadow 0.2s ease, color 0.2s ease, background 0.2s ease;
      box-shadow: var(--shadow-xs);
    }

    [data-theme="light"] .icon-btn {
      background: rgba(255, 255, 255, 0.86);
      border-color: rgba(42, 60, 85, 0.16);
      color: #40516a;
    }

    .icon-btn:hover,
    .icon-btn:focus-visible {
      transform: translateY(-1px);
      border-color: rgba(116, 191, 255, 0.7);
      color: var(--cyan);
      box-shadow: 0 0 0 3px rgba(116, 191, 255, 0.16), var(--shadow-sm);
      outline: none;
    }

    .icon-btn.active {
      color: var(--cyan);
      background: rgba(116, 191, 255, 0.12);
      border-color: rgba(116, 191, 255, 0.55);
      box-shadow: 0 0 0 3px rgba(116, 191, 255, 0.16), var(--shadow-sm);
    }

    .hero-rail {
      display: grid;
      gap: 10px;
      grid-template-columns: repeat(2, minmax(0, 1fr));
      align-content: stretch;
    }

    .card {
      position: relative;
      border: 1px solid var(--line);
      border-radius: var(--radius);
      background: linear-gradient(140deg, rgba(17, 17, 17, 0.88), rgba(10, 10, 10, 0.94));
      backdrop-filter: blur(14px);
      box-shadow: var(--shadow-sm);
      min-width: 0;
      transition: border-color 0.28s ease, box-shadow 0.28s ease, transform 0.28s ease, background 0.28s ease;
    }

    [data-theme="light"] .card {
      background: linear-gradient(140deg, rgba(255, 253, 248, 0.95), rgba(247, 239, 229, 0.92));
      border-color: rgba(42, 60, 85, 0.14);
    }

    .card:hover {
      border-color: rgba(116, 191, 255, 0.46);
      box-shadow: var(--shadow);
      transform: translateY(-1px);
    }

    .card.pulse {
      animation: cardPulse 0.6s ease;
    }

    @keyframes cardPulse {
      0% {
        border-color: var(--line);
      }
      45% {
        border-color: rgba(48, 213, 255, 0.8);
        box-shadow: 0 0 0 3px rgba(48, 213, 255, 0.2), var(--shadow);
      }
      100% {
        border-color: var(--line);
      }
    }

    .stat-card {
      display: grid;
      gap: 8px;
      align-content: start;
      padding: clamp(14px, 1.45vw, 20px);
      min-height: 108px;
      overflow: hidden;
      isolation: isolate;
    }

    .stat-card::before {
      content: "";
      position: absolute;
      inset: auto 10px 0;
      height: 2px;
      background: linear-gradient(90deg, transparent, rgba(48, 213, 255, 0.85), transparent);
      opacity: 0.65;
      transform: translateY(8px);
      transition: transform 0.35s ease;
    }

    .stat-card.updated::before,
    .stat-card:hover::before {
      transform: translateY(0);
    }

    .label {
      font-size: 10px;
      letter-spacing: 0.2em;
      text-transform: uppercase;
      color: var(--ink-2);
      display: inline-flex;
      align-items: center;
      gap: 8px;
      font-weight: 700;
    }

    .label-icon {
      font-size: 15px;
      line-height: 1;
      opacity: 0.9;
    }

    .value {
      font-family: var(--mono);
      font-size: clamp(1.2rem, 1.9vw, 1.95rem);
      letter-spacing: -0.03em;
      color: var(--ink-0);
      font-weight: 600;
      line-height: 1.1;
      overflow: hidden;
      text-overflow: ellipsis;
      white-space: nowrap;
    }

    .value.highlight {
      color: var(--cyan);
      text-shadow: 0 0 18px rgba(48, 213, 255, 0.44);
    }

    .hint {
      font-size: 12px;
      color: var(--ink-2);
      line-height: 1.45;
      min-height: 1.2em;
    }

    .grid {
      display: grid;
      grid-template-columns: repeat(12, minmax(0, 1fr));
      gap: clamp(10px, 1vw, 16px);
      min-width: 0;
    }

    .span-3 { grid-column: span 3; }
    .span-4 { grid-column: span 4; }
    .span-6 { grid-column: span 6; }
    .span-8 { grid-column: span 8; }
    .span-12 { grid-column: span 12; }

    .chart-card {
      display: grid;
      grid-template-rows: auto minmax(0, 1fr);
      gap: 12px;
      padding: clamp(14px, 1.45vw, 22px);
      min-width: 0;
      align-content: start;
    }

    .chart-head {
      display: flex;
      align-items: center;
      justify-content: space-between;
      gap: 8px;
      border-bottom: 1px solid var(--line-soft);
      padding-bottom: 10px;
      min-width: 0;
      flex-wrap: wrap;
    }

    .chart-head .title {
      font-size: clamp(12px, 0.96vw, 15px);
      font-weight: 700;
      color: var(--ink-0);
      letter-spacing: 0.03em;
      text-transform: uppercase;
    }

    .chart-head .meta {
      font-family: var(--mono);
      font-size: 11px;
      color: var(--ink-2);
      border: 1px solid var(--line);
      background: var(--surface-soft);
      border-radius: 999px;
      padding: 5px 10px;
      white-space: nowrap;
      max-width: 100%;
      text-overflow: ellipsis;
      overflow: hidden;
    }

    .chart-wrap {
      position: relative;
      border-radius: 14px;
      border: 1px solid var(--line-soft);
      background:
        linear-gradient(rgba(255, 255, 255, 0.05) 1px, transparent 1px) 0 0 / 100% 25%,
        linear-gradient(90deg, rgba(255, 255, 255, 0.03) 1px, transparent 1px) 0 0 / 12.5% 100%,
        rgba(9, 9, 9, 0.72);
      box-shadow: inset 0 2px 14px rgba(0, 0, 0, 0.33);
      height: clamp(160px, 18vw, 228px);
      overflow: hidden;
    }

    [data-theme="light"] .chart-wrap {
      background:
        linear-gradient(rgba(65, 88, 122, 0.08) 1px, transparent 1px) 0 0 / 100% 25%,
        linear-gradient(90deg, rgba(65, 88, 122, 0.06) 1px, transparent 1px) 0 0 / 12.5% 100%,
        rgba(252, 248, 241, 0.98);
      box-shadow: inset 0 2px 10px rgba(56, 74, 102, 0.08);
    }

    canvas {
      width: 100%;
      height: 100%;
      display: block;
    }

    .table-card {
      display: grid;
      grid-template-rows: auto minmax(0, 1fr);
      gap: 8px;
      padding: clamp(12px, 1.1vw, 16px);
      min-width: 0;
      align-content: start;
    }

    .rows {
      display: grid;
      grid-template-columns: repeat(2, minmax(0, 1fr));
      gap: 8px;
      min-width: 0;
      align-content: start;
    }

    .row {
      display: flex;
      align-items: center;
      justify-content: space-between;
      gap: 10px;
      min-width: 0;
      border-radius: 12px;
      border: 1px solid var(--line-soft);
      background: rgba(255, 255, 255, 0.02);
      padding: 9px 10px;
      transition: border-color 0.2s ease, background 0.2s ease;
    }

    [data-theme="light"] .row {
      background: rgba(255, 255, 255, 0.8);
      border-color: rgba(42, 60, 85, 0.1);
    }

    .row:hover {
      border-color: rgba(116, 191, 255, 0.42);
      background: rgba(116, 191, 255, 0.08);
    }

    [data-theme="light"] .row:hover {
      background: rgba(125, 170, 239, 0.16);
      border-color: rgba(56, 92, 153, 0.28);
    }

    .row .k {
      color: var(--ink-1);
      font-size: 11px;
      letter-spacing: 0.04em;
      text-transform: uppercase;
      white-space: nowrap;
      font-weight: 600;
    }

    .row .v {
      color: var(--ink-0);
      font-family: var(--mono);
      font-size: 12px;
      line-height: 1.4;
      text-align: right;
      overflow: hidden;
      text-overflow: ellipsis;
      white-space: nowrap;
      min-width: 0;
    }

    .copy-btn {
      border: 1px solid var(--line);
      border-radius: 8px;
      padding: 4px 8px;
      font-size: 10px;
      font-family: var(--mono);
      background: rgba(116, 191, 255, 0.12);
      color: var(--cyan);
      cursor: pointer;
      transition: background 0.2s ease, border-color 0.2s ease;
    }

    .copy-btn:hover {
      background: rgba(116, 191, 255, 0.18);
      border-color: rgba(116, 191, 255, 0.5);
    }

    .copy-btn.copied {
      color: var(--lime);
      border-color: rgba(157, 255, 99, 0.55);
      background: rgba(157, 255, 99, 0.18);
    }

    .block-list {
      display: grid;
      gap: 8px;
      max-height: 326px;
      overflow-y: auto;
      padding-right: 4px;
      -webkit-overflow-scrolling: touch;
      overscroll-behavior: contain;
      align-content: start;
      min-height: 0;
    }

    .block-list::-webkit-scrollbar,
    .worker-list::-webkit-scrollbar {
      width: 8px;
    }

    .block-list::-webkit-scrollbar-thumb,
    .worker-list::-webkit-scrollbar-thumb {
      background: rgba(255, 255, 255, 0.22);
      border-radius: 999px;
    }

    [data-theme="light"] .block-list::-webkit-scrollbar-thumb,
    [data-theme="light"] .worker-list::-webkit-scrollbar-thumb {
      background: rgba(79, 98, 126, 0.34);
    }

    .block-list::-webkit-scrollbar-track,
    .worker-list::-webkit-scrollbar-track {
      background: rgba(255, 255, 255, 0.06);
      border-radius: 999px;
    }

    [data-theme="light"] .block-list::-webkit-scrollbar-track,
    [data-theme="light"] .worker-list::-webkit-scrollbar-track {
      background: rgba(79, 98, 126, 0.12);
    }

    .block-item {
      border-radius: 12px;
      border: 1px solid rgba(116, 191, 255, 0.28);
      background: rgba(255, 255, 255, 0.02);
      padding: 10px 12px;
      display: grid;
      gap: 6px;
      min-width: 0;
    }

    [data-theme="light"] .block-item {
      background: rgba(255, 255, 255, 0.86);
      border-color: rgba(58, 111, 201, 0.24);
    }

    .block-header,
    .block-footer {
      display: flex;
      align-items: center;
      justify-content: space-between;
      gap: 10px;
      min-width: 0;
    }

    .block-height {
      font-family: var(--mono);
      font-size: 13px;
      color: var(--teal);
      font-weight: 600;
    }

    .block-age,
    .block-footer {
      font-size: 11px;
      color: var(--ink-1);
    }

    .block-hash {
      font-family: var(--mono);
      color: var(--ink-1);
      font-size: 11px;
      overflow: hidden;
      text-overflow: ellipsis;
      white-space: nowrap;
      cursor: pointer;
      text-decoration: underline transparent;
      transition: text-decoration-color 0.2s ease;
    }

    .block-hash:hover {
      text-decoration-color: rgba(48, 213, 255, 0.65);
    }

    .block-finder {
      font-family: var(--mono);
      color: var(--ink-1);
      overflow: hidden;
      text-overflow: ellipsis;
      white-space: nowrap;
    }

    .luck-stats {
      display: grid;
      gap: 8px;
      align-content: start;
    }

    .luck-item {
      border: 1px solid var(--line-soft);
      border-radius: 12px;
      background:
        linear-gradient(180deg, rgba(255, 255, 255, 0.025), rgba(255, 255, 255, 0.01)),
        rgba(12, 12, 12, 0.72);
      padding: 10px 12px;
      display: grid;
      gap: 4px;
      min-width: 0;
      box-shadow: inset 0 1px 8px rgba(255, 255, 255, 0.02);
    }

    [data-theme="light"] .luck-item {
      background:
        linear-gradient(180deg, rgba(255, 255, 255, 0.88), rgba(252, 245, 234, 0.82)),
        rgba(255, 255, 255, 0.82);
      border-color: rgba(42, 60, 85, 0.13);
      box-shadow: inset 0 1px 8px rgba(255, 255, 255, 0.35), 0 8px 20px rgba(52, 68, 94, 0.08);
    }

    [data-theme="light"] .luck-value {
      color: #2a3d58;
      text-shadow: none;
    }

    .luck-label {
      font-size: 10px;
      letter-spacing: 0.12em;
      text-transform: uppercase;
      color: var(--ink-2);
      font-weight: 700;
    }

    .luck-value {
      font-family: var(--mono);
      color: #d9dee8;
      font-size: clamp(15px, 1.7vw, 20px);
      font-weight: 600;
      line-height: 1.2;
      overflow: hidden;
      text-overflow: ellipsis;
      white-space: nowrap;
      text-shadow: 0 0 10px rgba(149, 172, 255, 0.18);
    }

    .luck-hint {
      font-size: 11px;
      color: var(--ink-2);
      line-height: 1.45;
      overflow: hidden;
      text-overflow: ellipsis;
      white-space: nowrap;
    }

    .worker-list {
      display: grid;
      gap: 10px;
      max-height: 440px;
      overflow-y: auto;
      padding-right: 4px;
      -webkit-overflow-scrolling: touch;
      overscroll-behavior: contain;
      align-content: start;
      min-height: 0;
    }

    .empty-state {
      color: var(--ink-2);
      text-align: center;
      padding: 16px 10px 0;
      align-self: start;
      justify-self: stretch;
      width: 100%;
      font-size: 13px;
      line-height: 1.4;
    }

    .worker-item {
      border-radius: 14px;
      border: 1px solid var(--line-soft);
      background:
        linear-gradient(180deg, rgba(255, 255, 255, 0.025), rgba(255, 255, 255, 0.01)),
        rgba(11, 11, 11, 0.86);
      padding: 12px;
      display: grid;
      gap: 9px;
      min-width: 0;
      box-shadow: inset 0 1px 8px rgba(255, 255, 255, 0.02);
    }

    [data-theme="light"] .worker-item {
      background: linear-gradient(140deg, rgba(255, 255, 255, 0.94), rgba(244, 237, 226, 0.9));
      border-color: rgba(42, 60, 85, 0.12);
    }

    .worker-header {
      display: flex;
      justify-content: space-between;
      align-items: center;
      gap: 10px;
      min-width: 0;
      flex-wrap: wrap;
    }

    .worker-name {
      min-width: 0;
      overflow: hidden;
      text-overflow: ellipsis;
      white-space: nowrap;
      font-family: var(--mono);
      font-weight: 600;
      font-size: 13px;
      color: var(--ink-0);
      max-width: 100%;
    }

    .worker-stats {
      display: grid;
      grid-template-columns: repeat(3, minmax(0, 1fr));
      gap: 8px;
      min-width: 0;
    }

    .worker-stat {
      border-radius: 10px;
      border: 1px solid var(--line-soft);
      background: rgba(255, 255, 255, 0.02);
      padding: 7px;
      display: grid;
      gap: 4px;
      min-width: 0;
    }

    [data-theme="light"] .worker-stat {
      background: rgba(255, 255, 255, 0.82);
      border-color: rgba(42, 60, 85, 0.12);
    }

    .worker-stat .k {
      font-size: 9px;
      text-transform: uppercase;
      letter-spacing: 0.08em;
      color: var(--ink-3);
      white-space: nowrap;
    }

    .worker-stat .v {
      font-family: var(--mono);
      font-size: 12px;
      color: var(--ink-0);
      font-weight: 600;
      overflow: hidden;
      text-overflow: ellipsis;
      white-space: nowrap;
    }

    .hashrate-badge,
    .efficiency-badge,
    .worker-badge {
      display: inline-flex;
      align-items: center;
      border-radius: 999px;
      border: 1px solid;
      padding: 5px 10px;
      font-size: 10px;
      line-height: 1;
      font-family: var(--mono);
      letter-spacing: 0.03em;
      white-space: nowrap;
    }

    .hashrate-badge {
      color: var(--ink-1);
      border-color: var(--line);
      background: rgba(255, 255, 255, 0.05);
    }

    .efficiency-badge {
      color: var(--green);
      border-color: rgba(103, 243, 147, 0.4);
      background: rgba(103, 243, 147, 0.14);
    }

    .worker-badge {
      color: var(--amber);
      border-color: rgba(255, 182, 72, 0.42);
      background: rgba(255, 182, 72, 0.18);
    }

    .timeline {
      display: flex;
      align-items: flex-end;
      gap: 4px;
      min-height: 64px;
      border-radius: 12px;
      border: 1px solid var(--line-soft);
      background:
        linear-gradient(180deg, rgba(255, 255, 255, 0.03), rgba(255, 255, 255, 0.015)),
        rgba(10, 10, 10, 0.72);
      padding: 8px;
      overflow: hidden;
      box-shadow: inset 0 1px 8px rgba(255, 255, 255, 0.03), inset 0 -10px 24px rgba(0, 0, 0, 0.32);
    }

    [data-theme="light"] .timeline {
      background:
        linear-gradient(180deg, rgba(255, 255, 255, 0.82), rgba(245, 236, 223, 0.76)),
        rgba(255, 255, 255, 0.84);
      border-color: rgba(42, 60, 85, 0.12);
      box-shadow: inset 0 1px 8px rgba(255, 255, 255, 0.35), inset 0 -8px 16px rgba(68, 84, 108, 0.08);
    }

    .timeline-bar {
      flex: 1;
      min-width: 2px;
      height: 20%;
      border-radius: 6px 6px 0 0;
      background: linear-gradient(180deg, #8af6da, #56cfb8);
      opacity: 0.78;
      box-shadow: 0 0 8px rgba(86, 207, 184, 0.22);
      transition: height 0.3s ease, opacity 0.3s ease;
      transform-origin: bottom;
    }

    .timeline-bar.rejected {
      background: linear-gradient(180deg, #ff9a86, #ff7478);
      box-shadow: 0 0 8px rgba(255, 116, 120, 0.24);
    }

    .timeline-bar.new {
      animation: barGrow 0.36s cubic-bezier(0.2, 0.8, 0.2, 1.2);
    }

    @keyframes barGrow {
      from {
        transform: scaleY(0);
        opacity: 0;
      }
      to {
        transform: scaleY(1);
        opacity: 0.72;
      }
    }

    .health-grid {
      display: grid;
      grid-template-columns: repeat(3, minmax(0, 1fr));
      gap: 10px;
    }

    .health-item {
      border-radius: 14px;
      border: 1px solid var(--line-soft);
      background: rgba(255, 255, 255, 0.02);
      padding: 14px 12px;
      display: grid;
      gap: 6px;
      text-align: center;
      position: relative;
      overflow: hidden;
    }

    [data-theme="light"] .health-item {
      background: rgba(255, 255, 255, 0.84);
      border-color: rgba(42, 60, 85, 0.11);
    }

    .health-item::before {
      content: "";
      position: absolute;
      left: 0;
      right: 0;
      top: 0;
      height: 3px;
      opacity: 0.8;
      background: var(--ink-3);
    }

    .health-item.good {
      border-color: rgba(103, 243, 147, 0.35);
      background: rgba(103, 243, 147, 0.08);
    }

    [data-theme="light"] .health-item.good {
      background: rgba(197, 239, 219, 0.68);
    }

    .health-item.good::before {
      background: var(--green);
      box-shadow: 0 0 10px rgba(103, 243, 147, 0.5);
    }

    .health-item.warn {
      border-color: rgba(255, 182, 72, 0.35);
      background: rgba(255, 193, 95, 0.08);
    }

    [data-theme="light"] .health-item.warn {
      background: rgba(252, 229, 189, 0.72);
    }

    .health-item.warn::before {
      background: var(--amber);
      box-shadow: 0 0 10px rgba(255, 182, 72, 0.5);
    }

    .health-item.bad {
      border-color: rgba(255, 110, 114, 0.35);
      background: rgba(255, 116, 120, 0.08);
    }

    [data-theme="light"] .health-item.bad {
      background: rgba(249, 207, 214, 0.72);
    }

    .health-item.bad::before {
      background: var(--red);
      box-shadow: 0 0 10px rgba(255, 110, 114, 0.5);
    }

    .health-label {
      color: var(--ink-2);
      text-transform: uppercase;
      letter-spacing: 0.12em;
      font-size: 10px;
      font-weight: 700;
    }

    .health-value {
      font-family: var(--mono);
      font-size: clamp(15px, 1.8vw, 22px);
      font-weight: 600;
      color: var(--ink-0);
      line-height: 1.2;
      overflow: hidden;
      text-overflow: ellipsis;
      white-space: nowrap;
    }

    .health-item.good .health-value { color: var(--green); }
    .health-item.warn .health-value { color: var(--amber); }
    .health-item.bad .health-value { color: var(--red); }

    .confetti-canvas {
      position: fixed;
      inset: 0;
      width: 100%;
      height: 100%;
      pointer-events: none;
      z-index: 40;
    }

    .block-found-banner {
      position: fixed;
      left: 50%;
      top: 50%;
      transform: translate(-50%, -50%) scale(0.82);
      z-index: 45;
      pointer-events: none;
      opacity: 0;
      background: linear-gradient(145deg, rgba(16, 16, 16, 0.96), rgba(8, 8, 8, 0.98));
      border: 1px solid rgba(255, 255, 255, 0.22);
      border-radius: 18px;
      box-shadow: 0 26px 90px rgba(0, 0, 0, 0.7), 0 0 0 1px rgba(116, 191, 255, 0.22) inset;
      padding: clamp(20px, 2.8vw, 44px) clamp(24px, 5vw, 72px);
      text-align: center;
      backdrop-filter: blur(12px);
      width: min(92vw, 760px);
    }

    [data-theme="light"] .block-found-banner {
      background: linear-gradient(145deg, rgba(255, 253, 247, 0.97), rgba(246, 238, 226, 0.95));
      border-color: rgba(49, 72, 106, 0.26);
      box-shadow: 0 26px 90px rgba(63, 80, 107, 0.22), 0 0 0 1px rgba(104, 146, 216, 0.25) inset;
    }

    .block-found-banner.show {
      animation: blockFoundAnimation 4s cubic-bezier(0.22, 0.9, 0.26, 1) forwards;
    }

    @keyframes blockFoundAnimation {
      0% {
        opacity: 0;
        transform: translate(-50%, -50%) scale(0.8);
      }
      14% {
        opacity: 1;
        transform: translate(-50%, -50%) scale(1.03);
      }
      70% {
        opacity: 1;
        transform: translate(-50%, -50%) scale(1);
      }
      100% {
        opacity: 0;
        transform: translate(-50%, -50%) scale(0.92);
      }
    }

    .block-found-banner h2 {
      font-size: clamp(1.25rem, 3.8vw, 3.2rem);
      line-height: 1;
      color: #f4f6fa;
      font-weight: 800;
      letter-spacing: 0.02em;
      margin-bottom: 12px;
      text-wrap: balance;
    }

    [data-theme="light"] .block-found-banner h2 {
      color: #213249;
    }

    .block-found-banner p {
      font-family: var(--mono);
      color: rgba(211, 219, 231, 0.95);
      font-size: clamp(0.8rem, 1.65vw, 1.35rem);
      overflow: hidden;
      text-overflow: ellipsis;
      white-space: nowrap;
    }

    [data-theme="light"] .block-found-banner p {
      color: rgba(55, 75, 106, 0.9);
    }

    @supports not ((backdrop-filter: blur(2px)) or (-webkit-backdrop-filter: blur(2px))) {
      .hero,
      .card,
      .block-found-banner {
        backdrop-filter: none;
        -webkit-backdrop-filter: none;
      }

      .hero {
        background: linear-gradient(140deg, rgba(16, 16, 16, 0.96), rgba(8, 8, 8, 0.99));
      }

      [data-theme="light"] .hero {
        background: linear-gradient(140deg, rgba(255, 253, 248, 0.98), rgba(245, 237, 225, 0.97));
      }
    }

    .footer {
      border-top: 1px solid var(--line-soft);
      padding: 6px 2px 20px;
      color: var(--ink-2);
      font-size: 12px;
      display: flex;
      flex-wrap: wrap;
      gap: 10px;
      align-items: center;
      justify-content: space-between;
    }

    .footer code {
      font-family: var(--mono);
      border: 1px solid var(--line);
      border-radius: 6px;
      padding: 2px 6px;
      color: var(--cyan);
      font-size: 11px;
      background: var(--surface-soft);
    }

    .reveal {
      opacity: 0;
      transform: translateY(22px) scale(0.985);
      animation: rise 0.65s cubic-bezier(0.2, 0.9, 0.2, 1) forwards;
    }

    .reveal:nth-child(1) { animation-delay: 20ms; }
    .reveal:nth-child(2) { animation-delay: 80ms; }
    .reveal:nth-child(3) { animation-delay: 140ms; }
    .reveal:nth-child(4) { animation-delay: 200ms; }
    .reveal:nth-child(5) { animation-delay: 260ms; }
    .reveal:nth-child(6) { animation-delay: 320ms; }
    .reveal:nth-child(7) { animation-delay: 380ms; }
    .reveal:nth-child(8) { animation-delay: 440ms; }

    @keyframes rise {
      from {
        opacity: 0;
        transform: translateY(22px) scale(0.985);
        filter: blur(4px);
      }
      to {
        opacity: 1;
        transform: translateY(0) scale(1);
        filter: blur(0);
      }
    }

    @media (max-width: 1400px) {
      .hero {
        grid-template-columns: 1fr;
      }

      .hero-rail {
        grid-template-columns: repeat(4, minmax(0, 1fr));
      }
    }

    @media (max-width: 1180px) {
      .span-8,
      .span-6 {
        grid-column: span 12;
      }

      .span-4,
      .span-3 {
        grid-column: span 6;
      }

      .hero-meta-strip {
        grid-template-columns: 1fr;
      }

      .hero-signal-grid {
        grid-template-columns: 1fr;
      }

      .rows {
        grid-template-columns: 1fr;
      }
    }

    @media (max-width: 920px) {
      .wrap {
        --page-pad: 12px;
        padding: var(--page-pad);
        padding-top: max(var(--page-pad), env(safe-area-inset-top));
        padding-right: max(var(--page-pad), env(safe-area-inset-right));
        padding-bottom: max(var(--page-pad), env(safe-area-inset-bottom));
        padding-left: max(var(--page-pad), env(safe-area-inset-left));
        gap: 12px;
      }

      .title-row {
        display: grid;
        grid-template-columns: minmax(0, 1fr) auto;
        grid-template-areas:
          "title title"
          "status controls";
        column-gap: 10px;
        row-gap: 10px;
        align-items: center;
      }

      .title-row h1 {
        grid-area: title;
        margin-right: 0;
        width: 100%;
        font-size: clamp(1.4rem, 6.8vw, 2rem);
        line-height: 1.2;
        letter-spacing: 0;
      }

      .status-chip {
        grid-area: status;
        justify-self: start;
      }

      .controls {
        grid-area: controls;
        justify-self: end;
        justify-content: flex-end;
        flex-wrap: nowrap;
      }

      .hero-rail {
        grid-template-columns: repeat(2, minmax(0, 1fr));
      }

      .span-4,
      .span-3 {
        grid-column: span 12;
      }

      .worker-stats {
        grid-template-columns: repeat(2, minmax(0, 1fr));
      }

      .health-grid {
        grid-template-columns: 1fr;
      }

      .block-list,
      .worker-list {
        max-height: 320px;
      }
    }

    @media (max-width: 660px) {
      .hero {
        padding: 14px;
      }

      .title-row {
        column-gap: 8px;
        row-gap: 8px;
      }

      .hero-rail {
        grid-template-columns: 1fr;
      }

      .hero-diff-wrap {
        min-height: 136px;
      }

      .legend-range {
        margin-left: 0;
      }

      .chart-wrap {
        height: 170px;
      }

      .timeline {
        min-height: 58px;
      }

      .worker-stats {
        grid-template-columns: 1fr;
      }

      .worker-header {
        flex-direction: column;
        align-items: flex-start;
      }

      .footer {
        justify-content: flex-start;
      }
    }

    @media (max-width: 440px) {
      .title-row {
        grid-template-columns: minmax(0, 1fr) auto;
        grid-template-areas:
          "title title"
          "status controls";
        column-gap: 6px;
        row-gap: 6px;
      }

      .title-row h1 {
        font-size: clamp(1.25rem, 8.8vw, 1.65rem);
        line-height: 1.22;
        letter-spacing: 0;
      }

      .controls {
        justify-self: end;
      }

      .icon-btn {
        width: 40px;
        height: 40px;
        font-size: 14px;
      }

      .status-chip {
        min-height: 38px;
        padding: 7px 10px;
      }

      .meta-pill {
        min-height: 34px;
        padding: 6px 11px;
      }

      .value {
        font-size: 1.05rem;
      }

      .stat-card,
      .chart-card,
      .table-card {
        padding: 11px;
      }

      .block-found-banner {
        width: calc(100vw - 18px);
      }
    }

    @media (prefers-reduced-motion: reduce) {
      *,
      *::before,
      *::after {
        animation-duration: 0.01ms !important;
        animation-iteration-count: 1 !important;
        transition-duration: 0.01ms !important;
        scroll-behavior: auto !important;
      }

      .reveal {
        opacity: 1;
        transform: none;
      }
    }
  </style>

</head>
<body class="bg-grid" data-theme="dark">
  <canvas class="confetti-canvas" id="confetti"></canvas>
  <div class="block-found-banner" id="block-banner">
    <h2>BLOCK FOUND</h2>
    <p id="block-banner-text">New block confirmed</p>
  </div>

  <main class="wrap">
    <section class="hero reveal">
      <div class="headline">
        <div class="title-row">
          <h1>DigiByte Solo Pool</h1>
          <div class="status-chip"><span id="status-dot" class="dot"></span><span id="status-text">Connecting</span></div>
          <div class="controls">
            <button id="theme-toggle" class="icon-btn" title="Toggle theme" aria-label="Toggle theme">🌙</button>
            <button id="sound-toggle" class="icon-btn" title="Toggle sound notifications" aria-label="Toggle sound">🔔</button>
            <button id="reset-stats" class="icon-btn" title="Reset session stats" aria-label="Reset stats">↻</button>
          </div>
        </div>
        <div class="hero-meta-strip">
          <div class="meta-pill">Realtime <span>SSE stream</span></div>
          <div class="meta-pill">Cadence <span>1s updates</span></div>
          <div class="meta-pill">Mode <span>Solo SHA-256</span></div>
        </div>
        <article class="hero-signal card">
          <div class="hero-signal-head">
            <div class="hero-signal-title">Share Difficulty Map</div>
            <div id="hero-signal-meta" class="hero-signal-meta">warming up</div>
          </div>
          <div class="hero-signal-grid">
            <div class="hero-diff-wrap">
              <canvas id="hero-diff-chart" aria-label="Share difficulty scatter"></canvas>
            </div>
            <div class="hero-diff-legend">
              <span class="legend-item"><span class="legend-dot acc"></span>accepted</span>
              <span class="legend-item"><span class="legend-dot rej"></span>rejected</span>
              <span id="hero-diff-range" class="legend-range">range -</span>
            </div>
          </div>
        </article>
      </div>
      <div class="hero-rail">
        <article class="card stat-card">
          <div class="label"><span class="label-icon">⚡</span>Pool Hashrate</div>
          <div id="pool-hashrate" class="value">-</div>
          <div id="pool-hashrate-hint" class="hint">estimated from live worker deltas</div>
        </article>
        <article class="card stat-card">
          <div class="label"><span class="label-icon">✓</span>Accepted / Min</div>
          <div id="rpm-accepted" class="value">-</div>
          <div id="rpm-accepted-hint" class="hint">live throughput</div>
        </article>
        <article class="card stat-card">
          <div class="label"><span class="label-icon">◎</span>Reject Ratio</div>
          <div id="ratio-reject" class="value">-</div>
          <div id="ratio-reject-hint" class="hint">of total shares</div>
        </article>
        <article class="card stat-card">
          <div class="label"><span class="label-icon">◷</span>Last Share</div>
          <div id="last-share-age" class="value">-</div>
          <div id="last-share-worker" class="hint">worker: -</div>
        </article>
      </div>
    </section>

    <section class="grid reveal">
      <article class="card stat-card span-3">
        <div class="label">Current Height</div>
        <div id="height" class="value">-</div>
        <div id="height-hint" class="hint">network tip</div>
      </article>
      <article class="card stat-card span-3">
        <div class="label">Active Job</div>
        <div id="job-id" class="value">-</div>
        <div id="job-meta" class="hint">-</div>
      </article>
      <article class="card stat-card span-3">
        <div class="label">Connections</div>
        <div id="conn" class="value">-</div>
        <div id="conn-hint" class="hint">connected / auth / sub</div>
      </article>
      <article class="card stat-card span-3">
        <div class="label">Uptime</div>
        <div id="uptime" class="value">-</div>
        <div id="uptime-hint" class="hint">process runtime</div>
      </article>
    </section>

    <section class="grid reveal">
      <article class="card chart-card span-12">
        <div class="chart-head">
          <div class="title">System Health Matrix</div>
          <div class="meta">live watchdog</div>
        </div>
        <div class="health-grid">
          <div class="health-item" id="health-template">
            <div class="health-label">Template Freshness</div>
            <div class="health-value">-</div>
          </div>
          <div class="health-item" id="health-rpc">
            <div class="health-label">RPC Latency</div>
            <div class="health-value">-</div>
          </div>
          <div class="health-item" id="health-workers">
            <div class="health-label">Worker Presence</div>
            <div class="health-value">-</div>
          </div>
        </div>
      </article>
    </section>

    <section class="grid reveal">
      <article class="card chart-card span-6">
        <div class="chart-head">
          <div class="title">Share Luck and Best Share</div>
          <div id="luck-meta" class="meta">progress to block</div>
        </div>
        <div class="luck-stats">
          <div class="luck-item">
            <div class="luck-label">Best Share (Session)</div>
            <div class="luck-value" id="best-share-session">-</div>
            <div class="luck-hint" id="best-share-session-hint">No shares yet</div>
          </div>
          <div class="luck-item">
            <div class="luck-label">Best Share (All Time)</div>
            <div class="luck-value" id="best-share-alltime">-</div>
            <div class="luck-hint" id="best-share-alltime-hint">No shares yet</div>
          </div>
          <div class="luck-item">
            <div class="luck-label">Time to Block (Estimate)</div>
            <div class="luck-value" id="ttb-estimate">-</div>
            <div class="luck-hint" id="ttb-hint">Based on current hashrate</div>
          </div>
        </div>
      </article>

      <article class="card chart-card span-6">
        <div class="chart-head">
          <div class="title">Recent Blocks</div>
          <div id="blocks-meta" class="meta">-</div>
        </div>
        <div class="block-list" id="block-list">
          <div class="empty-state">No blocks found yet</div>
        </div>
      </article>
    </section>

    <section class="grid reveal">
      <article class="card chart-card span-8">
        <div class="chart-head">
          <div class="title">Shares Per Tick</div>
          <div id="shares-chart-meta" class="meta">accepted/rejected deltas</div>
        </div>
        <div class="chart-wrap"><canvas id="shares-chart" aria-label="Shares chart"></canvas></div>
      </article>
      <article class="card table-card span-4">
        <div class="chart-head">
          <div class="title">Share Totals</div>
          <div id="totals-updated" class="meta">-</div>
        </div>
        <div class="rows">
          <div class="row"><div class="k">Accepted</div><div id="shares-accepted" class="v">-</div></div>
          <div class="row"><div class="k">Rejected</div><div id="shares-rejected" class="v">-</div></div>
          <div class="row"><div class="k">Stale</div><div id="shares-stale" class="v">-</div></div>
          <div class="row"><div class="k">Duplicate</div><div id="shares-dup" class="v">-</div></div>
          <div class="row"><div class="k">Lowdiff</div><div id="shares-lowdiff" class="v">-</div></div>
          <div class="row"><div class="k">Blocks Found</div><div id="blocks-found" class="v">-</div></div>
          <div class="row"><div class="k">Blocks Rejected</div><div id="blocks-rej" class="v">-</div></div>
          <div class="row"><div class="k">Job Broadcasts</div><div id="job-bcasts" class="v">-</div></div>
        </div>
      </article>
    </section>

    <section class="grid reveal">
      <article class="card chart-card span-6">
        <div class="chart-head">
          <div class="title">Recent Share Activity</div>
          <div id="timeline-meta" class="meta">last 60 shares</div>
        </div>
        <div class="timeline" id="share-timeline"></div>
      </article>
      <article class="card chart-card span-6">
        <div class="chart-head">
          <div class="title">Height and Job Activity</div>
          <div id="height-chart-meta" class="meta">tip and broadcasts</div>
        </div>
        <div class="chart-wrap"><canvas id="height-chart" aria-label="Height chart"></canvas></div>
      </article>
    </section>

    <section class="grid reveal">
      <article class="card table-card span-6">
        <div class="chart-head">
          <div class="title">Active Workers</div>
          <div id="workers-meta" class="meta">-</div>
        </div>
        <div class="worker-list" id="worker-list">
          <div class="empty-state">No active workers</div>
        </div>
      </article>

      <article class="card table-card span-6">
        <div class="chart-head">
          <div class="title">Runtime Detail</div>
          <div id="runtime-detail-meta" class="meta">/stats snapshot</div>
        </div>
        <div class="rows">
          <div class="row"><div class="k">Template Source</div><div id="tmpl-source" class="v">-</div></div>
          <div class="row"><div class="k">Network Bits</div><div id="tmpl-bits" class="v">-</div></div>
          <div class="row"><div class="k">Templates Fetched</div><div id="tmpl-fetched" class="v">-</div></div>
          <div class="row"><div class="k">Last Template Age</div><div id="tmpl-age" class="v">-</div></div>
          <div class="row"><div class="k">Last Broadcast Age</div><div id="bcast-age" class="v">-</div></div>
          <div class="row"><div class="k">Last Broadcast Clients</div><div id="bcast-clients" class="v">-</div></div>
          <div class="row"><div class="k">Last Found Block</div><div id="last-found-hash" class="v">-</div></div>
          <div class="row"><div class="k">Last Found Age</div><div id="last-found-age" class="v">-</div></div>
        </div>
      </article>
    </section>

    <div class="footer">
      <span>Real-time updates via Server-Sent Events.</span>
      <span id="foot-net">Waiting for data…</span>
    </div>
  </main>


  <script>
  (() => {
    "use strict";

    const MAX_POINTS = 120;
    const MAX_TIMELINE_ITEMS = 60;
    const MAX_BLOCKS_HISTORY = 10;
    const d = document;

    // Load preferences
    const prefs = {
      theme: localStorage.getItem('pool-theme') || 'dark',
      soundEnabled: localStorage.getItem('pool-sound') !== 'false'
    };

    // Apply theme
    d.body.dataset.theme = prefs.theme;
    const themeBtn = d.getElementById('theme-toggle');
    themeBtn.textContent = prefs.theme === 'dark' ? '🌙' : '☀️';
    if (prefs.soundEnabled) {
      d.getElementById('sound-toggle').classList.add('active');
    }

    // Best shares tracking (persisted in memory for session)
    let bestShareSession = {
      difficulty: 0,
      hash: '',
      worker: '',
      timestamp: 0
    };

    // Load all-time best from localStorage
    let bestShareAllTime = JSON.parse(localStorage.getItem('pool-best-share') || 'null') || {
      difficulty: 0,
      hash: '',
      worker: '',
      timestamp: 0
    };

    // Load blocks history from localStorage
    let blocksHistory = JSON.parse(localStorage.getItem('pool-blocks-history') || '[]');

    const refs = {
      statusDot: d.getElementById("status-dot"),
      statusText: d.getElementById("status-text"),
      poolHashrate: d.getElementById("pool-hashrate"),
      poolHashrateHint: d.getElementById("pool-hashrate-hint"),
      rpmAccepted: d.getElementById("rpm-accepted"),
      rpmAcceptedHint: d.getElementById("rpm-accepted-hint"),
      ratioReject: d.getElementById("ratio-reject"),
      ratioRejectHint: d.getElementById("ratio-reject-hint"),
      lastShareAge: d.getElementById("last-share-age"),
      lastShareWorker: d.getElementById("last-share-worker"),
      height: d.getElementById("height"),
      heightHint: d.getElementById("height-hint"),
      jobId: d.getElementById("job-id"),
      jobMeta: d.getElementById("job-meta"),
      conn: d.getElementById("conn"),
      connHint: d.getElementById("conn-hint"),
      uptime: d.getElementById("uptime"),
      uptimeHint: d.getElementById("uptime-hint"),
      sharesChartMeta: d.getElementById("shares-chart-meta"),
      totalsUpdated: d.getElementById("totals-updated"),
      sharesAccepted: d.getElementById("shares-accepted"),
      sharesRejected: d.getElementById("shares-rejected"),
      sharesStale: d.getElementById("shares-stale"),
      sharesDup: d.getElementById("shares-dup"),
      sharesLowdiff: d.getElementById("shares-lowdiff"),
      blocksFound: d.getElementById("blocks-found"),
      blocksRej: d.getElementById("blocks-rej"),
      jobBcasts: d.getElementById("job-bcasts"),
      heightChartMeta: d.getElementById("height-chart-meta"),
      tmplSource: d.getElementById("tmpl-source"),
      tmplBits: d.getElementById("tmpl-bits"),
      tmplFetched: d.getElementById("tmpl-fetched"),
      tmplAge: d.getElementById("tmpl-age"),
      bcastAge: d.getElementById("bcast-age"),
      bcastClients: d.getElementById("bcast-clients"),
      lastFoundHash: d.getElementById("last-found-hash"),
      lastFoundAge: d.getElementById("last-found-age"),
      runtimeDetailMeta: d.getElementById("runtime-detail-meta"),
      footNet: d.getElementById("foot-net"),
      workerList: d.getElementById("worker-list"),
      workersMeta: d.getElementById("workers-meta"),
      shareTimeline: d.getElementById("share-timeline"),
      timelineMeta: d.getElementById("timeline-meta"),
      blockBanner: d.getElementById("block-banner"),
      blockBannerText: d.getElementById("block-banner-text"),
      confettiCanvas: d.getElementById("confetti"),
      bestShareSession: d.getElementById("best-share-session"),
      bestShareSessionHint: d.getElementById("best-share-session-hint"),
      bestShareAlltime: d.getElementById("best-share-alltime"),
      bestShareAlltimeHint: d.getElementById("best-share-alltime-hint"),
      ttbEstimate: d.getElementById("ttb-estimate"),
      ttbHint: d.getElementById("ttb-hint"),
      blockList: d.getElementById("block-list"),
      blocksMeta: d.getElementById("blocks-meta"),
      luckMeta: d.getElementById("luck-meta"),
      healthTemplate: d.getElementById("health-template"),
      healthRpc: d.getElementById("health-rpc"),
      healthWorkers: d.getElementById("health-workers"),
      heroSignalMeta: d.getElementById("hero-signal-meta"),
      heroDiffRange: d.getElementById("hero-diff-range")
    };

    const charts = {
      heroDiff: createChart(d.getElementById("hero-diff-chart"), {
        a: "#6df3a2",
        b: "#ff7478",
        fillA: "rgba(109,243,162,.16)",
        fillB: "rgba(255,116,120,.14)"
      }),
      shares: createChart(d.getElementById("shares-chart"), {
        a: "#43ffd1",
        b: "#ff7171",
        fillA: "rgba(67,255,209,.10)",
        fillB: "rgba(255,113,113,.08)"
      }),
      height: createChart(d.getElementById("height-chart"), {
        a: "#59b3ff",
        b: "#b3ff4a",
        fillA: "rgba(89,179,255,.10)",
        fillB: "rgba(179,255,74,.08)"
      })
    };

    let renderQueued = false;
    let latestModel = null;
    let lastFetchDoneAt = 0;
    let sampleSeq = 0;
    let prevStats = null;
    let prevSampleTime = 0;
    let lastError = "";
    let lastBlockCount = 0;
    let shareTimeline = [];
    let timelineDirty = true;
    let timelineNewSinceRender = 0;
    let animatedValues = new Map();

    // Worker hashrate tracking
    const workerHashrateTracker = new Map();

    const history = {
      sharesAcceptedDelta: ring(MAX_POINTS),
      sharesRejectedDelta: ring(MAX_POINTS),
      height: ring(MAX_POINTS),
      broadcastsDelta: ring(MAX_POINTS)
    };

    // Theme toggle
    themeBtn.addEventListener('click', () => {
      const newTheme = d.body.dataset.theme === 'dark' ? 'light' : 'dark';
      d.body.dataset.theme = newTheme;
      localStorage.setItem('pool-theme', newTheme);
      themeBtn.textContent = newTheme === 'dark' ? '🌙' : '☀️';
    });

    // Sound toggle
    d.getElementById('sound-toggle').addEventListener('click', (e) => {
      prefs.soundEnabled = !prefs.soundEnabled;
      localStorage.setItem('pool-sound', prefs.soundEnabled);
      e.target.classList.toggle('active', prefs.soundEnabled);
    });

    // Reset stats button
    d.getElementById('reset-stats').addEventListener('click', async (e) => {
      if (!confirm('Reset session stats? This will clear accepted/rejected shares and uptime, but keep your all-time best share and blocks found.')) {
        return;
      }

      e.target.disabled = true;
      e.target.style.opacity = '0.5';

      try {
        const res = await fetch('/reset', { method: 'POST' });
        const data = await res.json();

        if (data.success) {
          e.target.textContent = '✓';
          setTimeout(() => {
            e.target.textContent = '🔄';
            e.target.disabled = false;
            e.target.style.opacity = '1';
          }, 2000);
        } else {
          throw new Error('Reset failed');
        }
      } catch (err) {
        console.error('Reset failed:', err);
        e.target.textContent = '✗';
        setTimeout(() => {
          e.target.textContent = '🔄';
          e.target.disabled = false;
          e.target.style.opacity = '1';
        }, 2000);
      }
    });

    // Copy button handlers
    d.querySelectorAll('.copy-btn').forEach(btn => {
      btn.addEventListener('click', (e) => {
        const target = e.target.dataset.copy;
        const el = d.getElementById(target);
        if (!el) return;

        const text = el.textContent;
        navigator.clipboard.writeText(text).then(() => {
          const originalText = e.target.textContent;
          e.target.textContent = '✓ Copied';
          e.target.classList.add('copied');
          setTimeout(() => {
            e.target.textContent = originalText;
            e.target.classList.remove('copied');
          }, 2000);
        }).catch(err => {
          console.error('Copy failed:', err);
        });
      });
    });

    function ring(size) {
      return { size, values: new Float64Array(size), count: 0, idx: 0 };
    }

    function ringPush(r, value) {
      r.values[r.idx] = Number.isFinite(value) ? value : 0;
      r.idx = (r.idx + 1) % r.size;
      if (r.count < r.size) r.count += 1;
    }

    function ringToArray(r) {
      const out = new Array(r.count);
      const start = (r.idx - r.count + r.size) % r.size;
      for (let i = 0; i < r.count; i += 1) {
        out[i] = r.values[(start + i) % r.size];
      }
      return out;
    }

    function createChart(canvas, palette) {
      const ctx = canvas.getContext("2d", { alpha: true, desynchronized: true });
      const state = { canvas, ctx, palette, dpr: 1, w: 0, h: 0 };
      const resize = () => {
        const rect = canvas.getBoundingClientRect();
        const dpr = Math.min(2, window.devicePixelRatio || 1);
        const w = Math.max(1, Math.floor(rect.width));
        const h = Math.max(1, Math.floor(rect.height));
        if (w === state.w && h === state.h && dpr === state.dpr) return;
        state.w = w; state.h = h; state.dpr = dpr;
        canvas.width = Math.floor(w * dpr);
        canvas.height = Math.floor(h * dpr);
      };
      resize();
      let ro = null;
      if (window.ResizeObserver) {
        ro = new ResizeObserver(resize);
        ro.observe(canvas);
      } else {
        window.addEventListener("resize", resize, { passive: true });
      }
      state.resize = resize;
      state.ro = ro;
      return state;
    }

    function drawDualChart(chart, seriesA, seriesB) {
      const { ctx, canvas, palette } = chart;
      chart.resize();
      const dpr = chart.dpr;
      const w = canvas.width;
      const h = canvas.height;
      ctx.clearRect(0, 0, w, h);
      ctx.save();
      ctx.scale(dpr, dpr);
      const vw = chart.w;
      const vh = chart.h;
      if (!seriesA.length && !seriesB.length) {
        ctx.restore();
        return;
      }
      const count = Math.max(seriesA.length, seriesB.length);
      const max = Math.max(1, ...seriesA, ...seriesB);
      const min = 0;
      const padX = 6;
      const padY = 8;
      const gw = Math.max(1, vw - padX * 2);
      const gh = Math.max(1, vh - padY * 2);

      drawSeriesFill(seriesA, palette.fillA);
      drawSeriesFill(seriesB, palette.fillB);
      drawSeriesLine(seriesA, palette.a, 2);
      drawSeriesLine(seriesB, palette.b, 1.5);

      function xAt(i, n) {
        if (n <= 1) return padX + gw;
        return padX + (i * gw) / (n - 1);
      }
      function yAt(v) {
        const t = (v - min) / (max - min || 1);
        return padY + gh - (t * gh);
      }
      function drawSeriesLine(series, stroke, lineWidth) {
        if (!series.length) return;
        ctx.beginPath();
        for (let i = 0; i < series.length; i += 1) {
          const x = xAt(i, series.length);
          const y = yAt(series[i]);
          if (i === 0) ctx.moveTo(x, y);
          else ctx.lineTo(x, y);
        }
        ctx.strokeStyle = stroke;
        ctx.lineWidth = lineWidth;
        ctx.lineJoin = "round";
        ctx.lineCap = "round";
        ctx.shadowColor = stroke;
        ctx.shadowBlur = 8;
        ctx.stroke();
        ctx.shadowBlur = 0;
      }
      function drawSeriesFill(series, fill) {
        if (!series.length) return;
        ctx.beginPath();
        for (let i = 0; i < series.length; i += 1) {
          const x = xAt(i, series.length);
          const y = yAt(series[i]);
          if (i === 0) ctx.moveTo(x, y);
          else ctx.lineTo(x, y);
        }
        ctx.lineTo(xAt(series.length - 1, series.length), padY + gh);
        ctx.lineTo(xAt(0, series.length), padY + gh);
        ctx.closePath();
        ctx.fillStyle = fill;
        ctx.fill();
      }
      ctx.restore();
    }

    function drawDifficultyScatter(chart, samples) {
      const { ctx, canvas, palette } = chart;
      chart.resize();
      const dpr = chart.dpr;
      const w = canvas.width;
      const h = canvas.height;
      ctx.clearRect(0, 0, w, h);
      ctx.save();
      ctx.scale(dpr, dpr);

      const vw = chart.w;
      const vh = chart.h;
      const points = [];
      for (let i = 0; i < samples.length; i += 1) {
        const s = samples[i];
        const difficulty = safeNum(s && s.difficulty, 0);
        if (difficulty <= 0) continue;
        points.push({
          difficulty,
          type: s && s.type === "rejected" ? "rejected" : "accepted"
        });
      }

      if (!points.length) {
        ctx.fillStyle = "rgba(154,157,166,0.75)";
        ctx.font = "12px JetBrains Mono, monospace";
        ctx.textAlign = "center";
        ctx.fillText("Waiting for share samples", vw / 2, vh / 2);
        ctx.restore();
        return;
      }

      const padX = 12;
      const padY = 12;
      const gw = Math.max(1, vw - (padX * 2));
      const gh = Math.max(1, vh - (padY * 2));

      let minLog = Math.log10(points[0].difficulty);
      let maxLog = minLog;
      for (let i = 1; i < points.length; i += 1) {
        const logv = Math.log10(points[i].difficulty);
        if (logv < minLog) minLog = logv;
        if (logv > maxLog) maxLog = logv;
      }
      if (maxLog - minLog < 0.2) {
        minLog -= 0.1;
        maxLog += 0.1;
      }

      ctx.strokeStyle = "rgba(255,255,255,0.08)";
      ctx.lineWidth = 1;
      for (let i = 0; i <= 4; i += 1) {
        const y = padY + (gh * i / 4);
        ctx.beginPath();
        ctx.moveTo(padX, y);
        ctx.lineTo(padX + gw, y);
        ctx.stroke();
      }

      const lastIndex = Math.max(1, points.length - 1);
      for (let i = 0; i < points.length; i += 1) {
        const point = points[i];
        const x = padX + (gw * i / lastIndex);
        const logv = Math.log10(point.difficulty);
        const t = (logv - minLog) / (maxLog - minLog || 1);
        const y = padY + gh - (t * gh);
        const radius = point.type === "rejected" ? 3.1 : 2.8;
        const fill = point.type === "rejected" ? palette.b : palette.a;
        const glow = point.type === "rejected" ? "rgba(255,116,120,0.5)" : "rgba(109,243,162,0.45)";

        ctx.beginPath();
        ctx.arc(x, y, radius, 0, Math.PI * 2);
        ctx.fillStyle = fill;
        ctx.shadowColor = glow;
        ctx.shadowBlur = 6;
        ctx.fill();
        ctx.shadowBlur = 0;
      }

      ctx.restore();
    }

    function text(el, value) {
      const v = String(value);
      if (el.textContent !== v) el.textContent = v;
    }

    function animateNumber(el, targetValue, duration = 500) {
      const key = el.id || el;
      const current = animatedValues.get(key) || 0;
      const target = Number(targetValue) || 0;

      if (current === target) return;

      const startTime = performance.now();
      const startValue = current;
      const delta = target - startValue;

      const animate = (currentTime) => {
        const elapsed = currentTime - startTime;
        const progress = Math.min(elapsed / duration, 1);
        const eased = easeOutCubic(progress);
        const value = startValue + (delta * eased);

        animatedValues.set(key, value);
        el.textContent = fmtInt(Math.round(value));

        if (progress < 1) {
          requestAnimationFrame(animate);
        } else {
          animatedValues.set(key, target);
        }
      };

      requestAnimationFrame(animate);
    }

    function easeOutCubic(t) {
      return 1 - Math.pow(1 - t, 3);
    }

    function safeNum(n, fallback = 0) {
      const x = Number(n);
      return Number.isFinite(x) ? x : fallback;
    }

    function fmtInt(n) { return new Intl.NumberFormat().format(Math.round(safeNum(n, 0))); }
    function fmtPct(n) { return Number.isFinite(n) ? (n * 100).toFixed(n < 0.1 ? 2 : 1) + "%" : "-"; }
    function fmtAgeMs(ms) {
      if (!Number.isFinite(ms) || ms < 0) return "-";
      if (ms < 1000) return Math.round(ms) + "ms";
      const s = Math.floor(ms / 1000);
      if (s < 60) return s + "s";
      const m = Math.floor(s / 60);
      const r = s % 60;
      if (m < 60) return m + "m " + r + "s";
      const h = Math.floor(m / 60);
      if (h < 24) return h + "h " + (m % 60) + "m";
      const d = Math.floor(h / 24);
      return d + "d " + (h % 24) + "h";
    }
    function fmtTsAge(ts) {
      const n = safeNum(ts, 0);
      return n > 0 ? fmtAgeMs(Date.now() - n) : "-";
    }
    function fmtUptime(sec) {
      const s = Math.max(0, safeNum(sec, 0) | 0);
      const d = Math.floor(s / 86400);
      const h = Math.floor((s % 86400) / 3600);
      const m = Math.floor((s % 3600) / 60);
      const ss = s % 60;
      if (d > 0) return d + "d " + h + "h";
      if (h > 0) return h + "h " + m + "m";
      if (m > 0) return m + "m " + ss + "s";
      return ss + "s";
    }

    function fmtHashrate(hashPerSec) {
      if (!Number.isFinite(hashPerSec) || hashPerSec <= 0) return "-";
      const units = ['H/s', 'KH/s', 'MH/s', 'GH/s', 'TH/s', 'PH/s', 'EH/s'];
      let value = hashPerSec;
      let unitIndex = 0;
      while (value >= 1000 && unitIndex < units.length - 1) {
        value /= 1000;
        unitIndex++;
      }
      return value.toFixed(2) + ' ' + units[unitIndex];
    }

    function fmtDifficulty(diff) {
      if (!Number.isFinite(diff) || diff <= 0) return "-";
      if (diff < 1000) return diff.toFixed(0);
      if (diff < 1000000) return (diff / 1000).toFixed(2) + 'K';
      if (diff < 1000000000) return (diff / 1000000).toFixed(2) + 'M';
      if (diff < 1000000000000) return (diff / 1000000000).toFixed(2) + 'B';
      return (diff / 1000000000000).toFixed(2) + 'T';
    }

    /**
     * Updates worker hashrate tracking based on share deltas between polls.
     * Maintains a rolling window of samples to calculate average hashrate.
     *
     * @param {string} workerName - Worker identifier
     * @param {number} acceptedShares - Total accepted shares for this worker
     * @param {number} difficulty - Current share difficulty
     * @param {number} timestamp - Current timestamp in ms
     * @returns {number} Estimated hashrate in H/s
     */
    function updateAndCalculateWorkerHashrate(workerName, acceptedShares, difficulty, timestamp) {
      if (!workerName || difficulty <= 0) return 0;

      // Initialize tracker for new workers
      if (!workerHashrateTracker.has(workerName)) {
        workerHashrateTracker.set(workerName, {
          lastShares: acceptedShares,
          lastShareTimestamp: timestamp, // Time when shares last changed
          samples: [] // Array of {shares, difficulty, timeMs}
        });
        return 0; // Not enough data yet
      }

      const tracker = workerHashrateTracker.get(workerName);
      const sharesDelta = acceptedShares - tracker.lastShares;

      // Only record a sample when shares actually increase
      if (sharesDelta > 0) {
        const timeDeltaMs = timestamp - tracker.lastShareTimestamp;

        if (timeDeltaMs > 0) {
          tracker.samples.push({
            shares: sharesDelta,
            difficulty: difficulty,
            timeMs: timeDeltaMs
          });

          // Keep only last 30 samples for better smoothing
          const MAX_SAMPLES = 30;
          if (tracker.samples.length > MAX_SAMPLES) {
            tracker.samples.shift();
          }
        }

        // Update tracking state only when shares change
        tracker.lastShares = acceptedShares;
        tracker.lastShareTimestamp = timestamp;
      }

      // Calculate hashrate from samples
      if (tracker.samples.length === 0) return 0;

      // Sum up total shares and total time across all samples
      let totalShares = 0;
      let totalTimeMs = 0;

      for (const sample of tracker.samples) {
        totalShares += sample.shares;
        totalTimeMs += sample.timeMs;
      }

      if (totalTimeMs === 0 || totalShares === 0) return 0;

      // Average time per share in seconds
      const avgTimePerShare = (totalTimeMs / totalShares) / 1000;

      // Standard SHA-256 hashrate formula:
      // hashrate = (difficulty * 2^32) / avg_time_per_share_in_seconds
      //
      // For DigiByte (SHA-256d), this should give correct results where:
      // - difficulty is the share difficulty (e.g., 512, 1024, 2048)
      // - avgTimePerShare is in seconds
      // - result is in hashes per second
      const hashrate = (difficulty * 4294967296) / avgTimePerShare;

      return hashrate;
    }

    /**
     * Gets the current hashrate estimate for a worker.
     * Returns 0 if not enough data.
     */
    function getWorkerHashrate(workerName) {
      const tracker = workerHashrateTracker.get(workerName);

      // Require at least 3 samples for a reasonable estimate
      if (!tracker || tracker.samples.length < 3) return 0;

      let totalShares = 0;
      let totalTimeMs = 0;

      for (const sample of tracker.samples) {
        totalShares += sample.shares;
        totalTimeMs += sample.timeMs;
      }

      if (totalTimeMs === 0 || totalShares === 0) return 0;

      // Calculate average time per share
      const avgTimePerShare = (totalTimeMs / totalShares) / 1000;

      // Get the most recent difficulty (should be consistent across samples)
      const recentDifficulty = tracker.samples[tracker.samples.length - 1].difficulty;

      // Hashrate = (difficulty * 2^32) / time_per_share_in_seconds
      const hashrate = (recentDifficulty * 4294967296) / avgTimePerShare;

      return hashrate;
    }

    function setupSSE() {
      const eventSource = new EventSource("/events");

      eventSource.onopen = () => {
        lastFetchDoneAt = Date.now();
        lastError = "";
        console.log("SSE connected");
      };

      eventSource.onmessage = (event) => {
        try {
          const json = JSON.parse(event.data);
          lastFetchDoneAt = Date.now();
          lastError = "";
          updateModel(json, 0);
        } catch (err) {
          console.warn("SSE parse error:", err);
          lastError = (err && err.message) ? err.message : String(err);
          queueRender();
        }
      };

      eventSource.onerror = (err) => {
        console.warn("SSE error:", err);
        lastError = "Connection error";
        queueRender();
        // EventSource automatically reconnects
      };

      return eventSource;
    }

    function updateModel(payload, fetchMs) {
      const stats = payload && payload.stats ? payload.stats : {};
      const job = payload && payload.job ? payload.job : null;
      const con = payload && payload.connections ? payload.connections : {};
      const workers = (con && Array.isArray(con.workers)) ? con.workers : [];
      const now = Date.now();

      const accepted = safeNum(stats.sharesAccepted, 0);
      const rejected = safeNum(stats.sharesRejected, 0);
      const stale = safeNum(stats.sharesStale, 0);
      const duplicate = safeNum(stats.sharesDuplicate, 0);
      const lowdiff = safeNum(stats.sharesLowDiff, 0);
      const blocksFound = safeNum(stats.blocksFound, 0);
      const blocksRejected = safeNum(stats.blocksRejected, 0);
      const templatesFetched = safeNum(stats.templatesFetched, 0);
      const jobBroadcasts = safeNum(stats.jobBroadcasts, 0);
      const height = job ? safeNum(job.height, safeNum(stats.currentHeight, 0)) : safeNum(stats.currentHeight, 0);

      // Detect block found
      if (blocksFound > lastBlockCount && lastBlockCount > 0) {
        const blockHash = stats.lastFoundBlockHash || "";
        const blockHeight = height;
        const blockWorker = stats.lastShareWorker || "unknown";
        celebrateBlockFound(blockHash);
        addBlockToHistory({
          hash: blockHash,
          height: blockHeight,
          worker: blockWorker,
          timestamp: now
        });
      }
      lastBlockCount = blocksFound;

      let acceptedDelta = 0;
      let rejectedDelta = 0;
      let bcastDelta = 0;
      let dtMs = 0;
      if (prevStats) {
        acceptedDelta = Math.max(0, accepted - prevStats.accepted);
        rejectedDelta = Math.max(0, rejected - prevStats.rejected);
        bcastDelta = Math.max(0, jobBroadcasts - prevStats.jobBroadcasts);
        dtMs = Math.max(1, now - prevSampleTime);

        // Update timeline
        if (acceptedDelta > 0) {
          for (let i = 0; i < acceptedDelta; i++) {
            addToTimeline('accepted');
          }
        }
        if (rejectedDelta > 0) {
          for (let i = 0; i < rejectedDelta; i++) {
            addToTimeline('rejected');
          }
        }
      }
      prevStats = { accepted, rejected, jobBroadcasts };
      prevSampleTime = now;

      ringPush(history.sharesAcceptedDelta, acceptedDelta);
      ringPush(history.sharesRejectedDelta, rejectedDelta);
      ringPush(history.height, height);
      ringPush(history.broadcastsDelta, bcastDelta);

      const totalShares = accepted + rejected;
      const rejectRatio = totalShares > 0 ? (rejected / totalShares) : 0;

      const acceptedPerMin = computeRatePerMinute(history.sharesAcceptedDelta);
      const rejectPerMin = computeRatePerMinute(history.sharesRejectedDelta);
      const recentBcastsPerMin = computeRatePerMinute(history.broadcastsDelta);

      // Update worker hashrate tracking and calculate total pool hashrate
      const poolHashrate = updatePoolHashrate(workers, now);
      const avgDifficulty = calculateAverageDifficulty(workers);

      sampleSeq += 1;
      latestModel = {
        now,
        fetchMs,
        payload,
        job,
        con,
        stats,
        workers,
        derived: {
          accepted,
          rejected,
          stale,
          duplicate,
          lowdiff,
          blocksFound,
          blocksRejected,
          templatesFetched,
          jobBroadcasts,
          height,
          totalShares,
          rejectRatio,
          acceptedPerMin,
          rejectPerMin,
          recentBcastsPerMin,
          acceptedDelta,
          rejectedDelta,
          bcastDelta,
          dtMs,
          poolHashrate,
          avgDifficulty,
          bestShareDifficulty: safeNum(stats.bestShareDifficulty, 0),
          bestShareWorker: stats.bestShareWorker || null,
          bestShareAt: safeNum(stats.bestShareAt, 0)
        }
      };
      queueRender();
    }

    /**
     * Updates hashrate tracking for all workers and calculates total pool hashrate.
     * Must be called during each stats update with current timestamp.
     *
     * @param {Array} workers - Array of worker objects from stats
     * @param {number} timestamp - Current timestamp in ms
     * @returns {number} Total pool hashrate in H/s
     */
    function updatePoolHashrate(workers, timestamp) {
      if (!workers || workers.length === 0) return 0;

      let totalHashrate = 0;

      for (const worker of workers) {
        const hashrate = updateAndCalculateWorkerHashrate(
          worker.name,
          worker.acceptedShares || 0,
          worker.difficulty || 0,
          timestamp
        );
        totalHashrate += hashrate;
      }

      // Clean up trackers for workers that are no longer active
      const activeWorkerNames = new Set(workers.map(w => w.name));
      for (const [name] of workerHashrateTracker) {
        if (!activeWorkerNames.has(name)) {
          workerHashrateTracker.delete(name);
        }
      }

      return totalHashrate;
    }

    function calculateAverageDifficulty(workers) {
      if (!workers || workers.length === 0) return 1;
      let totalDiff = 0;
      let count = 0;
      for (const w of workers) {
        if (w.difficulty > 0) {
          totalDiff += w.difficulty;
          count++;
        }
      }
      return count > 0 ? totalDiff / count : 1;
    }

    function addToTimeline(type) {
      shareTimeline.push({ type, time: Date.now() });
      if (shareTimeline.length > MAX_TIMELINE_ITEMS) {
        shareTimeline.shift();
      }
      timelineDirty = true;
      timelineNewSinceRender = Math.min(MAX_TIMELINE_ITEMS, timelineNewSinceRender + 1);
    }

    function addBlockToHistory(block) {
      blocksHistory.unshift(block);
      if (blocksHistory.length > MAX_BLOCKS_HISTORY) {
        blocksHistory.pop();
      }
      localStorage.setItem('pool-blocks-history', JSON.stringify(blocksHistory));
    }

    function computeRatePerMinute(r) {
      if (r.count <= 0) return 0;
      let sum = 0;
      for (let i = 0; i < r.count; i += 1) sum += r.values[i];
      // SSE sends updates every second, so each sample represents 1 second
      const windowSec = Math.max(1, r.count);
      return (sum / windowSec) * 60;
    }

    function queueRender() {
      if (renderQueued) return;
      renderQueued = true;
      requestAnimationFrame(() => {
        renderQueued = false;
        render();
      });
    }

    function render() {
      const m = latestModel;
      const now = Date.now();
      if (!m) {
        refs.statusDot.className = "dot warn";
        text(refs.statusText, lastError ? "Reconnecting" : "Connecting");
        if (lastError) text(refs.footNet, "Connection error: " + lastError);
        return;
      }

      const p = m.payload;
      const s = p.stats || {};
      const j = p.job;
      const c = p.connections || {};
      const d0 = m.derived;
      const workers = m.workers || [];

      const recentFetchAge = lastFetchDoneAt ? (now - lastFetchDoneAt) : Infinity;
      const state = lastError ? "err" : (recentFetchAge <= (d.hidden ? 12000 : 4000) ? "ok" : "warn");
      refs.statusDot.className = "dot " + state;
      text(refs.statusText, state === "ok" ? "Live" : state === "warn" ? "Lagging" : "Error");

      const hashrateText = d0.poolHashrate > 0 ? '~' + fmtHashrate(d0.poolHashrate) : 'warming up';
      text(refs.poolHashrate, hashrateText);
      text(refs.poolHashrateHint, workers.length + " workers, avg diff " + d0.avgDifficulty.toFixed(0));
      animateNumber(refs.rpmAccepted, d0.acceptedPerMin);
      text(refs.rpmAcceptedHint, fmtInt(d0.rejectPerMin) + "/min rejected");
      text(refs.ratioReject, fmtPct(d0.rejectRatio));
      text(refs.ratioRejectHint, "stale " + fmtPct(d0.totalShares ? (d0.stale / d0.totalShares) : 0));
      text(refs.lastShareAge, fmtTsAge(s.lastShareAt));
      text(refs.lastShareWorker, "worker: " + (s.lastShareWorker || "-"));

      text(refs.height, d0.height ? fmtInt(d0.height) : "-");
      text(refs.heightHint, j ? (j.cleanJobs ? "clean job" : "incremental job") : "no active job");
      text(refs.jobId, j ? String(j.id) : "-");
      text(refs.jobMeta, j ? ("tx " + fmtInt(j.txCount) + " | " + (j.segwit ? "segwit" : "legacy")) : "-");
      text(refs.conn, [safeNum(c.connected,0), safeNum(c.authorized,0), safeNum(c.subscribed,0)].map(fmtInt).join(" / "));
      text(refs.connHint, "connected / authorized / subscribed");
      text(refs.uptime, fmtUptime(p.uptimeSec));
      text(refs.uptimeHint, "pool process");

      animateNumber(refs.sharesAccepted, d0.accepted);
      animateNumber(refs.sharesRejected, d0.rejected);
      animateNumber(refs.sharesStale, d0.stale);
      animateNumber(refs.sharesDup, d0.duplicate);
      animateNumber(refs.sharesLowdiff, d0.lowdiff);
      animateNumber(refs.blocksFound, d0.blocksFound);
      animateNumber(refs.blocksRej, d0.blocksRejected);
      animateNumber(refs.jobBcasts, d0.jobBroadcasts);
      text(refs.totalsUpdated, "live");

      text(refs.tmplSource, s.lastTemplateSource || "-");
      text(refs.tmplBits, s.currentNetworkBits || (j ? j.bits : "-") || "-");
      animateNumber(refs.tmplFetched, d0.templatesFetched);
      text(refs.tmplAge, fmtTsAge(s.lastTemplateAt));
      text(refs.bcastAge, fmtTsAge(s.lastBroadcastAt));
      text(refs.bcastClients, fmtInt(safeNum(s.lastBroadcastClients, 0)));
      text(refs.lastFoundHash, s.lastFoundBlockHash || "-");
      text(refs.lastFoundAge, fmtTsAge(s.lastFoundBlockAt));
      text(refs.runtimeDetailMeta, "seq " + sampleSeq);
      text(refs.footNet, lastError ? ("Connection error: " + lastError) : "Connected");

      const shareA = ringToArray(history.sharesAcceptedDelta);
      const shareB = ringToArray(history.sharesRejectedDelta);
      const heightsRaw = ringToArray(history.height);
      const bcasts = ringToArray(history.broadcastsDelta);
      renderHeroDifficulty(Array.isArray(s.recentShares) ? s.recentShares : []);
      drawDualChart(charts.shares, shareA, shareB);
      text(refs.sharesChartMeta, "acc " + fmtInt(d0.acceptedDelta) + " / rej " + fmtInt(d0.rejectedDelta) + " this tick");

      const heights = normalizeSeries(heightsRaw);
      drawDualChart(charts.height, heights, bcasts);
      text(refs.heightChartMeta, "height " + (j ? fmtInt(j.height) : "-") + " • bcasts/min " + fmtInt(d0.recentBcastsPerMin));

      renderWorkerList(workers);
      renderTimeline();
      renderLuckStats(j, d0);
      renderBlocksList();
      renderHealthIndicators(s, now, workers.length);
    }

    function renderWorkerList(workers) {
      const now = Date.now();
      text(refs.workersMeta, workers.length + " active");

      if (workers.length === 0) {
        refs.workerList.innerHTML = '<div class="empty-state">No active workers</div>';
        return;
      }

      // Sort by accepted shares descending
      const sorted = workers.slice().sort((a, b) => b.acceptedShares - a.acceptedShares);

      let html = '';
      for (const w of sorted) {
        const sessionMin = Math.floor(w.sessionSec / 60);
        const workerHashrate = getWorkerHashrate(w.name);
        const lastShareAge = w.lastShareAt > 0 ? fmtAgeMs(now - w.lastShareAt) : 'never';
        const totalWorkerShares = w.acceptedShares + w.rejectedShares;
        const efficiency = totalWorkerShares > 0 ? (w.acceptedShares / totalWorkerShares) * 100 : 0;

        // Get diagnostic info
        const tracker = workerHashrateTracker.get(w.name);
        const sampleCount = tracker ? tracker.samples.length : 0;
        let avgTimePerShare = 0;
        if (tracker && tracker.samples.length > 0) {
          let totalShares = 0;
          let totalTime = 0;
          for (const s of tracker.samples) {
            totalShares += s.shares;
            totalTime += s.timeMs;
          }
          avgTimePerShare = totalShares > 0 ? (totalTime / totalShares / 1000).toFixed(2) : 0;
        }
        const debugInfo = \`Difficulty: \${w.difficulty} | Shares: \${w.acceptedShares} | Samples: \${sampleCount} | Avg time/share: \${avgTimePerShare}s | Calculated: \${fmtHashrate(workerHashrate)}\`;

        html += \`
          <div class="worker-item" title="\${debugInfo}">
            <div class="worker-header">
              <div class="worker-name">\${escapeHtml(w.name)}</div>
              <div style="display: flex; gap: 6px; align-items: center;">
                <span class="efficiency-badge">\${efficiency.toFixed(1)}%</span>
                <span class="hashrate-badge">\${workerHashrate > 0 ? fmtHashrate(workerHashrate) : 'warming up'}</span>
              </div>
            </div>
            <div class="worker-stats">
              <div class="worker-stat">
                <span class="k">Accepted</span>
                <span class="v">\${fmtInt(w.acceptedShares)}</span>
              </div>
              <div class="worker-stat">
                <span class="k">Rejected</span>
                <span class="v">\${fmtInt(w.rejectedShares)}</span>
              </div>
              <div class="worker-stat">
                <span class="k">Difficulty</span>
                <span class="v">\${fmtInt(w.difficulty)}</span>
              </div>
              <div class="worker-stat">
                <span class="k">Last Share</span>
                <span class="v">\${lastShareAge}</span>
              </div>
              <div class="worker-stat">
                <span class="k">Session</span>
                <span class="v">\${sessionMin}m</span>
              </div>
              <div class="worker-stat">
                <span class="k">Agent</span>
                <span class="v" title="\${escapeHtml(w.userAgent)}">\${escapeHtml(w.userAgent.split('/')[0] || '-')}</span>
              </div>
            </div>
          </div>
        \`;
      }
      refs.workerList.innerHTML = html;
    }

    function renderHeroDifficulty(samples) {
      const list = Array.isArray(samples) ? samples.slice(-180) : [];
      drawDifficultyScatter(charts.heroDiff, list);
      text(refs.heroSignalMeta, "last " + fmtInt(list.length) + " shares");

      const difficulties = [];
      for (let i = 0; i < list.length; i += 1) {
        const d = safeNum(list[i] && list[i].difficulty, 0);
        if (d > 0) difficulties.push(d);
      }
      if (!difficulties.length) {
        text(refs.heroDiffRange, "range -");
        return;
      }

      let min = difficulties[0];
      let max = difficulties[0];
      for (let i = 1; i < difficulties.length; i += 1) {
        if (difficulties[i] < min) min = difficulties[i];
        if (difficulties[i] > max) max = difficulties[i];
      }
      text(refs.heroDiffRange, fmtDifficulty(min) + " -> " + fmtDifficulty(max));
    }

    function renderTimeline() {
      const maxHeight = 100;

      if (shareTimeline.length === 0) {
        if (!timelineDirty) return;
        refs.shareTimeline.innerHTML = '<div class="empty-state">No recent shares</div>';
        text(refs.timelineMeta, "last 0 shares");
        timelineDirty = false;
        timelineNewSinceRender = 0;
        return;
      }

      if (!timelineDirty) return;

      // Count shares per time bucket
      const buckets = new Array(MAX_TIMELINE_ITEMS).fill(0);
      const bucketTypes = new Array(MAX_TIMELINE_ITEMS).fill('accepted');

      for (let i = 0; i < shareTimeline.length; i++) {
        const share = shareTimeline[i];
        buckets[i] = 1;
        bucketTypes[i] = share.type;
      }

      const maxBucket = Math.max(1, ...buckets);
      const activeShares = shareTimeline.length;
      const newStartIndex = Math.max(0, activeShares - timelineNewSinceRender);

      let html = '';
      for (let i = 0; i < buckets.length; i++) {
        const height = (buckets[i] / maxBucket) * maxHeight;
        const cls = bucketTypes[i] === 'rejected' ? 'rejected' : '';
        const newCls = (i >= newStartIndex && i < activeShares && buckets[i] > 0) ? 'new' : '';
        html += \`<div class="timeline-bar \${cls} \${newCls}" style="height: \${height}%"></div>\`;
      }

      refs.shareTimeline.innerHTML = html;
      text(refs.timelineMeta, "last " + shareTimeline.length + " shares");
      timelineDirty = false;
      timelineNewSinceRender = 0;
    }

    function renderLuckStats(job, derived) {
      // Calculate network difficulty from job bits
      const networkDifficulty = job ? calculateDifficultyFromBits(job.bits) : 0;

      // Update best share session from backend stats
      // The backend now tracks actual share difficulty (not average worker difficulty)
      if (derived.bestShareDifficulty > 0) {
        bestShareSession = {
          difficulty: derived.bestShareDifficulty,
          hash: '',
          worker: derived.bestShareWorker || 'unknown',
          timestamp: derived.bestShareAt || Date.now()
        };
      }

      // Update best share all-time
      if (bestShareSession.difficulty > bestShareAllTime.difficulty) {
        bestShareAllTime = { ...bestShareSession };
        localStorage.setItem('pool-best-share', JSON.stringify(bestShareAllTime));
      }

      // Render session best
      if (bestShareSession.difficulty > 0) {
        text(refs.bestShareSession, fmtDifficulty(bestShareSession.difficulty));
        const sessionWorker = bestShareSession.worker || 'unknown';
        const sessionAge = fmtTsAge(bestShareSession.timestamp);
        text(refs.bestShareSessionHint, \`worker: \${sessionWorker} • \${sessionAge} ago\`);
      } else {
        text(refs.bestShareSession, '-');
        text(refs.bestShareSessionHint, 'No shares yet');
      }

      // Render all-time best
      if (bestShareAllTime.difficulty > 0) {
        text(refs.bestShareAlltime, fmtDifficulty(bestShareAllTime.difficulty));
        const alltimeWorker = bestShareAllTime.worker || 'unknown';
        const ageStr = fmtTsAge(bestShareAllTime.timestamp);
        text(refs.bestShareAlltimeHint, \`worker: \${alltimeWorker} • \${ageStr} ago\`);
      } else {
        text(refs.bestShareAlltime, '-');
        text(refs.bestShareAlltimeHint, 'No shares yet');
      }

      // Calculate time to block estimate
      if (derived.poolHashrate > 0 && networkDifficulty > 0) {
        // Expected shares to find a block = network difficulty
        // Time = (network_diff * 2^32) / pool_hashrate
        const expectedSeconds = (networkDifficulty * Math.pow(2, 32)) / derived.poolHashrate;
        text(refs.ttbEstimate, fmtAgeMs(expectedSeconds * 1000));
        text(refs.ttbHint, \`At \${fmtHashrate(derived.poolHashrate)} • Network diff \${fmtDifficulty(networkDifficulty)}\`);
      } else {
        text(refs.ttbEstimate, '-');
        text(refs.ttbHint, 'Waiting for hashrate data');
      }
    }

    function calculateDifficultyFromBits(bitsHex) {
      if (!bitsHex || typeof bitsHex !== 'string') return 0;
      const bits = parseInt(bitsHex, 16);
      const exp = bits >> 24;
      const mant = bits & 0xffffff;
      const target = mant * Math.pow(256, exp - 3);
      // Difficulty 1 target for SHA256d
      const diff1Target = 0x00000000ffff0000000000000000000000000000000000000000000000000000;
      return diff1Target / target;
    }

    function renderBlocksList() {
      const now = Date.now();
      text(refs.blocksMeta, blocksHistory.length + " found");

      if (blocksHistory.length === 0) {
        refs.blockList.innerHTML = '<div class="empty-state">No blocks found yet</div>';
        return;
      }

      let html = '';
      for (const block of blocksHistory) {
        const age = fmtAgeMs(now - block.timestamp);
        const shortHash = block.hash ? block.hash.slice(0, 12) + '...' + block.hash.slice(-12) : 'unknown';

        html += \`
          <div class="block-item">
            <div class="block-header">
              <span class="block-height">#\${fmtInt(block.height)}</span>
              <span class="block-age">\${age} ago</span>
            </div>
            <div class="block-hash" title="\${block.hash}" onclick="navigator.clipboard.writeText('\${block.hash}')">\${shortHash}</div>
            <div class="block-footer">
              <span>Found by: <span class="block-finder">\${escapeHtml(block.worker)}</span></span>
            </div>
          </div>
        \`;
      }
      refs.blockList.innerHTML = html;
    }

    function renderHealthIndicators(stats, now, workerCount) {
      // Template freshness
      const templateAge = stats.lastTemplateAt ? (now - stats.lastTemplateAt) : Infinity;
      let templateHealth = 'good';
      let templateText = fmtAgeMs(templateAge);
      if (templateAge > 60000) templateHealth = 'bad';
      else if (templateAge > 30000) templateHealth = 'warn';

      refs.healthTemplate.className = 'health-item ' + templateHealth;
      refs.healthTemplate.querySelector('.health-value').textContent = templateText;

      // RPC latency (smoothed exponential moving average of getblocktemplate fetch time)
      const rpcLag = stats.avgTemplateFetchMs || 0;
      let rpcHealth = 'good';
      if (rpcLag > 500) rpcHealth = 'bad';
      else if (rpcLag > 200) rpcHealth = 'warn';

      refs.healthRpc.className = 'health-item ' + rpcHealth;
      refs.healthRpc.querySelector('.health-value').textContent = Math.round(rpcLag) + 'ms';

      // Worker health
      let workerHealth = 'good';
      if (workerCount === 0) workerHealth = 'bad';

      refs.healthWorkers.className = 'health-item ' + workerHealth;
      refs.healthWorkers.querySelector('.health-value').textContent = workerCount.toString();
    }

    function escapeHtml(str) {
      const div = document.createElement('div');
      div.textContent = str;
      return div.innerHTML;
    }

    function normalizeSeries(values) {
      if (!values.length) return values;
      let min = values[0];
      let max = values[0];
      for (let i = 1; i < values.length; i += 1) {
        if (values[i] < min) min = values[i];
        if (values[i] > max) max = values[i];
      }
      const range = max - min;
      if (range <= 0) return values.map(() => 1);
      return values.map((v) => 1 + ((v - min) / range) * 99);
    }

    function celebrateBlockFound(blockHash) {
      // Play sound if enabled
      if (prefs.soundEnabled) {
        playBlockFoundSound();
      }

      // Show banner
      const shortHash = blockHash ? blockHash.slice(0, 16) + '...' : 'New block!';
      refs.blockBannerText.textContent = shortHash;
      refs.blockBanner.className = 'block-found-banner show';

      setTimeout(() => {
        refs.blockBanner.className = 'block-found-banner';
      }, 4000);

      // Launch confetti
      launchConfetti();

      // Desktop notification
      if (prefs.soundEnabled && 'Notification' in window && Notification.permission === 'granted') {
        new Notification('Block Found!', {
          body: \`New DigiByte block found: \${shortHash}\`,
          icon: '/favicon.ico'
        });
      }
    }

    function playBlockFoundSound() {
      // Create a simple beep sound using Web Audio API
      try {
        const audioContext = new (window.AudioContext || window.webkitAudioContext)();
        const oscillator = audioContext.createOscillator();
        const gainNode = audioContext.createGain();

        oscillator.connect(gainNode);
        gainNode.connect(audioContext.destination);

        oscillator.frequency.value = 800;
        oscillator.type = 'sine';

        gainNode.gain.setValueAtTime(0.3, audioContext.currentTime);
        gainNode.gain.exponentialRampToValueAtTime(0.01, audioContext.currentTime + 0.5);

        oscillator.start(audioContext.currentTime);
        oscillator.stop(audioContext.currentTime + 0.5);
      } catch (err) {
        console.warn('Could not play sound:', err);
      }
    }

    function launchConfetti() {
      const canvas = refs.confettiCanvas;
      const ctx = canvas.getContext('2d');
      canvas.width = window.innerWidth;
      canvas.height = window.innerHeight;

      const confetti = [];
      const colors = ['#43ffd1', '#b3ff4a', '#ffd257', '#59b3ff', '#b084ff'];
      const confettiCount = 150;

      for (let i = 0; i < confettiCount; i++) {
        confetti.push({
          x: Math.random() * canvas.width,
          y: Math.random() * canvas.height - canvas.height,
          w: Math.random() * 10 + 5,
          h: Math.random() * 10 + 5,
          color: colors[Math.floor(Math.random() * colors.length)],
          vx: Math.random() * 4 - 2,
          vy: Math.random() * 5 + 5,
          rotation: Math.random() * 360,
          rotationSpeed: Math.random() * 10 - 5
        });
      }

      let animationFrame;
      const animate = () => {
        ctx.clearRect(0, 0, canvas.width, canvas.height);

        let allOffScreen = true;
        for (const c of confetti) {
          c.x += c.vx;
          c.y += c.vy;
          c.rotation += c.rotationSpeed;
          c.vy += 0.2; // gravity

          if (c.y < canvas.height + 20) allOffScreen = false;

          ctx.save();
          ctx.translate(c.x, c.y);
          ctx.rotate(c.rotation * Math.PI / 180);
          ctx.fillStyle = c.color;
          ctx.fillRect(-c.w / 2, -c.h / 2, c.w, c.h);
          ctx.restore();
        }

        if (!allOffScreen) {
          animationFrame = requestAnimationFrame(animate);
        } else {
          ctx.clearRect(0, 0, canvas.width, canvas.height);
        }
      };

      animate();
    }

    // Request notification permission on first interaction
    d.body.addEventListener('click', () => {
      if (prefs.soundEnabled && 'Notification' in window && Notification.permission === 'default') {
        Notification.requestPermission();
      }
    }, { once: true });

    // Start SSE connection for real-time updates
    setupSSE();

    // UI update interval (for time displays, animations, etc.)
    setInterval(() => queueRender(), 1000);
  })();
  </script>
</body>
</html>`;
  return cachedHtml;
}

module.exports = { renderDashboardHtml };
