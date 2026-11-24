import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import vm from 'node:vm';
import zlib from 'node:zlib';

const ROOT_DIR = path.resolve(import.meta.dirname, '..');
const WORKER_PATH = path.join(ROOT_DIR, 'dist', 'arvan-edge-worker.js');
const STATIC_DIR = path.join(ROOT_DIR, 'dist-arvan');

async function loadWorkerHandler(workerCode) {
  let fetchListener = null;

  const sandbox = {
    console,
    URL,
    Headers,
    Request,
    Response,
    Blob,
    TextEncoder,
    TextDecoder,
    DecompressionStream,
    ReadableStream,
    atob: (b64) => Buffer.from(b64, 'base64').toString('binary'),
    btoa: (str) => Buffer.from(str, 'binary').toString('base64'),
    Map,
    Set,
    Uint8Array,
    addEventListener(type, listener) {
      if (type === 'fetch') {
        fetchListener = listener;
      }
    },
  };

  vm.createContext(sandbox);
  vm.runInContext(workerCode, sandbox, { filename: 'dist/arvan-edge-worker.js' });

  assert.equal(typeof fetchListener, 'function', 'Worker must register a fetch event listener');

  return async function dispatch(url, init = {}) {
    const req = new Request(url, init);
    let responsePromise = null;
    const event = {
      request: req,
      respondWith(p) {
        responsePromise = Promise.resolve(p);
      },
      waitUntil() {},
    };
    fetchListener(event);
    assert.ok(responsePromise, `Worker did not call event.respondWith for ${url}`);
    return await responsePromise;
  };
}

async function main() {
  assert.ok(fs.existsSync(WORKER_PATH), 'dist/arvan-edge-worker.js does not exist');
  assert.ok(fs.existsSync(path.join(STATIC_DIR, 'index.html')), 'dist-arvan/index.html does not exist');

  const workerCode = fs.readFileSync(WORKER_PATH, 'utf8');
  assert.equal(
    workerCode.includes('raw.githubusercontent.com'),
    false,
    'Worker bundle must not depend on raw.githubusercontent.com'
  );

  const dispatch = await loadWorkerHandler(workerCode);
  const origin = 'https://jazireh-bagha.mahdihatami2024-wzzyv.arvanedge.ir';

  // 1. Health check
  const healthRes = await dispatch(`${origin}/healthz`);
  assert.equal(healthRes.status, 200);
  const healthJson = await healthRes.json();
  assert.equal(healthJson.ok, true);
  assert.equal(healthJson.mode, 'self-contained-edge');
  assert.ok(healthJson.assets >= 4, 'Expected at least 4 embedded game assets');

  // 2. Main page GET + HEAD + CSP check
  const htmlRes = await dispatch(`${origin}/`);
  assert.equal(htmlRes.status, 200);
  assert.match(htmlRes.headers.get('content-type') || '', /^text\/html/i);
  assert.equal(htmlRes.headers.get('content-security-policy'), null, 'Must not forward GitHub sandbox CSP');
  assert.equal(htmlRes.headers.get('x-frame-options'), null, 'Must not forward GitHub X-Frame-Options deny');
  const html = await htmlRes.text();
  assert.ok(html.includes('<div id="root"></div>'), 'HTML must contain React root mount');

  const headRes = await dispatch(`${origin}/`, { method: 'HEAD' });
  assert.equal(headRes.status, 200);
  assert.equal((await headRes.text()).length, 0, 'HEAD response must have empty body');

  // 3. SPA route fallback
  const spaRes = await dispatch(`${origin}/daily/challenge`);
  assert.equal(spaRes.status, 200);
  assert.match(spaRes.headers.get('content-type') || '', /^text\/html/i);

  // 4. All referenced JS & CSS assets (both gzip & uncompressed clients, plus HEAD)
  const refs = [...html.matchAll(/(?:src|href)=["'](\/assets\/[^"']+)["']/g)].map((m) => m[1]);
  assert.ok(refs.length >= 2, 'HTML must reference built JS and CSS assets');

  for (const ref of refs) {
    const gzRes = await dispatch(`${origin}${ref}`, {
      headers: { 'Accept-Encoding': 'gzip, deflate, br' },
    });
    assert.equal(gzRes.status, 200, `Expected 200 for ${ref}`);
    if (ref.endsWith('.js')) {
      assert.match(gzRes.headers.get('content-type') || '', /^text\/javascript/i);
    } else if (ref.endsWith('.css')) {
      assert.match(gzRes.headers.get('content-type') || '', /^text\/css/i);
    }
    const gzBuf = Buffer.from(await gzRes.arrayBuffer());
    const plainFromGz = zlib.gunzipSync(gzBuf).toString('utf8');
    assert.ok(plainFromGz.length > 100, `Asset ${ref} decompressed content too small`);

    const plainRes = await dispatch(`${origin}${ref}`);
    assert.equal(plainRes.status, 200);
    const plainText = await plainRes.text();
    assert.equal(plainText, plainFromGz, `Non-gzip fallback for ${ref} must match gzipped asset`);

    const assetHead = await dispatch(`${origin}${ref}`, { method: 'HEAD' });
    assert.equal(assetHead.status, 200);
    assert.equal((await assetHead.arrayBuffer()).byteLength, 0);
  }

  // 5. Missing assets return real 404 (never HTML fallback)
  const missingJs = await dispatch(`${origin}/assets/does-not-exist.js`);
  assert.equal(missingJs.status, 404);
  const missingImg = await dispatch(`${origin}/missing.png`);
  assert.equal(missingImg.status, 404);

  // 6. Byte-Range request support
  const rangeRes = await dispatch(`${origin}/index.html`, {
    headers: { Range: 'bytes=0-63' },
  });
  assert.equal(rangeRes.status, 206);
  assert.match(rangeRes.headers.get('content-range') || '', /^bytes 0-63\/\d+$/);
  const rangeBuf = await rangeRes.arrayBuffer();
  assert.equal(rangeBuf.byteLength, 64);

  const badRange = await dispatch(`${origin}/index.html`, {
    headers: { Range: 'bytes=999999-1000005' },
  });
  assert.equal(badRange.status, 416);

  // 7. Unsupported method returns 405
  const postRes = await dispatch(`${origin}/`, { method: 'POST' });
  assert.equal(postRes.status, 405);

  console.log(`Verified Arvan Edge bundle (${refs.length} referenced assets + routing + Range + HEAD + MIME + CSP).`);
}

main();
