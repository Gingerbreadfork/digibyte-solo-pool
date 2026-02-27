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
  <style>
    :root {
      --bg-0: #0a0e14;
      --bg-1: #151922;
      --bg-2: #1f2430;
      --bg-3: #2a2f3d;
      --ink-0: #ffffff;
      --ink-1: #b8c5db;
      --ink-2: #707a8c;
      --ink-3: #4d5566;
      --line: rgba(255,255,255,.06);
      --line-bright: rgba(255,255,255,.12);
      --card: rgba(21, 25, 34, .92);
      --card-hover: rgba(31, 36, 48, .95);
      --cyan: #00d9ff;
      --purple: #a277ff;
      --green: #29d398;
      --yellow: #ffcc66;
      --red: #ff6666;
      --orange: #ff9940;
      --pink: #f694ff;
      --blue: #5ccfe6;
      --radius-sm: 8px;
      --radius: 12px;
      --radius-lg: 16px;
      --shadow-sm: 0 2px 8px rgba(0,0,0,.3);
      --shadow: 0 8px 24px rgba(0,0,0,.4);
      --shadow-lg: 0 16px 48px rgba(0,0,0,.5);
      --glow-cyan: 0 0 20px rgba(0,217,255,.3);
      --glow-purple: 0 0 20px rgba(162,119,255,.3);
      --glow-green: 0 0 20px rgba(41,211,152,.3);
      --mono: ui-monospace, "JetBrains Mono", "Cascadia Code", "Fira Code", "SF Mono", Menlo, Consolas, monospace;
      --sans: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, "Helvetica Neue", Arial, sans-serif;
    }

    [data-theme="light"] {
      --bg-0: #f8f9fa;
      --bg-1: #ffffff;
      --bg-2: #f1f3f5;
      --bg-3: #e9ecef;
      --ink-0: #0a0e14;
      --ink-1: #495057;
      --ink-2: #868e96;
      --ink-3: #adb5bd;
      --line: rgba(0,0,0,.08);
      --line-bright: rgba(0,0,0,.12);
      --card: rgba(255, 255, 255, .95);
      --card-hover: rgba(255, 255, 255, 1);
      --shadow-sm: 0 2px 8px rgba(0,0,0,.08);
      --shadow: 0 8px 24px rgba(0,0,0,.12);
      --shadow-lg: 0 16px 48px rgba(0,0,0,.15);
    }

    * {
      box-sizing: border-box;
      margin: 0;
      padding: 0;
    }

    html, body {
      height: 100%;
      overflow-x: hidden;
    }

    body {
      font-family: var(--sans);
      color: var(--ink-0);
      background:
        radial-gradient(ellipse 1400px 900px at 20% -5%, rgba(0,217,255,.08), transparent 50%),
        radial-gradient(ellipse 1200px 800px at 85% 10%, rgba(162,119,255,.06), transparent 50%),
        radial-gradient(ellipse 1000px 700px at 50% 100%, rgba(41,211,152,.04), transparent 50%),
        var(--bg-0);
      min-height: 100vh;
      transition: all 0.3s cubic-bezier(0.4, 0, 0.2, 1);
      -webkit-font-smoothing: antialiased;
      -moz-osx-font-smoothing: grayscale;
    }

    [data-theme="light"] body {
      background:
        radial-gradient(ellipse 1400px 900px at 20% -5%, rgba(0,217,255,.04), transparent 50%),
        radial-gradient(ellipse 1200px 800px at 85% 10%, rgba(162,119,255,.03), transparent 50%),
        var(--bg-0);
    }

    .bg-grid::before {
      content: "";
      position: fixed;
      inset: 0;
      pointer-events: none;
      z-index: 0;
      background-image:
        linear-gradient(rgba(255,255,255,.02) 1px, transparent 1px),
        linear-gradient(90deg, rgba(255,255,255,.02) 1px, transparent 1px);
      background-size: 32px 32px;
      mask-image: radial-gradient(ellipse at 50% 0%, #000 30%, transparent 70%);
      opacity: 0.4;
    }

    [data-theme="light"] .bg-grid::before {
      background-image:
        linear-gradient(rgba(0,0,0,.03) 1px, transparent 1px),
        linear-gradient(90deg, rgba(0,0,0,.03) 1px, transparent 1px);
    }

    .wrap {
      max-width: 1520px;
      margin: 0 auto;
      padding: 24px;
      display: grid;
      gap: 20px;
      position: relative;
      z-index: 1;
    }

    .hero {
      border: 1px solid var(--line-bright);
      border-radius: var(--radius-lg);
      padding: 32px;
      background:
        linear-gradient(135deg, rgba(0,217,255,.03) 0%, transparent 50%),
        var(--card);
      backdrop-filter: blur(16px);
      box-shadow: var(--shadow-lg);
      display: grid;
      grid-template-columns: 1fr auto;
      gap: 32px;
      align-items: start;
      position: relative;
      overflow: hidden;
    }

    .hero::before {
      content: "";
      position: absolute;
      top: 0;
      left: 0;
      right: 0;
      height: 1px;
      background: linear-gradient(90deg, transparent, var(--cyan), transparent);
      opacity: 0.5;
    }

    .headline {
      display: grid;
      gap: 12px;
      align-content: start;
    }

    .title-row {
      display: flex;
      flex-wrap: wrap;
      align-items: center;
      gap: 16px;
    }

    h1 {
      margin: 0;
      font-size: clamp(1.75rem, 3vw, 2.5rem);
      font-weight: 700;
      line-height: 1.1;
      letter-spacing: -.03em;
      background: linear-gradient(135deg, var(--ink-0) 0%, var(--ink-1) 100%);
      -webkit-background-clip: text;
      -webkit-text-fill-color: transparent;
      background-clip: text;
    }

    .status-chip {
      display: inline-flex;
      align-items: center;
      gap: 10px;
      border-radius: 999px;
      border: 1px solid var(--line-bright);
      padding: 8px 16px;
      font-size: 13px;
      font-weight: 600;
      color: var(--ink-0);
      background: var(--bg-2);
      box-shadow: var(--shadow-sm);
    }

    .dot {
      width: 10px;
      height: 10px;
      border-radius: 50%;
      background: var(--yellow);
      box-shadow: 0 0 0 0 rgba(255,204,102,.6);
      transition: all .3s ease;
      position: relative;
    }

    .dot.ok {
      background: var(--green);
      animation: pulse 2s cubic-bezier(0.4, 0, 0.6, 1) infinite;
      box-shadow: 0 0 12px var(--green);
    }

    .dot.warn {
      background: var(--yellow);
      box-shadow: 0 0 12px var(--yellow);
    }

    .dot.err {
      background: var(--red);
      box-shadow: 0 0 12px var(--red);
    }

    @keyframes pulse {
      0%, 100% {
        box-shadow: 0 0 8px var(--green);
      }
      50% {
        box-shadow: 0 0 16px var(--green), 0 0 0 4px rgba(41,211,152,0);
      }
    }

    .hero-rail {
      display: grid;
      grid-template-columns: repeat(2, 1fr);
      gap: 16px;
    }

    .card {
      border: 1px solid var(--line);
      border-radius: var(--radius);
      background: var(--card);
      backdrop-filter: blur(12px);
      box-shadow: var(--shadow);
      min-width: 0;
      position: relative;
      overflow: hidden;
    }

    .card.pulse {
      animation: cardPulse 0.6s cubic-bezier(0.4, 0, 0.2, 1);
    }

    @keyframes cardPulse {
      0% {
        box-shadow: var(--shadow);
        border-color: var(--line);
      }
      50% {
        box-shadow: 0 0 40px rgba(0,217,255,.4), var(--shadow-lg);
        border-color: var(--cyan);
      }
      100% {
        box-shadow: var(--shadow);
        border-color: var(--line);
      }
    }

    .stat-card {
      padding: 20px;
      display: grid;
      gap: 10px;
      align-content: start;
      min-height: 110px;
      position: relative;
      overflow: hidden;
    }

    .stat-card::before {
      content: "";
      position: absolute;
      top: 0;
      left: -100%;
      width: 100%;
      height: 100%;
      background: linear-gradient(90deg, transparent, rgba(0,217,255,.08), transparent);
      transition: left 0.5s ease;
      pointer-events: none;
    }

    .stat-card.updated::before {
      animation: shimmer 0.7s ease-out;
    }

    @keyframes shimmer {
      0% { left: -100%; }
      100% { left: 100%; }
    }

    .label {
      font-size: 10px;
      font-weight: 700;
      letter-spacing: .2em;
      text-transform: uppercase;
      color: var(--ink-2);
      display: flex;
      align-items: center;
      gap: 8px;
    }

    .label-icon {
      font-size: 16px;
      opacity: 0.8;
      filter: grayscale(0.3);
    }

    .value {
      font-family: var(--mono);
      font-weight: 700;
      font-size: clamp(1.25rem, 2vw, 1.75rem);
      line-height: 1;
      letter-spacing: -.03em;
      color: var(--ink-0);
      white-space: nowrap;
      overflow: hidden;
      text-overflow: ellipsis;
      transition: all 0.3s cubic-bezier(0.4, 0, 0.2, 1);
    }

    .value.highlight {
      color: var(--cyan);
      text-shadow: 0 0 24px rgba(0,217,255,.5);
    }

    .hint {
      font-size: 12px;
      font-weight: 500;
      color: var(--ink-3);
      min-height: 1.2em;
      line-height: 1.4;
    }

    .grid {
      display: grid;
      grid-template-columns: repeat(12, minmax(0, 1fr));
      gap: 16px;
    }
    .span-3 { grid-column: span 3; }
    .span-4 { grid-column: span 4; }
    .span-6 { grid-column: span 6; }
    .span-8 { grid-column: span 8; }
    .span-12 { grid-column: span 12; }

    .chart-card {
      padding: 24px;
      display: grid;
      gap: 16px;
    }

    .chart-head {
      display: flex;
      align-items: center;
      justify-content: space-between;
      gap: 12px;
      padding-bottom: 12px;
      border-bottom: 1px solid var(--line);
    }

    .chart-head .title {
      font-size: 14px;
      font-weight: 700;
      letter-spacing: -.01em;
      color: var(--ink-0);
    }

    .chart-head .meta {
      font-family: var(--mono);
      font-size: 11px;
      font-weight: 500;
      color: var(--ink-2);
      white-space: nowrap;
      padding: 4px 10px;
      background: var(--bg-2);
      border-radius: var(--radius-sm);
      border: 1px solid var(--line);
    }
    .chart-wrap {
      position: relative;
      height: 160px;
      border-radius: var(--radius);
      border: 1px solid var(--line);
      background:
        linear-gradient(rgba(0,217,255,.02) 1px, transparent 1px) 0 0 / 100% 25%,
        linear-gradient(90deg, rgba(0,217,255,.01) 1px, transparent 1px) 0 0 / 12.5% 100%,
        var(--bg-1);
      overflow: hidden;
      box-shadow: inset 0 2px 8px rgba(0,0,0,.3);
    }

    [data-theme="light"] .chart-wrap {
      background:
        linear-gradient(rgba(0,0,0,.02) 1px, transparent 1px) 0 0 / 100% 25%,
        linear-gradient(90deg, rgba(0,0,0,.01) 1px, transparent 1px) 0 0 / 12.5% 100%,
        var(--bg-2);
      box-shadow: inset 0 2px 8px rgba(0,0,0,.05);
    }

    canvas {
      width: 100%;
      height: 100%;
      display: block;
    }

    .table-card {
      padding: 12px;
      display: grid;
      gap: 8px;
    }
    .rows {
      display: grid;
      grid-template-columns: repeat(2, minmax(0,1fr));
      gap: 8px;
    }
    .row {
      display: flex;
      justify-content: space-between;
      gap: 10px;
      border-radius: 10px;
      border: 1px solid rgba(255,255,255,.06);
      padding: 8px 10px;
      background: rgba(255,255,255,.015);
      min-width: 0;
      transition: all 0.2s ease;
    }
    [data-theme="light"] .row {
      border-color: rgba(0,0,0,.06);
      background: rgba(0,0,0,.015);
    }
    .row .k {
      color: var(--ink-2);
      font-size: 12px;
    }
    .row .v {
      color: var(--ink-0);
      font-family: var(--mono);
      font-size: 12px;
      text-align: right;
      min-width: 0;
      overflow: hidden;
      text-overflow: ellipsis;
      white-space: nowrap;
    }

    /* Controls Section */
    .controls {
      display: flex;
      gap: 10px;
      align-items: center;
    }

    .icon-btn {
      width: 40px;
      height: 40px;
      border-radius: var(--radius-sm);
      border: 1px solid var(--line);
      background: var(--bg-2);
      color: var(--ink-2);
      display: flex;
      align-items: center;
      justify-content: center;
      cursor: pointer;
      transition: all 0.3s cubic-bezier(0.4, 0, 0.2, 1);
      font-size: 18px;
      padding: 0;
      box-shadow: var(--shadow-sm);
      position: relative;
      overflow: hidden;
    }

    .icon-btn::before {
      content: "";
      position: absolute;
      inset: 0;
      background: linear-gradient(135deg, var(--cyan), var(--purple));
      opacity: 0;
      transition: opacity 0.3s ease;
    }

    .icon-btn:hover {
      background: var(--bg-3);
      border-color: var(--cyan);
      color: var(--cyan);
      box-shadow: var(--glow-cyan);
      transform: translateY(-2px);
    }

    .icon-btn.active {
      background: rgba(0,217,255,.15);
      border-color: var(--cyan);
      color: var(--cyan);
      box-shadow: var(--glow-cyan);
    }

    .icon-btn.active::before {
      opacity: 0.1;
    }

    /* Copy Button */
    .copy-btn {
      padding: 4px 8px;
      border-radius: 6px;
      border: 1px solid var(--line);
      background: rgba(67,255,209,.08);
      color: var(--teal);
      font-size: 11px;
      font-family: var(--mono);
      cursor: pointer;
      transition: all 0.2s ease;
      white-space: nowrap;
    }

    .copy-btn:hover {
      background: rgba(67,255,209,.15);
      border-color: var(--teal);
    }

    .copy-btn.copied {
      background: rgba(179,255,74,.15);
      border-color: var(--lime);
      color: var(--lime);
    }

    /* Connection Info */
    .conn-info {
      display: grid;
      gap: 8px;
    }

    .conn-row {
      display: flex;
      justify-content: space-between;
      align-items: center;
      gap: 10px;
      padding: 8px 10px;
      border-radius: 8px;
      border: 1px solid rgba(67,255,209,.15);
      background: rgba(67,255,209,.05);
    }

    .conn-label {
      font-size: 11px;
      color: var(--ink-2);
      text-transform: uppercase;
      letter-spacing: .1em;
    }

    .conn-value {
      font-family: var(--mono);
      font-size: 12px;
      color: var(--teal);
      font-weight: 600;
      flex: 1;
      text-align: right;
      overflow: hidden;
      text-overflow: ellipsis;
      white-space: nowrap;
    }

    /* Recent Blocks */
    .block-list {
      display: grid;
      gap: 6px;
      max-height: 300px;
      overflow-y: auto;
      padding-right: 4px;
    }

    .block-list::-webkit-scrollbar {
      width: 6px;
    }

    .block-list::-webkit-scrollbar-track {
      background: rgba(255,255,255,.02);
      border-radius: 3px;
    }

    [data-theme="light"] .block-list::-webkit-scrollbar-track {
      background: rgba(0,0,0,.02);
    }

    .block-list::-webkit-scrollbar-thumb {
      background: rgba(255,255,255,.1);
      border-radius: 3px;
    }

    [data-theme="light"] .block-list::-webkit-scrollbar-thumb {
      background: rgba(0,0,0,.1);
    }

    .block-item {
      border-radius: 10px;
      border: 1px solid rgba(67,255,209,.2);
      padding: 10px 12px;
      background: rgba(67,255,209,.05);
      display: grid;
      gap: 6px;
    }

    .block-header {
      display: flex;
      justify-content: space-between;
      align-items: center;
      gap: 8px;
    }

    .block-height {
      font-family: var(--mono);
      font-size: 14px;
      font-weight: 700;
      color: var(--teal);
    }

    .block-age {
      font-size: 11px;
      color: var(--ink-2);
    }

    .block-hash {
      font-family: var(--mono);
      font-size: 11px;
      color: var(--ink-1);
      overflow: hidden;
      text-overflow: ellipsis;
      white-space: nowrap;
      cursor: pointer;
    }

    .block-footer {
      display: flex;
      justify-content: space-between;
      align-items: center;
      gap: 8px;
      font-size: 11px;
      color: var(--ink-2);
    }

    .block-finder {
      font-family: var(--mono);
      color: var(--ink-1);
    }

    /* Luck Stats */
    .luck-stats {
      display: grid;
      gap: 8px;
    }

    .luck-item {
      padding: 10px 12px;
      border-radius: 10px;
      border: 1px solid rgba(179,255,74,.15);
      background: rgba(179,255,74,.05);
      display: grid;
      gap: 4px;
    }

    .luck-label {
      font-size: 11px;
      color: var(--ink-2);
      text-transform: uppercase;
      letter-spacing: .1em;
    }

    .luck-value {
      font-family: var(--mono);
      font-size: 16px;
      font-weight: 700;
      color: var(--lime);
    }

    .luck-hint {
      font-size: 11px;
      color: var(--ink-2);
    }

    .luck-bar {
      height: 6px;
      border-radius: 3px;
      background: rgba(255,255,255,.05);
      overflow: hidden;
      margin-top: 4px;
    }

    [data-theme="light"] .luck-bar {
      background: rgba(0,0,0,.05);
    }

    .luck-fill {
      height: 100%;
      background: linear-gradient(90deg, var(--lime), var(--teal));
      transition: width 0.5s ease;
    }

    /* Worker List Styles */
    .worker-list {
      display: grid;
      gap: 12px;
      max-height: 420px;
      overflow-y: auto;
      padding-right: 6px;
    }

    .worker-list::-webkit-scrollbar {
      width: 8px;
    }

    .worker-list::-webkit-scrollbar-track {
      background: var(--bg-1);
      border-radius: var(--radius-sm);
    }

    .worker-list::-webkit-scrollbar-thumb {
      background: var(--bg-3);
      border-radius: var(--radius-sm);
      border: 2px solid var(--bg-1);
    }

    .worker-item {
      border-radius: var(--radius);
      border: 1px solid var(--line);
      padding: 16px;
      background: linear-gradient(135deg, var(--bg-2) 0%, var(--bg-1) 100%);
      display: grid;
      gap: 12px;
      transition: all 0.3s cubic-bezier(0.4, 0, 0.2, 1);
      position: relative;
      overflow: hidden;
    }


    .worker-header {
      display: flex;
      justify-content: space-between;
      align-items: center;
      gap: 8px;
    }

    .worker-name {
      font-family: var(--mono);
      font-size: 15px;
      font-weight: 700;
      color: var(--ink-0);
      overflow: hidden;
      text-overflow: ellipsis;
      white-space: nowrap;
      letter-spacing: -.02em;
    }

    .worker-stats {
      display: grid;
      grid-template-columns: repeat(3, 1fr);
      gap: 10px;
      font-size: 12px;
    }

    .worker-stat {
      display: flex;
      flex-direction: column;
      gap: 4px;
      padding: 8px;
      background: var(--bg-1);
      border-radius: var(--radius-sm);
      border: 1px solid var(--line);
    }

    .worker-stat .k {
      color: var(--ink-3);
      font-size: 10px;
      font-weight: 600;
      text-transform: uppercase;
      letter-spacing: .05em;
    }

    .worker-stat .v {
      font-family: var(--mono);
      color: var(--ink-0);
      font-weight: 700;
      font-size: 13px;
    }

    .worker-badge {
      display: inline-block;
      padding: 4px 10px;
      border-radius: var(--radius-sm);
      font-size: 11px;
      font-weight: 700;
      background: rgba(0,217,255,.15);
      color: var(--cyan);
      border: 1px solid rgba(0,217,255,.3);
    }

    .hashrate-badge {
      font-size: 13px;
      font-family: var(--mono);
      color: var(--cyan);
      font-weight: 700;
      padding: 6px 12px;
      background: rgba(0,217,255,.1);
      border-radius: var(--radius-sm);
      border: 1px solid rgba(0,217,255,.2);
    }

    .efficiency-badge {
      font-size: 11px;
      padding: 6px 12px;
      border-radius: var(--radius-sm);
      background: rgba(41,211,152,.15);
      color: var(--green);
      font-weight: 700;
      border: 1px solid rgba(41,211,152,.3);
    }

    /* Timeline Styles */
    .timeline {
      display: flex;
      gap: 4px;
      height: 48px;
      align-items: flex-end;
      padding: 8px;
      background: var(--bg-1);
      border-radius: var(--radius);
      border: 1px solid var(--line);
      overflow: hidden;
      box-shadow: inset 0 2px 8px rgba(0,0,0,.3);
    }

    .timeline-bar {
      flex: 1;
      min-width: 3px;
      background: linear-gradient(180deg, var(--cyan), var(--blue));
      border-radius: var(--radius-sm) var(--radius-sm) 0 0;
      transition: all 0.3s cubic-bezier(0.4, 0, 0.2, 1);
      opacity: 0.7;
      position: relative;
      box-shadow: 0 0 8px rgba(0,217,255,.3);
    }

    .timeline-bar.rejected {
      background: linear-gradient(180deg, var(--red), var(--orange));
      box-shadow: 0 0 8px rgba(255,102,102,.3);
    }

    .timeline-bar.new {
      animation: barGrow 0.4s cubic-bezier(0.34, 1.56, 0.64, 1);
    }

    @keyframes barGrow {
      from {
        transform: scaleY(0);
        opacity: 0;
      }
      to {
        transform: scaleY(1);
        opacity: 0.7;
      }
    }

    /* Health Indicator */
    .health-grid {
      display: grid;
      grid-template-columns: repeat(3, 1fr);
      gap: 12px;
    }

    .health-item {
      padding: 16px;
      border-radius: var(--radius);
      border: 1px solid var(--line);
      background: var(--bg-1);
      display: grid;
      gap: 8px;
      text-align: center;
      transition: all 0.3s cubic-bezier(0.4, 0, 0.2, 1);
      position: relative;
      overflow: hidden;
    }

    .health-item::before {
      content: "";
      position: absolute;
      top: 0;
      left: 0;
      right: 0;
      height: 3px;
      background: var(--ink-3);
      opacity: 0.3;
    }

    .health-item.good {
      border-color: rgba(41,211,152,.3);
      background: linear-gradient(135deg, rgba(41,211,152,.08), var(--bg-1));
    }

    .health-item.good::before {
      background: var(--green);
      opacity: 1;
      box-shadow: 0 0 12px var(--green);
    }

    .health-item.warn {
      border-color: rgba(255,204,102,.3);
      background: linear-gradient(135deg, rgba(255,204,102,.08), var(--bg-1));
    }

    .health-item.warn::before {
      background: var(--yellow);
      opacity: 1;
      box-shadow: 0 0 12px var(--yellow);
    }

    .health-item.bad {
      border-color: rgba(255,102,102,.3);
      background: linear-gradient(135deg, rgba(255,102,102,.08), var(--bg-1));
    }

    .health-item.bad::before {
      background: var(--red);
      opacity: 1;
      box-shadow: 0 0 12px var(--red);
    }

    .health-label {
      font-size: 10px;
      font-weight: 700;
      color: var(--ink-2);
      text-transform: uppercase;
      letter-spacing: .15em;
    }

    .health-value {
      font-family: var(--mono);
      font-size: 18px;
      font-weight: 700;
      color: var(--ink-0);
    }

    .health-item.good .health-value {
      color: var(--green);
      text-shadow: 0 0 12px rgba(41,211,152,.4);
    }

    .health-item.warn .health-value {
      color: var(--yellow);
      text-shadow: 0 0 12px rgba(255,204,102,.4);
    }

    .health-item.bad .health-value {
      color: var(--red);
      text-shadow: 0 0 12px rgba(255,102,102,.4);
    }

    /* Confetti Animation */
    .confetti-canvas {
      position: fixed;
      top: 0;
      left: 0;
      width: 100%;
      height: 100%;
      pointer-events: none;
      z-index: 9999;
    }

    /* Block Found Banner */
    .block-found-banner {
      position: fixed;
      top: 50%;
      left: 50%;
      transform: translate(-50%, -50%) scale(0);
      background: linear-gradient(135deg, var(--cyan), var(--purple));
      padding: 48px 72px;
      border-radius: var(--radius-lg);
      box-shadow: 0 24px 96px rgba(0,217,255,.8), 0 0 120px rgba(162,119,255,.6);
      border: 2px solid rgba(255,255,255,.2);
      z-index: 10000;
      text-align: center;
      pointer-events: none;
      opacity: 0;
      backdrop-filter: blur(12px);
    }

    .block-found-banner.show {
      animation: blockFoundAnimation 4s cubic-bezier(0.34, 1.56, 0.64, 1) forwards;
    }

    @keyframes blockFoundAnimation {
      0% {
        opacity: 0;
        transform: translate(-50%, -50%) scale(0) rotate(-15deg);
      }
      15% {
        opacity: 1;
        transform: translate(-50%, -50%) scale(1.15) rotate(3deg);
      }
      25% {
        transform: translate(-50%, -50%) scale(1) rotate(0deg);
      }
      75% {
        opacity: 1;
        transform: translate(-50%, -50%) scale(1) rotate(0deg);
      }
      100% {
        opacity: 0;
        transform: translate(-50%, -50%) scale(0.7) rotate(8deg);
      }
    }

    .block-found-banner h2 {
      margin: 0 0 16px 0;
      font-size: 56px;
      font-weight: 900;
      color: #ffffff;
      text-shadow: 0 4px 16px rgba(0,0,0,.4);
      letter-spacing: -.03em;
    }

    .block-found-banner p {
      margin: 0;
      font-size: 22px;
      color: rgba(255,255,255,.95);
      font-weight: 600;
      font-family: var(--mono);
    }

    .footer {
      padding: 16px 0 24px;
      color: var(--ink-3);
      font-size: 12px;
      display: flex;
      justify-content: space-between;
      align-items: center;
      gap: 16px;
      flex-wrap: wrap;
      border-top: 1px solid var(--line);
      margin-top: 8px;
    }

    .footer code {
      font-family: var(--mono);
      background: var(--bg-2);
      padding: 2px 6px;
      border-radius: 4px;
      border: 1px solid var(--line);
      font-size: 11px;
      color: var(--cyan);
    }

    .reveal {
      animation: rise 0.6s cubic-bezier(0.16, 1, 0.3, 1) both;
    }

    .reveal:nth-child(1) { animation-delay: 0ms; }
    .reveal:nth-child(2) { animation-delay: 60ms; }
    .reveal:nth-child(3) { animation-delay: 120ms; }
    .reveal:nth-child(4) { animation-delay: 180ms; }
    .reveal:nth-child(5) { animation-delay: 240ms; }
    .reveal:nth-child(6) { animation-delay: 300ms; }

    @keyframes rise {
      from {
        opacity: 0;
        transform: translateY(24px);
        filter: blur(4px);
      }
      to {
        opacity: 1;
        transform: translateY(0);
        filter: blur(0);
      }
    }

    @media (max-width: 1200px) {
      .hero {
        grid-template-columns: 1fr;
        gap: 24px;
      }
      .span-8, .span-6, .span-4, .span-3 {
        grid-column: span 12;
      }
    }

    @media (max-width: 768px) {
      .wrap {
        padding: 16px;
        gap: 16px;
      }
      .hero {
        padding: 24px;
      }
      .hero-rail {
        grid-template-columns: 1fr;
        gap: 12px;
      }
      .rows {
        grid-template-columns: 1fr;
      }
      .worker-stats {
        grid-template-columns: repeat(2, 1fr);
      }
      .health-grid {
        grid-template-columns: 1fr;
      }
      .chart-wrap {
        height: 140px;
      }
    }

    @media (max-width: 480px) {
      .wrap {
        padding: 12px;
        gap: 12px;
      }
      .hero {
        padding: 20px;
      }
      h1 {
        font-size: 1.5rem;
      }
      .stat-card {
        min-height: 90px;
        padding: 16px;
      }
      .chart-card {
        padding: 16px;
      }
      .worker-stats {
        grid-template-columns: 1fr;
      }
      .controls {
        flex-wrap: wrap;
      }
      .block-found-banner {
        padding: 32px 40px;
      }
      .block-found-banner h2 {
        font-size: 36px;
      }
      .block-found-banner p {
        font-size: 16px;
      }
    }

    @media (prefers-reduced-motion: reduce) {
      * {
        animation-duration: 0.01ms !important;
        animation-iteration-count: 1 !important;
        transition-duration: 0.01ms !important;
      }
      .reveal {
        animation: none;
        opacity: 1;
        transform: none;
      }
    }
  </style>
</head>
<body class="bg-grid" data-theme="dark">
  <canvas class="confetti-canvas" id="confetti"></canvas>
  <div class="block-found-banner" id="block-banner">
    <h2>🎉 BLOCK FOUND! 🎉</h2>
    <p id="block-banner-text">Congratulations!</p>
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
          </div>
        </div>
      </div>
      <div class="hero-rail">
        <div class="card stat-card">
          <div class="label"><span class="label-icon">⚡</span>Pool Hashrate</div>
          <div id="pool-hashrate" class="value">-</div>
          <div id="pool-hashrate-hint" class="hint">estimated rate</div>
        </div>
        <div class="card stat-card">
          <div class="label"><span class="label-icon">✓</span>Accepted / Min</div>
          <div id="rpm-accepted" class="value">-</div>
          <div id="rpm-accepted-hint" class="hint">live throughput</div>
        </div>
        <div class="card stat-card">
          <div class="label"><span class="label-icon">📊</span>Reject Ratio</div>
          <div id="ratio-reject" class="value">-</div>
          <div id="ratio-reject-hint" class="hint">of total shares</div>
        </div>
        <div class="card stat-card">
          <div class="label"><span class="label-icon">🕒</span>Last Share</div>
          <div id="last-share-age" class="value">-</div>
          <div id="last-share-worker" class="hint">worker: -</div>
        </div>
      </div>
    </section>

    <section class="grid reveal">
      <article class="card stat-card span-3"><div class="label">Current Height</div><div id="height" class="value">-</div><div id="height-hint" class="hint">network tip</div></article>
      <article class="card stat-card span-3"><div class="label">Active Job</div><div id="job-id" class="value">-</div><div id="job-meta" class="hint">-</div></article>
      <article class="card stat-card span-3"><div class="label">Connections</div><div id="conn" class="value">-</div><div id="conn-hint" class="hint">connected / auth / sub</div></article>
      <article class="card stat-card span-3"><div class="label">Uptime</div><div id="uptime" class="value">-</div><div id="uptime-hint" class="hint">process runtime</div></article>
    </section>

    <section class="grid reveal">
      <article class="card chart-card span-12">
        <div class="chart-head">
          <div class="title">Pool Health</div>
          <div class="meta">system status</div>
        </div>
        <div class="health-grid">
          <div class="health-item" id="health-template">
            <div class="health-label">Template</div>
            <div class="health-value">-</div>
          </div>
          <div class="health-item" id="health-rpc">
            <div class="health-label">RPC Lag</div>
            <div class="health-value">-</div>
          </div>
          <div class="health-item" id="health-workers">
            <div class="health-label">Workers</div>
            <div class="health-value">-</div>
          </div>
        </div>
      </article>
    </section>

    <section class="grid reveal">
      <article class="card chart-card span-6">
        <div class="chart-head">
          <div class="title">Share Luck & Best Share</div>
          <div id="luck-meta" class="meta">progress to block</div>
        </div>
        <div class="luck-stats">
          <div class="luck-item">
            <div class="luck-label">Best Share (Session)</div>
            <div class="luck-value" id="best-share-session">-</div>
            <div class="luck-hint" id="best-share-session-hint">No shares yet</div>
            <div class="luck-bar"><div class="luck-fill" id="best-share-session-bar" style="width: 0%"></div></div>
          </div>
          <div class="luck-item">
            <div class="luck-label">Best Share (All Time)</div>
            <div class="luck-value" id="best-share-alltime">-</div>
            <div class="luck-hint" id="best-share-alltime-hint">No shares yet</div>
            <div class="luck-bar"><div class="luck-fill" id="best-share-alltime-bar" style="width: 0%"></div></div>
          </div>
          <div class="luck-item">
            <div class="luck-label">Time to Block (Est.)</div>
            <div class="luck-value" id="ttb-estimate">-</div>
            <div class="luck-hint" id="ttb-hint">Based on current hashrate</div>
          </div>
        </div>
      </article>
      <article class="card chart-card span-6">
        <div class="chart-head">
          <div class="title">Recent Blocks Found</div>
          <div id="blocks-meta" class="meta">-</div>
        </div>
        <div class="block-list" id="block-list">
          <div style="text-align: center; padding: 20px; color: var(--ink-2);">No blocks found yet</div>
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
          <div class="title">Height & Job Activity</div>
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
          <div style="text-align: center; padding: 20px; color: var(--ink-2);">No active workers</div>
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
      <span>Real-time updates via Server-Sent Events (SSE).</span>
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
      bestShareSessionBar: d.getElementById("best-share-session-bar"),
      bestShareAlltime: d.getElementById("best-share-alltime"),
      bestShareAlltimeHint: d.getElementById("best-share-alltime-hint"),
      bestShareAlltimeBar: d.getElementById("best-share-alltime-bar"),
      ttbEstimate: d.getElementById("ttb-estimate"),
      ttbHint: d.getElementById("ttb-hint"),
      blockList: d.getElementById("block-list"),
      blocksMeta: d.getElementById("blocks-meta"),
      luckMeta: d.getElementById("luck-meta"),
      healthTemplate: d.getElementById("health-template"),
      healthRpc: d.getElementById("health-rpc"),
      healthWorkers: d.getElementById("health-workers")
    };

    const charts = {
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
      drawDualChart(charts.shares, shareA, shareB);
      text(refs.sharesChartMeta, "acc " + fmtInt(d0.acceptedDelta) + " / rej " + fmtInt(d0.rejectedDelta) + " this tick");

      const heights = normalizeSeries(ringToArray(history.height));
      const bcasts = ringToArray(history.broadcastsDelta);
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
        refs.workerList.innerHTML = '<div style="text-align: center; padding: 20px; color: var(--ink-2);">No active workers</div>';
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

    function renderTimeline() {
      const now = Date.now();
      const maxHeight = 100;

      if (shareTimeline.length === 0) {
        refs.shareTimeline.innerHTML = '<div style="text-align: center; color: var(--ink-2); padding: 10px;">No recent shares</div>';
        return;
      }

      // Count shares per time bucket
      const buckets = new Array(MAX_TIMELINE_ITEMS).fill(0);
      const bucketTypes = new Array(MAX_TIMELINE_ITEMS).fill('accepted');

      for (let i = 0; i < shareTimeline.length; i++) {
        const share = shareTimeline[i];
        buckets[i] = 1;
        bucketTypes[i] = share.type;
      }

      const maxBucket = Math.max(1, ...buckets);

      let html = '';
      for (let i = 0; i < buckets.length; i++) {
        const height = (buckets[i] / maxBucket) * maxHeight;
        const cls = bucketTypes[i] === 'rejected' ? 'rejected' : '';
        const newCls = i === buckets.length - 1 && buckets[i] > 0 ? 'new' : '';
        html += \`<div class="timeline-bar \${cls} \${newCls}" style="height: \${height}%"></div>\`;
      }

      refs.shareTimeline.innerHTML = html;
      text(refs.timelineMeta, "last " + shareTimeline.length + " shares");
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
        const sessionLuck = networkDifficulty > 0 ? (bestShareSession.difficulty / networkDifficulty) * 100 : 0;
        text(refs.bestShareSessionHint, \`\${sessionLuck.toFixed(4)}% of network target\`);
        refs.bestShareSessionBar.style.width = Math.min(100, sessionLuck).toFixed(2) + '%';
      } else {
        text(refs.bestShareSession, '-');
        text(refs.bestShareSessionHint, 'No shares yet');
        refs.bestShareSessionBar.style.width = '0%';
      }

      // Render all-time best
      if (bestShareAllTime.difficulty > 0) {
        text(refs.bestShareAlltime, fmtDifficulty(bestShareAllTime.difficulty));
        const alltimeLuck = networkDifficulty > 0 ? (bestShareAllTime.difficulty / networkDifficulty) * 100 : 0;
        const ageStr = fmtTsAge(bestShareAllTime.timestamp);
        text(refs.bestShareAlltimeHint, \`\${alltimeLuck.toFixed(4)}% of target • \${ageStr} ago\`);
        refs.bestShareAlltimeBar.style.width = Math.min(100, alltimeLuck).toFixed(2) + '%';
      } else {
        text(refs.bestShareAlltime, '-');
        text(refs.bestShareAlltimeHint, 'No shares yet');
        refs.bestShareAlltimeBar.style.width = '0%';
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
        refs.blockList.innerHTML = '<div style="text-align: center; padding: 20px; color: var(--ink-2);">No blocks found yet</div>';
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
