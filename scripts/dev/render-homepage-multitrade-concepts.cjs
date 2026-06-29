const fs = require("fs");
const path = require("path");
const { chromium } = require("playwright");

const root = path.resolve(__dirname, "..", "..");
const outDir = path.join(root, "tmp-homepage-multitrade-concepts");
fs.mkdirSync(outDir, { recursive: true });

const logoPath = path.join(root, "public", "reliance-logo-tight.png");
const logoData = `data:image/png;base64,${fs.readFileSync(logoPath).toString("base64")}`;

const tradeTiles = [
  { name: "Electrical", detail: "Lighting, panels, repairs", tone: "blue", icon: "bolt" },
  { name: "Plumbing", detail: "Leaks, drains, fixtures", tone: "cyan", icon: "drop" },
  { name: "HVAC", detail: "Cooling, vents, units", tone: "slate", icon: "fan" },
  { name: "Auto", detail: "Repair and detailing", tone: "indigo", icon: "wrench" },
  { name: "Cleaning", detail: "Homes and offices", tone: "teal", icon: "spark" },
  { name: "Lawn Care", detail: "Outdoor service proof", tone: "green", icon: "leaf" },
  { name: "Beauty", detail: "Barbers and stylists", tone: "violet", icon: "shears" },
  { name: "Appliance", detail: "Install and repair", tone: "steel", icon: "gear" },
];

function iconSvg(icon) {
  const stroke = "rgba(207,226,255,.9)";
  if (icon === "bolt") {
    return `<svg viewBox="0 0 32 32"><path d="M18 2 7 18h8l-1 12 11-17h-8l1-11Z" fill="none" stroke="${stroke}" stroke-width="2.4" stroke-linejoin="round"/></svg>`;
  }
  if (icon === "drop") {
    return `<svg viewBox="0 0 32 32"><path d="M16 3C10 10 7 15 7 20a9 9 0 0 0 18 0c0-5-3-10-9-17Z" fill="none" stroke="${stroke}" stroke-width="2.4"/></svg>`;
  }
  if (icon === "fan") {
    return `<svg viewBox="0 0 32 32"><circle cx="16" cy="16" r="3" fill="${stroke}"/><path d="M16 13c-2-8 6-10 9-5 2 4-4 7-9 8m3 2c7 4 4 12-2 12-5 0-4-7-1-12m-3 1c-7 3-12-3-9-8 3-4 8 0 9 8" fill="none" stroke="${stroke}" stroke-width="2"/></svg>`;
  }
  if (icon === "wrench") {
    return `<svg viewBox="0 0 32 32"><path d="M21 4a7 7 0 0 0 7 9L14 27a4 4 0 0 1-6-6L22 7a7 7 0 0 1-1-3Z" fill="none" stroke="${stroke}" stroke-width="2.3" stroke-linecap="round" stroke-linejoin="round"/></svg>`;
  }
  if (icon === "spark") {
    return `<svg viewBox="0 0 32 32"><path d="M16 3v8M16 21v8M3 16h8M21 16h8M8 8l5 5M19 19l5 5M24 8l-5 5M13 19l-5 5" stroke="${stroke}" stroke-width="2.2" stroke-linecap="round"/></svg>`;
  }
  if (icon === "leaf") {
    return `<svg viewBox="0 0 32 32"><path d="M27 5C14 5 6 12 6 22c0 3 2 5 5 5 10 0 16-9 16-22Z" fill="none" stroke="${stroke}" stroke-width="2.3"/><path d="M7 26c5-8 11-12 18-17" stroke="${stroke}" stroke-width="2.2" stroke-linecap="round"/></svg>`;
  }
  if (icon === "shears") {
    return `<svg viewBox="0 0 32 32"><circle cx="9" cy="23" r="4" fill="none" stroke="${stroke}" stroke-width="2.1"/><circle cx="20" cy="23" r="4" fill="none" stroke="${stroke}" stroke-width="2.1"/><path d="M12 20 26 6M17 20 6 6" stroke="${stroke}" stroke-width="2.2" stroke-linecap="round"/></svg>`;
  }
  return `<svg viewBox="0 0 32 32"><circle cx="16" cy="16" r="5" fill="none" stroke="${stroke}" stroke-width="2.2"/><path d="M16 2v6M16 24v6M2 16h6M24 16h6M6 6l4 4M22 22l4 4M26 6l-4 4M10 22l-4 4" stroke="${stroke}" stroke-width="2" stroke-linecap="round"/></svg>`;
}

