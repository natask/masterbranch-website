import http from "node:http";
import { URL } from "node:url";

const PORT = Number(process.env.VIEWPORT_LAB_PORT ?? 3100);
const TARGET = new URL(process.env.VIEWPORT_LAB_TARGET ?? "http://localhost:3000");

const viewports = [
  ["iPhone SE", 375, 812],
  ["Android", 412, 915],
  ["iPhone Max", 430, 932],
  ["Tablet P", 768, 1024],
  ["Tablet L", 1024, 768],
  ["Laptop 13", 1280, 900],
  ["Laptop 14", 1440, 1000],
  ["Laptop 16", 1536, 960],
  ["Desktop", 1920, 1080],
];

function labHtml() {
  const cards = viewports.map(([label, width, height]) => `
    <section class="card" data-width="${width}" data-height="${height}">
      <header><span>${label}</span><code>${width}x${height}</code></header>
      <div class="frame-wrap">
        <div class="scaled-frame">
          <iframe title="${label} ${width}" src="/?viewportFrame=1"></iframe>
        </div>
      </div>
    </section>
  `).join("");

  return `<!doctype html>
    <html lang="en">
      <head>
        <meta charset="utf-8" />
        <meta name="viewport" content="width=device-width, initial-scale=1" />
        <title>Masterbranch Viewport Lab</title>
        <style>
          * { box-sizing: border-box; }
          body {
            margin: 0;
            background: #07060a;
            color: rgba(255, 255, 255, 0.78);
            font-family: Georgia, "Times New Roman", serif;
          }
          .bar {
            position: sticky;
            top: 0;
            z-index: 10;
            display: flex;
            flex-wrap: wrap;
            align-items: center;
            justify-content: space-between;
            gap: 16px;
            padding: 20px 24px;
            border-bottom: 1px solid rgba(255, 255, 255, 0.1);
            background: rgba(7, 6, 10, 0.96);
            backdrop-filter: blur(16px);
          }
          h1 {
            margin: 0;
            font-size: 18px;
            font-weight: 500;
            letter-spacing: 0.22em;
            text-transform: uppercase;
          }
          p {
            margin: 6px 0 0;
            color: rgba(255, 255, 255, 0.42);
            font-size: 15px;
          }
          button, a {
            border: 1px solid rgba(255, 255, 255, 0.14);
            border-radius: 6px;
            background: transparent;
            color: rgba(255, 255, 255, 0.68);
            cursor: pointer;
            font: 600 11px/1 system-ui, sans-serif;
            letter-spacing: 0.12em;
            padding: 11px 14px;
            text-decoration: none;
            text-transform: uppercase;
          }
          .actions {
            display: flex;
            gap: 8px;
          }
          .control {
            padding: 18px 24px 0;
          }
          .control .card {
            max-width: none;
          }
          .grid {
            display: grid;
            grid-template-columns: repeat(auto-fit, minmax(420px, 1fr));
            gap: 18px;
            padding: 18px 24px 24px;
          }
          .card {
            overflow: hidden;
            border: 1px solid rgba(255, 255, 255, 0.1);
            border-radius: 8px;
            background: rgba(255, 255, 255, 0.025);
          }
          header {
            display: flex;
            justify-content: space-between;
            gap: 12px;
            padding: 10px 14px;
            border-bottom: 1px solid rgba(255, 255, 255, 0.1);
            color: rgba(255, 255, 255, 0.52);
            font: 600 11px/1 system-ui, sans-serif;
            letter-spacing: 0.14em;
            text-transform: uppercase;
          }
          code {
            color: rgba(201, 165, 92, 0.78);
            font-family: ui-monospace, SFMono-Regular, Menlo, monospace;
            letter-spacing: 0;
          }
          .frame-wrap {
            position: relative;
            overflow: hidden;
            background: #07060a;
          }
          .scaled-frame {
            position: relative;
            margin: 0 auto;
          }
          iframe {
            position: absolute;
            left: 0;
            top: 0;
            border: 0;
            background: #07060a;
          }
          @media (max-width: 700px) {
            .grid { grid-template-columns: 1fr; padding-inline: 12px; }
            .bar, .control { padding-inline: 12px; }
          }
        </style>
      </head>
      <body>
        <div class="bar">
          <div>
            <h1>Viewport Lab</h1>
            <p>Use the Aa configurator in the control frame; all previews update together.</p>
          </div>
          <div class="actions">
            <a href="${TARGET.href}" target="_blank" rel="noreferrer">Open App</a>
            <button type="button" id="reload">Reload Frames</button>
          </div>
        </div>
        <main>
          <div class="control">
            <section class="card" data-width="1440" data-height="900">
              <header><span>Control Frame</span><code>1440x900</code></header>
              <div class="frame-wrap">
                <div class="scaled-frame">
                  <iframe title="Control frame" src="/"></iframe>
                </div>
              </div>
            </section>
          </div>
          <div class="grid">${cards}</div>
        </main>
        <script>
          const minScale = 0.18;
          function fit() {
            for (const card of document.querySelectorAll(".card")) {
              const width = Number(card.dataset.width);
              const height = Number(card.dataset.height);
              const wrap = card.querySelector(".frame-wrap");
              const holder = card.querySelector(".scaled-frame");
              const frame = card.querySelector("iframe");
              const available = Math.max(120, card.clientWidth - 24);
              const scale = Math.max(minScale, Math.min(1, available / width));
              wrap.style.height = Math.ceil(height * scale) + "px";
              holder.style.width = Math.ceil(width * scale) + "px";
              holder.style.height = Math.ceil(height * scale) + "px";
              frame.style.width = width + "px";
              frame.style.height = height + "px";
              frame.style.transform = "scale(" + scale + ")";
              frame.style.transformOrigin = "top left";
            }
          }
          window.addEventListener("resize", fit);
          window.addEventListener("load", fit);
          new ResizeObserver(fit).observe(document.body);
          document.getElementById("reload").addEventListener("click", () => {
            for (const frame of document.querySelectorAll("iframe")) {
              const url = new URL(frame.getAttribute("src"), location.href);
              url.searchParams.set("lab", Date.now().toString());
              frame.src = url.pathname + url.search;
            }
          });
        </script>
      </body>
    </html>`;
}

function proxyRequest(req, res) {
  const targetUrl = new URL(req.url ?? "/", TARGET);
  const headers = { ...req.headers, host: TARGET.host };

  const proxy = http.request(
    targetUrl,
    {
      method: req.method,
      headers,
    },
    (proxyRes) => {
      res.writeHead(proxyRes.statusCode ?? 500, proxyRes.headers);
      proxyRes.pipe(res);
    },
  );

  proxy.on("error", () => {
    res.writeHead(502, { "content-type": "text/plain; charset=utf-8" });
    res.end(`Could not proxy ${TARGET.href}. Is the Next dev server running?`);
  });

  req.pipe(proxy);
}

const server = http.createServer((req, res) => {
  const url = new URL(req.url ?? "/", `http://localhost:${PORT}`);

  if (url.pathname === "/__viewport-lab" || url.pathname === "/viewport-lab") {
    res.writeHead(200, { "content-type": "text/html; charset=utf-8" });
    res.end(labHtml());
    return;
  }

  proxyRequest(req, res);
});

server.listen(PORT, () => {
  console.log(`Viewport lab: http://localhost:${PORT}/__viewport-lab`);
  console.log(`Proxy target: ${TARGET.href}`);
});
