const fs = require("fs");
const path = require("path");
const { chromium } = require("playwright");

const root = path.resolve(__dirname, "..", "..");
const outDir = path.join(root, "tmp-homepage-concepts");
fs.mkdirSync(outDir, { recursive: true });

const logoPath = path.join(root, "public", "reliance-logo-tight.png");
const logoData = `data:image/png;base64,${fs.readFileSync(logoPath).toString("base64")}`;

const professions = [
  ["Electrical", "Breaker panels, outlets, lighting"],
  ["Plumbing", "Leaks, drains, fixtures"],
  ["HVAC", "Cooling, vents, service units"],
  ["Auto", "Repairs, detailing, diagnostics"],
  ["Cleaning", "Homes, offices, turnovers"],
  ["Lawn Care", "Yards, trees, outdoor work"],
  ["Beauty", "Barbers, stylists, wellness"],
  ["Appliance", "Ovens, washers, installs"],
];

function baseCss() {
  return `
    * { box-sizing: border-box; }
    body {
      margin: 0;
      background: #040810;
      color: #f8fbff;
      font-family: Arial, Helvetica, sans-serif;
      width: 390px;
      min-height: 844px;
      overflow-x: hidden;
    }
    .phone {
      min-height: 844px;
      background:
        linear-gradient(rgba(37, 99, 235, .08) 1px, transparent 1px),
        linear-gradient(90deg, rgba(37, 99, 235, .08) 1px, transparent 1px),
        radial-gradient(circle at 72% 12%, rgba(47,109,246,.38), transparent 28%),
        linear-gradient(180deg, #07111f 0%, #050a12 58%, #03060c 100%);
      background-size: 32px 32px, 32px 32px, auto, auto;
      padding: 14px;
    }
    .topbar {
      height: 58px;
      border: 1px solid rgba(126, 182, 255, .2);
      border-radius: 12px 12px 0 0;
      background: rgba(4, 10, 20, .86);
      display: flex;
      align-items: center;
      justify-content: space-between;
      padding: 10px 14px;
      position: relative;
      z-index: 4;
    }
    .logo { width: 168px; height: auto; display:block; }
    .menu { width: 22px; height: 16px; display:grid; gap:4px; }
    .menu span { display:block; height:2px; border-radius: 2px; background:#cfe2ff; }
    .pill {
      display:inline-flex;
      align-items:center;
      justify-content:center;
      border: 1px solid rgba(78, 145, 255, .52);
      border-radius: 999px;
      background: rgba(8, 20, 38, .78);
      color: #b9d4ff;
      font-size: 10px;
      font-weight: 800;
      letter-spacing: 2.1px;
      text-transform: uppercase;
      padding: 7px 13px;
    }
    h1 {
      margin: 0;
      color: #fff;
      font-size: 47px;
      line-height: .99;
      letter-spacing: 0;
      font-weight: 900;
      text-shadow: 0 3px 18px rgba(0,0,0,.68);
    }
    .blue { color:#3f86ff; }
    .lead {
      margin: 18px 0 0;
      color: #e3ecfb;
      font-size: 16px;
      line-height: 1.34;
      text-shadow: 0 2px 10px rgba(0,0,0,.75);
    }
    .mini {
      color: #b9c7dd;
      font-size: 12px;
      line-height: 1.35;
    }
    .panel {
      border: 1px solid rgba(86, 151, 255, .35);
      background: linear-gradient(145deg, rgba(12, 30, 60, .9), rgba(3, 8, 18, .88));
      box-shadow: inset 0 1px 0 rgba(255,255,255,.06), 0 16px 45px rgba(0,0,0,.35);
      overflow: hidden;
    }
    .photo {
      position: relative;
      min-height: 112px;
      padding: 12px;
      display:flex;
      align-items:flex-end;
      overflow:hidden;
      background:
        linear-gradient(145deg, rgba(4, 7, 12, .05), rgba(4, 7, 12, .82)),
        radial-gradient(circle at 24% 26%, rgba(255,255,255,.16), transparent 10%),
        radial-gradient(circle at 72% 22%, rgba(73, 150, 255,.32), transparent 18%),
        linear-gradient(135deg, #152236, #0a1426 50%, #16294b);
    }
    .photo:before {
      content:"";
      position:absolute;
      inset: 12px 16px auto auto;
      width: 54px;
      height: 54px;
      border: 2px solid rgba(142, 185, 255, .5);
      border-radius: 50%;
      opacity:.48;
    }
    .photo:after {
      content:"";
      position:absolute;
      right: 18px;
      bottom: 18px;
      width: 82px;
      height: 14px;
      border-radius: 999px;
      background: linear-gradient(90deg, rgba(72,140,255,.75), rgba(39,213,167,.55));
      box-shadow: 0 -38px 0 rgba(255,255,255,.08), -42px -21px 0 rgba(255,255,255,.06);
      transform: rotate(-12deg);
      opacity:.7;
    }
    .photo strong {
      position:relative;
      z-index:1;
      color:#fff;
      font-size: 17px;
      line-height: 1.05;
    }
    .photo span {
      position:relative;
      z-index:1;
      display:block;
      margin-top:4px;
      color:#bed1ef;
      font-size: 10px;
      line-height: 1.25;
      max-width: 130px;
    }
    .metrics {
      display:grid;
      grid-template-columns: repeat(3, 1fr);
      border: 1px solid rgba(126,182,255,.3);
      border-radius: 14px;
      overflow:hidden;
      background: rgba(5, 12, 24, .88);
    }
    .metric {
      padding: 13px 9px;
      text-align:center;
      border-right:1px solid rgba(126,182,255,.18);
    }
    .metric:last-child { border-right:0; }
    .metric b { display:block; font-size:13px; color:#fff; margin-top:6px; }
    .metric span { display:block; margin-top:5px; color:#bccce4; font-size:11px; line-height:1.25; }
    .icon {
      width:30px;
      height:30px;
      margin:auto;
      border:1px solid rgba(74,144,255,.7);
      border-radius:999px;
      display:flex;
      align-items:center;
      justify-content:center;
      color:#65a3ff;
      font-weight:900;
      font-size:15px;
    }
  `;
}

