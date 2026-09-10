/* Full-page captures of our own sites for the hero showcase — the laptop
   (desktop pages) and the phone (mobile pages).

     node tools/showcase-capture.js              both, every project
     node tools/showcase-capture.js desktop      laptop captures only
     node tools/showcase-capture.js mobile jemonty    one project, phone only

   The project list is read out of SHOWCASE in js/main.js, so adding a project
   there and running this is the whole job. Writes img/showcase/<slug>.webp and
   <slug>-m.webp; review previews go to the system temp folder.

   Headless Chrome, driven over the DevTools protocol directly (Node 22+ has a
   global WebSocket), so nothing needs installing beyond the repo's own sharp.
   Each page is walked top to bottom first, so lazy images and scroll-reveal
   animations have fired, then captured beyond the viewport — which keeps the
   viewport at its real height, so 100vh sections do not stretch to the page.
   Set CHROME=<path> if Chrome is not in its default Windows location. */
const { spawn } = require("child_process");
const fs = require("fs");
const os = require("os");
const path = require("path");
const sharp = require("sharp");

const ROOT = path.join(__dirname, "..");
const OUT = path.join(ROOT, "img", "showcase");
const TMP = path.join(os.tmpdir(), "slv-showcase");
const CHROME = process.env.CHROME || "C:/Program Files/Google/Chrome/Application/chrome.exe";

const MODES = {
  // laptop: the desktop page. 7000px is more than a laptop screen ever reaches.
  desktop: { suffix: "", w: 1440, h: 900, dpr: 1, mobile: false, maxH: 7000, shipW: 880, step: 420 },
  // phone: the mobile page, as an iPhone, so UA-sniffing sites serve their
  // phone layout rather than a squeezed desktop one
  mobile: {
    suffix: "-m", w: 390, h: 844, dpr: 2, mobile: true, maxH: 6000, shipW: 480, step: 380,
    ua: "Mozilla/5.0 (iPhone; CPU iPhone OS 17_5 like Mac OS X) AppleWebKit/605.1.15 " +
        "(KHTML, like Gecko) Version/17.5 Mobile/15E148 Safari/604.1",
  },
};
const QUALITY = 62;
const PORT = 9335;

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

function projects() {
  const src = fs.readFileSync(path.join(ROOT, "js", "main.js"), "utf8");
  const block = src.slice(src.indexOf("const SHOWCASE = ["), src.indexOf("];", src.indexOf("const SHOWCASE = [")));
  const out = [];
  const re = /slug:\s*"([^"]+)"[^}]*?url:\s*"([^"]+)"/g;
  let m;
  while ((m = re.exec(block))) out.push({ slug: m[1], url: m[2] });
  if (!out.length) throw new Error("no SHOWCASE entries found in js/main.js");
  return out;
}

async function captureOne(port, mode, p) {
  const target = await (await fetch(`http://127.0.0.1:${port}/json/new?about:blank`, { method: "PUT" })).json();
  const ws = new WebSocket(target.webSocketDebuggerUrl);
  await new Promise((res, rej) => { ws.onopen = res; ws.onerror = rej; });

  let seq = 0;
  const pending = new Map();
  const events = [];
  ws.onmessage = (msg) => {
    const d = JSON.parse(msg.data);
    if (d.id && pending.has(d.id)) { pending.get(d.id)(d); pending.delete(d.id); }
    else if (d.method) events.push(d.method);
  };
  const send = (method, params = {}) => new Promise((res) => {
    const id = ++seq; pending.set(id, res);
    ws.send(JSON.stringify({ id, method, params }));
  });
  const run = async (expr) => {
    const r = await send("Runtime.evaluate", { expression: expr, awaitPromise: true, returnByValue: true });
    return r.result && r.result.result ? r.result.result.value : undefined;
  };

  await send("Page.enable");
  if (mode.ua) await send("Emulation.setUserAgentOverride", { userAgent: mode.ua, platform: "iPhone" });
  await send("Emulation.setDeviceMetricsOverride", {
    width: mode.w, height: mode.h, deviceScaleFactor: mode.dpr, mobile: mode.mobile,
  });
  if (mode.mobile) await send("Emulation.setTouchEmulationEnabled", { enabled: true, maxTouchPoints: 5 });
  await send("Page.navigate", { url: p.url });
  for (let i = 0; i < 150 && events.indexOf("Page.loadEventFired") === -1; i++) await sleep(200);
  await sleep(2500);

  const full = await run(`(async () => {
    const s = (ms) => new Promise((r) => setTimeout(r, ms));
    const h = () => Math.max(document.documentElement.scrollHeight, document.body ? document.body.scrollHeight : 0);
    for (let y = 0; y < Math.min(h(), ${mode.maxH}); y += ${mode.step}) { window.scrollTo(0, y); await s(260); }
    window.scrollTo(0, 0); await s(1400);
    return h();
  })()`);

  const height = Math.min(full || mode.h, mode.maxH);
  const shot = await send("Page.captureScreenshot", {
    format: "png", captureBeyondViewport: true,
    clip: { x: 0, y: 0, width: mode.w, height, scale: 1 },
  });
  const png = Buffer.from(shot.result.data, "base64");

  const name = p.slug + mode.suffix;
  const webp = path.join(OUT, name + ".webp");
  await sharp(png).resize({ width: mode.shipW }).webp({ quality: QUALITY, effort: 6 }).toFile(webp);
  await sharp(png).resize({ width: 240 }).jpeg({ quality: 70 }).toFile(path.join(TMP, "preview-" + name + ".jpg"));
  const meta = await sharp(webp).metadata();
  console.log(
    name.padEnd(22), "page", String(full).padStart(5), "px",
    "| captured", String(height).padStart(5),
    "| shipped", meta.width + "x" + meta.height,
    (fs.statSync(webp).size / 1024).toFixed(0).padStart(5) + " KB"
  );

  ws.close();
  await fetch(`http://127.0.0.1:${port}/json/close/${target.id}`).catch(() => {});
}

(async () => {
  const args = process.argv.slice(2);
  const modeArg = args[0] && MODES[args[0]] ? args.shift() : "all";
  const only = args;
  const modes = modeArg === "all" ? ["desktop", "mobile"] : [modeArg];
  const list = projects().filter((p) => !only.length || only.indexOf(p.slug) !== -1);
  if (!list.length) throw new Error("no matching project: " + only.join(", "));

  fs.mkdirSync(OUT, { recursive: true });
  fs.mkdirSync(TMP, { recursive: true });

  const chrome = spawn(CHROME, [
    "--headless=new", `--remote-debugging-port=${PORT}`,
    `--user-data-dir=${path.join(TMP, "chrome-profile")}`,
    "--hide-scrollbars", "--mute-audio", "--no-first-run", "--no-default-browser-check",
    "about:blank",
  ], { stdio: "ignore" });

  try {
    let up = false;
    for (let i = 0; i < 60 && !up; i++) {
      try { await fetch(`http://127.0.0.1:${PORT}/json/version`); up = true; } catch { await sleep(250); }
    }
    if (!up) throw new Error("Chrome DevTools endpoint never came up — is CHROME right?");

    for (const m of modes) for (const p of list) await captureOne(PORT, MODES[m], p);
    console.log("\npreviews for review:", TMP);
  } finally {
    chrome.kill();
  }
})().catch((e) => { console.error("CAPTURE FAILED:", e.message || e); process.exit(1); });
