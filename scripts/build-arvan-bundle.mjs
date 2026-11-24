import fs from 'node:fs';
import path from 'node:path';
import zlib from 'node:zlib';

const ROOT_DIR = path.resolve(import.meta.dirname, '..');
const DIST_DIR = path.join(ROOT_DIR, 'dist');
const DIST_ARVAN_DIR = path.join(ROOT_DIR, 'dist-arvan');
const WORKER_TEMPLATE_PATH = path.join(ROOT_DIR, 'arvan-edge-worker.js');
const WORKER_OUT_PATH = path.join(DIST_DIR, 'arvan-edge-worker.js');
const MAX_SAFE_BUNDLE_BYTES = 1024 * 1024; // 1 MiB safe limit for fast cold-start & API acceptance
const HARD_MAX_BUNDLE_BYTES = 2 * 1024 * 1024;

const MIME_TYPES = {
  html: 'text/html; charset=utf-8',
  js: 'text/javascript; charset=utf-8',
  mjs: 'text/javascript; charset=utf-8',
  css: 'text/css; charset=utf-8',
  json: 'application/json; charset=utf-8',
  png: 'image/png',
  jpg: 'image/jpeg',
  jpeg: 'image/jpeg',
  webp: 'image/webp',
  svg: 'image/svg+xml',
  mp4: 'video/mp4',
  webm: 'video/webm',
  ico: 'image/x-icon',
  woff: 'font/woff',
  woff2: 'font/woff2',
  ttf: 'font/ttf',
};

function mimeFor(filePath) {
  const ext = path.extname(filePath).slice(1).toLowerCase();
  return MIME_TYPES[ext] || 'application/octet-stream';
}

function collectFiles(dir, baseDir = dir, out = []) {
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, entry.name);
    const rel = path.relative(baseDir, full).replace(/\\/g, '/');

    // Exclude unreferenced AI Studio chat attachments (video/screenshots) and any previously built worker
    if (rel === 'assets/aistudio' || rel.startsWith('assets/aistudio/') || rel === 'arvan-edge-worker.js') {
      continue;
    }

    if (entry.isDirectory()) {
      collectFiles(full, baseDir, out);
    } else if (entry.isFile()) {
      out.push({ full, rel });
    }
  }
  return out;
}

function main() {
  if (!fs.existsSync(path.join(DIST_DIR, 'index.html'))) {
    throw new Error('dist/index.html not found. Run `npm run build` before `npm run build:arvan`.');
  }

  const template = fs.readFileSync(WORKER_TEMPLATE_PATH, 'utf8');
  const marker = '/* __ARVAN_EMBEDDED_ASSETS__ */ null';
  if (!template.includes(marker)) {
    throw new Error('arvan-edge-worker.js is missing the /* __ARVAN_EMBEDDED_ASSETS__ */ marker.');
  }

  const files = collectFiles(DIST_DIR);

  // Prepare clean static directory (dist-arvan) without unused AI Studio media files
  fs.rmSync(DIST_ARVAN_DIR, { recursive: true, force: true });
  fs.mkdirSync(DIST_ARVAN_DIR, { recursive: true });
  // Ensure GitHub Pages / static hosts don't filter files if published to arvan-static
  fs.writeFileSync(path.join(DIST_ARVAN_DIR, '.nojekyll'), '');

  const embedded = {};
  let rawHtml = '';

  for (const file of files) {
    const routePath = '/' + file.rel;
    const outStaticPath = path.join(DIST_ARVAN_DIR, file.rel);
    fs.mkdirSync(path.dirname(outStaticPath), { recursive: true });

    if (routePath === '/index.html') {
      rawHtml = fs.readFileSync(file.full, 'utf8');
      // Normalize relative ./assets/ links to root-relative /assets/ for Edge & SPA routes
      const edgeHtml = rawHtml
        .replace(/(["'])\.\/assets\//g, '$1/assets/')
        .replace(/\r?\n\s*/g, '\n')
        .trim();

      fs.writeFileSync(outStaticPath, edgeHtml, 'utf8');
      embedded['/index.html'] = {
        type: 'text/html; charset=utf-8',
        text: edgeHtml,
      };
      continue;
    }

    const buf = fs.readFileSync(file.full);
    fs.writeFileSync(outStaticPath, buf);

    const ext = path.extname(file.rel).slice(1).toLowerCase();
    const shouldGzip = ['js', 'mjs', 'css', 'svg', 'json', 'txt'].includes(ext);

    if (shouldGzip) {
      const gz = zlib.gzipSync(buf, { level: 9 });
      embedded[routePath] = {
        type: mimeFor(file.rel),
        gzip: true,
        b64: gz.toString('base64'),
      };
    } else {
      embedded[routePath] = {
        type: mimeFor(file.rel),
        gzip: false,
        b64: buf.toString('base64'),
      };
    }
  }

  // Verify every script/stylesheet referenced in /index.html exists in embedded assets
  const edgeHtmlText = embedded['/index.html']?.text || '';
  const assetRefs = [...edgeHtmlText.matchAll(/(?:src|href)=["'](\/assets\/[^"']+)["']/g)].map((m) => m[1]);
  if (assetRefs.length === 0) {
    throw new Error('No /assets/ script or stylesheet references found in dist/index.html.');
  }
  for (const ref of assetRefs) {
    if (!embedded[ref]) {
      throw new Error(`Referenced asset ${ref} in index.html is missing from embedded Arvan assets.`);
    }
  }

  const serializedAssets = JSON.stringify(embedded);
  const workerBundle = template.replace(marker, serializedAssets);

  if (workerBundle.includes('raw.githubusercontent.com')) {
    throw new Error('Arvan worker bundle must not reference raw.githubusercontent.com.');
  }

  fs.writeFileSync(WORKER_OUT_PATH, workerBundle, 'utf8');

  const bundleBytes = Buffer.byteLength(workerBundle, 'utf8');
  const bundleKiB = (bundleBytes / 1024).toFixed(1);
  console.log(`Built Arvan Edge bundle: dist/arvan-edge-worker.js (${bundleKiB} KiB, ${Object.keys(embedded).length} assets)`);
  for (const [k, v] of Object.entries(embedded)) {
    const payloadSize = v.text ? Buffer.byteLength(v.text, 'utf8') : v.b64.length;
    console.log(`  - ${k} (${v.type}, ${v.gzip ? 'gzip+b64' : v.text ? 'utf8' : 'raw+b64'}, ${(payloadSize / 1024).toFixed(1)} KiB)`);
  }

  if (bundleBytes > HARD_MAX_BUNDLE_BYTES) {
    throw new Error(`Bundle size ${bundleKiB} KiB exceeds hard limit (${HARD_MAX_BUNDLE_BYTES / 1024} KiB).`);
  }
  if (bundleBytes > MAX_SAFE_BUNDLE_BYTES) {
    console.warn(`WARNING: Bundle size ${bundleKiB} KiB exceeds 1 MiB safe threshold.`);
  }
}

main();