function baseCss() {
  return `
    * { box-sizing: border-box; }
    body {
      margin: 0;
      width: 390px;
      min-height: 844px;
      overflow-x: hidden;
      background: #020610;
      font-family: Arial, Helvetica, sans-serif;
      color: #fff;
    }
    .phone {
      min-height: 844px;
      padding: 0;
      background: #020610;
    }
    .hero {
      min-height: 844px;
      position: relative;
      overflow: hidden;
      border: 1px solid rgba(112,169,255,.28);
      background:
        linear-gradient(rgba(65,132,255,.08) 1px, transparent 1px),
        linear-gradient(90deg, rgba(65,132,255,.08) 1px, transparent 1px),
        radial-gradient(circle at 78% 12%, rgba(43,113,255,.38), transparent 32%),
        #06111f;
      background-size: 34px 34px, 34px 34px, auto, auto;
    }
    .topbar {
      position: relative;
      z-index: 5;
      height: 62px;
      display: flex;
      align-items: center;
      padding: 11px 14px;
      background: rgba(4, 10, 19, .9);
      border-bottom: 1px solid rgba(125,178,255,.22);
      box-shadow: 0 12px 35px rgba(0,0,0,.35);
    }
    .brandPlate {
      display: inline-flex;
      align-items: center;
      width: 132px;
      min-height: 36px;
      padding: 4px 8px 4px 6px;
      border-radius: 10px;
      border: 1px solid rgba(75,145,255,.55);
      background: rgba(5,13,25,.72);
      overflow: hidden;
    }
    .brandPlate img {
      display: block;
      width: 118px;
      height: auto;
      object-fit: contain;
    }
    .tileGrid {
      position: absolute;
      inset: 62px 0 0;
      display: grid;
      grid-template-columns: 1fr 1fr;
      grid-auto-rows: 132px;
      opacity: .88;
      filter: saturate(.85) contrast(1.04);
    }
    .trade {
      position: relative;
      padding: 12px;
      display: flex;
      align-items: flex-end;
      overflow: hidden;
      border: 1px solid rgba(255,255,255,.07);
      background:
        linear-gradient(160deg, rgba(5,9,16,.1), rgba(4,8,16,.88)),
        radial-gradient(circle at 22% 18%, rgba(255,255,255,.14), transparent 16%),
        radial-gradient(circle at 78% 20%, var(--glow), transparent 30%),
        linear-gradient(135deg, #172337, #091423 56%, #132847);
    }
    .trade:before {
      content: "";
      position: absolute;
      right: 12px;
      top: 11px;
      width: 62px;
      height: 62px;
      border-radius: 18px;
      border: 1px solid rgba(187,214,255,.22);
      background: rgba(0,0,0,.16);
      transform: rotate(-4deg);
    }
    .trade:after {
      content: "";
      position: absolute;
      right: 18px;
      bottom: 20px;
      width: 96px;
      height: 16px;
      border-radius: 999px;
      background: linear-gradient(90deg, rgba(75,145,255,.65), rgba(40,214,170,.45));
      box-shadow: -42px -24px 0 rgba(255,255,255,.07), -16px -51px 0 rgba(255,255,255,.05);
      transform: rotate(-11deg);
      opacity: .62;
    }
    .trade svg {
      position: absolute;
      right: 27px;
      top: 25px;
      width: 36px;
      height: 36px;
      z-index: 1;
      opacity: .88;
    }
    .tradeText {
      position: relative;
      z-index: 2;
      text-shadow: 0 3px 15px rgba(0,0,0,.7);
    }
    .trade strong {
      display: block;
      font-size: 16px;
      line-height: 1;
      color: #fff;
    }
    .trade span {
      display: block;
      margin-top: 5px;
      max-width: 132px;
      color: #c7d7ee;
      font-size: 10px;
      line-height: 1.25;
    }
    .blue { color: #4f8dff; }
    .centerCopy {
      position: absolute;
      z-index: 4;
      left: 18px;
      right: 18px;
      top: 176px;
      min-height: 294px;
      display: flex;
      flex-direction: column;
      align-items: center;
      justify-content: center;
      text-align: center;
      padding: 24px 14px;
      border-radius: 28px;
      background: radial-gradient(circle at 50% 20%, rgba(5,11,22,.42), rgba(3,7,14,.82) 62%, rgba(3,7,14,.48));
      box-shadow: 0 18px 65px rgba(0,0,0,.5);
    }
    .pill {
      display: inline-flex;
      border: 1px solid rgba(75,145,255,.62);
      border-radius: 999px;
      background: rgba(3,10,23,.76);
      color: #aaccff;
      padding: 7px 12px;
      font-size: 9px;
      line-height: 1;
      font-weight: 900;
      letter-spacing: 1.35px;
      text-transform: uppercase;
      white-space: nowrap;
    }
    h1 {
      margin: 19px 0 0;
      color: #fff;
      font-size: 42px;
      line-height: .98;
      font-weight: 900;
      letter-spacing: 0;
      text-shadow: 0 4px 20px rgba(0,0,0,.72);
    }
    .lead {
      margin: 17px auto 0;
      max-width: 316px;
      color: #e4edfb;
      font-size: 14.5px;
      line-height: 1.36;
      text-shadow: 0 3px 14px rgba(0,0,0,.78);
    }
    .metricBar {
      position: absolute;
      z-index: 5;
      left: 14px;
      right: 14px;
      bottom: 14px;
      display: grid;
      grid-template-columns: repeat(3, 1fr);
      border: 1px solid rgba(114,173,255,.35);
      border-radius: 17px;
      overflow: hidden;
      background: rgba(5,13,25,.88);
      backdrop-filter: blur(12px);
      box-shadow: 0 18px 48px rgba(0,0,0,.45);
    }
    .metric {
      min-height: 103px;
      padding: 13px 8px;
      text-align: center;
      border-right: 1px solid rgba(114,173,255,.2);
    }
    .metric:last-child { border-right: 0; }
    .metricIcon {
      width: 31px;
      height: 31px;
      margin: 0 auto 8px;
      border: 1px solid rgba(84,151,255,.74);
      border-radius: 999px;
      display: flex;
      align-items: center;
      justify-content: center;
      color: #61a0ff;
      font-size: 16px;
      font-weight: 900;
    }
    .metric b { display:block; font-size:13px; color:#fff; }
    .metric span { display:block; margin-top:5px; color:#c0cde0; font-size:10.5px; line-height:1.25; }
  `;
}