function conceptOne() {
  const tiles = professions.slice(0, 6).map(([name, detail]) => `<div class="photo"><div><strong>${name}</strong><span>${detail}</span></div></div>`).join("");
  return `
    <html><head><style>${baseCss()}
      .hero { position:relative; min-height: 816px; border-radius: 14px; overflow:hidden; border:1px solid rgba(126,182,255,.24); }
      .mosaic { position:absolute; inset:58px 0 0; display:grid; grid-template-columns:1fr 1fr; opacity:.72; filter:saturate(.85); }
      .mosaic .photo { min-height: 132px; border:1px solid rgba(255,255,255,.06); }
      .mosaic .photo:nth-child(3) { grid-column: span 1; }
      .mosaic .photo:nth-child(6) { min-height: 180px; }
      .veil { position:absolute; inset:58px 0 0; background:linear-gradient(180deg, rgba(5,10,18,.2), rgba(5,10,18,.88) 45%, rgba(5,10,18,.95)); }
      .copy { position:absolute; left:18px; right:18px; top:168px; text-align:center; z-index:2; }
      .metrics { position:absolute; left:14px; right:14px; bottom:14px; z-index:3; }
    </style></head><body><main class="phone"><section class="hero">
      <div class="topbar"><img class="logo" src="${logoData}" /><div class="menu"><span></span><span></span><span></span></div></div>
      <div class="mosaic">${tiles}</div><div class="veil"></div>
      <div class="copy">
        <div class="pill">Reviews + Service Videos + Trust Score</div>
        <h1 style="margin-top:26px;">See local service <span class="blue">proof</span> before you <span class="blue">choose</span></h1>
        <p class="lead">Real customer reviews, verified service videos, and Trust Scores for electricians, cleaners, mechanics, barbers, landscapers, and more.</p>
      </div>
      <div class="metrics">
        <div class="metric"><div class="icon">★</div><b>Authentic</b><span>Real customer reviews</span></div>
        <div class="metric"><div class="icon">▶</div><b>Verified</b><span>Stage-by-stage service videos</span></div>
        <div class="metric"><div class="icon">✓</div><b>Trusted</b><span>Transparent Trust Scores</span></div>
      </div>
    </section></main></body></html>
  `;
}