function tileMarkup(offset = 0) {
  return tradeTiles
    .map((tile, index) => {
      const glows = {
        blue: "rgba(70,132,255,.38)",
        cyan: "rgba(52,211,255,.33)",
        slate: "rgba(148,163,184,.3)",
        indigo: "rgba(99,102,241,.36)",
        teal: "rgba(45,212,191,.32)",
        green: "rgba(74,222,128,.3)",
        violet: "rgba(139,92,246,.3)",
        steel: "rgba(96,165,250,.3)",
      };
      return `<div class="trade" style="--glow:${glows[tile.tone]};">${iconSvg(tile.icon)}<div class="tradeText"><strong>${tile.name}</strong><span>${tile.detail}</span></div></div>`;
    })
    .slice(offset)
    .concat(
      tradeTiles
        .slice(0, offset)
        .map((tile) => `<div class="trade" style="--glow:rgba(70,132,255,.32);">${iconSvg(tile.icon)}<div class="tradeText"><strong>${tile.name}</strong><span>${tile.detail}</span></div></div>`)
    )
    .join("");
}

function page({ fileLabel, headline, lead, pill, offset = 0 }) {
  return `
    <!doctype html>
    <html>
      <head><meta charset="utf-8" /><meta name="viewport" content="width=device-width, initial-scale=1" /><style>${baseCss()}</style></head>
      <body>
        <main class="phone">
          <section class="hero">
            <div class="topbar">
              <div class="brandPlate"><img src="${logoData}" alt="Reliance" /></div>
            </div>
            <div class="tileGrid">${tileMarkup(offset)}</div>
            <div class="centerCopy">
              <div class="pill">${pill}</div>
              <h1>${headline}</h1>
              <p class="lead">${lead}</p>
            </div>
            <div class="metricBar">
              <div class="metric"><div class="metricIcon">★</div><b>Authentic</b><span>Real customer reviews</span></div>
              <div class="metric"><div class="metricIcon">▶</div><b>Verified</b><span>Stage-by-stage service videos</span></div>
              <div class="metric"><div class="metricIcon">✓</div><b>Trusted</b><span>Transparent Trust Scores</span></div>
            </div>
          </section>
        </main>
      </body>
    </html>
  `;
}

const concepts = [
  {
    name: "01-multitrade-original-copy.png",
    html: page({
      pill: "Reviews + Service Videos + Trust Score",
      headline: `See local service <span class="blue">proof</span> before you <span class="blue">choose</span>`,
      lead: "Compare completed work, public service videos, customer reviews, and Trust Score evidence across home, auto, beauty, cleaning, lawn care, and more.",
      offset: 0,
    }),
  },
  {
    name: "02-every-trade-copy.png",
    html: page({
      pill: "Proof Across Local Trades",
      headline: `Compare real work from <span class="blue">local pros</span>`,
      lead: "Reliance helps customers evaluate electricians, plumbers, cleaners, mechanics, barbers, landscapers, appliance techs, and other service providers with clearer proof.",
      offset: 2,
    }),
  },
  {
    name: "03-many-services-copy.png",
    html: page({
      pill: "Many Services. One Trust View.",
      headline: `One place to see service <span class="blue">proof</span>`,
      lead: "From repairs and maintenance to personal services and outdoor work, Reliance brings completed videos, reviews, and Trust Scores into one easy comparison.",
      offset: 4,
    }),
  },
];

(async () => {
  const browser = await chromium.launch({ headless: true });
  const pageInstance = await browser.newPage({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 2 });
  for (const concept of concepts) {
    await pageInstance.setContent(concept.html, { waitUntil: "load" });
    const outPath = path.join(outDir, concept.name);
    await pageInstance.screenshot({ path: outPath, fullPage: true });
    console.log(`${concept.name}: ${outPath}`);
  }
  await browser.close();
})();