function conceptTwo() {
  const tiles = professions.map(([name, detail]) => `<div class="photo"><div><strong>${name}</strong><span>${detail}</span></div></div>`).join("");
  return `
    <html><head><style>${baseCss()}
      .hero { min-height: 816px; border-radius: 14px; overflow:hidden; border:1px solid rgba(126,182,255,.24); background:rgba(5,10,18,.8); }
      .heroBody { padding: 18px 16px 0; }
      h1 { font-size: 44px; margin-top:20px; }
      .tradeGrid { display:grid; grid-template-columns:1fr 1fr; gap:8px; margin-top:22px; }
      .photo { min-height: 104px; border-radius:13px; border:1px solid rgba(126,182,255,.18); }
      .photo:nth-child(1), .photo:nth-child(4) { min-height: 132px; }
      .band { margin-top:14px; padding:14px; border-radius:15px; border:1px solid rgba(126,182,255,.34); background:linear-gradient(135deg, rgba(9,28,61,.95), rgba(5,10,18,.9)); }
      .chips { display:flex; gap:7px; flex-wrap:wrap; margin-top:10px; }
      .chip { padding:6px 9px; border-radius:999px; border:1px solid rgba(126,182,255,.3); color:#d9e8ff; background:rgba(255,255,255,.05); font-size:11px; font-weight:700; }
    </style></head><body><main class="phone"><section class="hero">
      <div class="topbar"><img class="logo" src="${logoData}" /><div class="menu"><span></span><span></span><span></span></div></div>
      <div class="heroBody">
        <div class="pill">For Every Local Service</div>
        <h1>Proof you can compare across <span class="blue">every trade</span></h1>
        <p class="lead">Browse real service evidence from many types of local businesses, all in one Reliance view.</p>
        <div class="tradeGrid">${tiles}</div>
        <div class="band">
          <strong style="display:block;font-size:17px;color:#fff;">One trust system. Many service categories.</strong>
          <div class="chips"><span class="chip">Home repair</span><span class="chip">Beauty</span><span class="chip">Auto</span><span class="chip">Outdoor</span><span class="chip">Cleaning</span></div>
        </div>
      </div>
    </section></main></body></html>
  `;
}

function conceptThree() {
  const chips = professions.map(([name]) => `<span class="chip">${name}</span>`).join("");
  return `
    <html><head><style>${baseCss()}
      .section { min-height: 816px; border-radius: 16px; border:1px solid rgba(126,182,255,.24); padding: 18px; background:linear-gradient(180deg, rgba(8,20,38,.92), rgba(5,10,18,.96)); }
      .sectionHeader { margin-top:18px; }
      h1 { font-size:34px; line-height:1.08; margin-top:12px; }
      .reviewCard { margin-top:22px; padding:18px; border-radius:18px; border:1px solid rgba(126,182,255,.32); background:rgba(4,10,20,.78); box-shadow:0 18px 50px rgba(0,0,0,.35); }
      .stars { color:#facc15; font-size:21px; letter-spacing:2px; }
      .quote { margin:13px 0 0; font-size:18px; line-height:1.32; color:#fff; font-weight:800; }
      .serviceLine { margin-top:12px; color:#aecaef; font-size:13px; line-height:1.45; }
      .chips { display:flex; flex-wrap:wrap; gap:8px; margin-top:22px; }
      .chip { border:1px solid rgba(126,182,255,.32); color:#dbe9ff; background:rgba(47,109,246,.11); border-radius:999px; padding:9px 11px; font-size:12px; font-weight:800; }
      .proofStrip { margin-top:24px; display:grid; grid-template-columns:repeat(3, 1fr); gap:8px; }
      .proof { min-height:92px; border-radius:14px; border:1px solid rgba(126,182,255,.22); background:linear-gradient(145deg, rgba(17,39,77,.9), rgba(5,10,18,.9)); padding:11px; }
      .proof b { display:block; color:#fff; font-size:12px; line-height:1.2; }
      .proof span { display:block; color:#aebfda; font-size:10px; line-height:1.25; margin-top:8px; }
    </style></head><body><main class="phone"><section class="section">
      <div class="topbar" style="border-radius:12px;"><img class="logo" src="${logoData}" /><div class="menu"><span></span><span></span><span></span></div></div>
      <div class="sectionHeader">
        <div class="pill">Real Customer Reviews</div>
        <h1>Reviews for the work people actually hire locally</h1>
        <p class="lead">Reliance is not just one industry. Customers can compare proof across home services, personal services, auto services, and outdoor work.</p>
      </div>
      <div class="reviewCard">
        <div class="stars">★★★★★</div>
        <p class="quote">“The before, during, and finished videos made the decision easy.”</p>
        <p class="serviceLine"><strong style="color:#fff;">Verified service:</strong> Electrical repair by Electro LLC</p>
      </div>
      <div class="chips">${chips}</div>
      <div class="proofStrip">
        <div class="proof"><b>Reviews</b><span>Customer feedback after service</span></div>
        <div class="proof"><b>Videos</b><span>Starting, progress, final result</span></div>
        <div class="proof"><b>Trust Score</b><span>Signals customers can compare</span></div>
      </div>
    </section></main></body></html>
  `;
}

function conceptFour() {
  return `
    <html><head><style>${baseCss()}
      .page { min-height: 980px; border-radius:14px; overflow:hidden; border:1px solid rgba(126,182,255,.24); background:#050a12; }
      .hero { position:relative; min-height: 520px; padding:18px; background:
        radial-gradient(circle at 82% 20%, rgba(47,109,246,.35), transparent 32%),
        linear-gradient(180deg, rgba(5,10,18,.25), rgba(5,10,18,.95)),
        linear-gradient(rgba(37, 99, 235, .08) 1px, transparent 1px),
        linear-gradient(90deg, rgba(37, 99, 235, .08) 1px, transparent 1px);
        background-size:auto, auto, 32px 32px, 32px 32px;
      }
      .hero .topbar { margin:-4px -4px 0; border-radius:12px; }
      h1 { margin-top:72px; font-size:43px; }
      .industryRail { display:flex; gap:8px; overflow:hidden; margin-top:22px; }
      .railItem { min-width:112px; min-height:74px; border-radius:14px; border:1px solid rgba(126,182,255,.28); background:linear-gradient(145deg, rgba(17,39,77,.92), rgba(5,10,18,.92)); padding:12px; }
      .railItem b { color:#fff; font-size:13px; }
      .railItem span { display:block; color:#aebfda; font-size:10px; margin-top:7px; line-height:1.25; }
      .reviews { padding:18px; border-top:1px solid rgba(126,182,255,.16); background:linear-gradient(180deg, #071426, #050a12); }
      .reviews h2 { margin:12px 0 0; font-size:27px; line-height:1.1; color:#fff; }
      .reviewGrid { margin-top:16px; display:grid; gap:10px; }
      .card { border:1px solid rgba(126,182,255,.24); border-radius:16px; background:rgba(255,255,255,.04); padding:14px; }
      .card strong { color:#fff; font-size:15px; }
      .card p { margin:6px 0 0; color:#b8c8df; font-size:12px; line-height:1.35; }
    </style></head><body><main class="phone"><div class="page">
      <section class="hero">
        <div class="topbar"><img class="logo" src="${logoData}" /><div class="menu"><span></span><span></span><span></span></div></div>
        <div class="pill" style="margin-top:26px;">Reviews + Service Videos + Trust Score</div>
        <h1>See local service proof before you <span class="blue">choose</span></h1>
        <p class="lead">Compare completed work from the service categories people use every day.</p>
        <div class="industryRail">
          <div class="railItem"><b>Electrical</b><span>Repair proof and finished work</span></div>
          <div class="railItem"><b>Cleaning</b><span>Before and after service records</span></div>
          <div class="railItem"><b>Auto</b><span>Diagnostics and completed repairs</span></div>
          <div class="railItem"><b>Lawn</b><span>Outdoor progress and results</span></div>
        </div>
      </section>
      <section class="reviews">
        <div class="pill">Real Customer Reviews</div>
        <h2>Trusted feedback across many local businesses</h2>
        <div class="reviewGrid">
          <div class="card"><strong>Home services</strong><p>Electrical, plumbing, HVAC, appliance repair, flooring, painting.</p></div>
          <div class="card"><strong>Personal services</strong><p>Barbers, stylists, beauty, wellness, mobile appointments.</p></div>
          <div class="card"><strong>Mobile and outdoor work</strong><p>Auto, detailing, lawn care, cleaning, maintenance, and more.</p></div>
        </div>
      </section>
    </div></main></body></html>
  `;
}

async function render(name, html) {
  const browser = await chromium.launch({ headless: true });
  const page = await browser.newPage({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 2 });
  await page.setContent(html, { waitUntil: "load" });
  const filePath = path.join(outDir, name);
  await page.screenshot({ path: filePath, fullPage: true });
  await browser.close();
  console.log(filePath);
}

(async () => {
  await render("01-mosaic-hero.png", conceptOne());
  await render("02-trade-grid-hero.png", conceptTwo());
  await render("03-reviews-multitude-section.png", conceptThree());
  await render("04-combined-homepage-direction.png", conceptFour());
})();
