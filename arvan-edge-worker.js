// ArvanCloud Edge Computing Worker for "جزیره بقا" (jazireh-bagha)
// Serves the self-contained Vite + React + Three.js production build directly from Edge memory
// without external GitHub Raw dependencies, avoiding 504 timeouts and CSP sandbox blocks.

const EMBEDDED_ASSETS = /* __ARVAN_EMBEDDED_ASSETS__ */ null;

const DECODED_CACHE = new Map();

function cleanPath(pathname) {
  let decoded;
  try {
    decoded = decodeURIComponent(pathname);
  } catch {
    return null;
  }

  if (decoded.includes("\\") || decoded.includes("\0")) return null;

  const parts = decoded.split("/");
  if (parts.some((part) => part === "." || part === "..")) return null;

  const normalized = "/" + parts.filter(Boolean).join("/");
  return normalized === "/" ? "/index.html" : normalized;
}

function contentTypeFor(path) {
  const ext = path.split(".").pop().toLowerCase();
  const types = {
    html: "text/html; charset=utf-8",
    js: "text/javascript; charset=utf-8",
    mjs: "text/javascript; charset=utf-8",
    css: "text/css; charset=utf-8",
    json: "application/json; charset=utf-8",
    png: "image/png",
    jpg: "image/jpeg",
    jpeg: "image/jpeg",
    webp: "image/webp",
    svg: "image/svg+xml",
    mp4: "video/mp4",
    webm: "video/webm",
    ico: "image/x-icon",
    woff: "font/woff",
    woff2: "font/woff2",
    ttf: "font/ttf",
  };
  return types[ext] || "application/octet-stream";
}

function decodeBase64ToUint8Array(b64) {
  const bin = atob(b64);
  const len = bin.length;
  const out = new Uint8Array(len);
  for (let i = 0; i < len; i += 1) {
    out[i] = bin.charCodeAt(i);
  }
  return out;
}

function getBinaryAssetBytes(path, entry) {
  let cached = DECODED_CACHE.get(path);
  if (!cached) {
    cached = decodeBase64ToUint8Array(entry.b64);
    DECODED_CACHE.set(path, cached);
  }
  return cached;
}

function parseByteRange(rangeHeader, totalLength) {
  if (!rangeHeader || !/^bytes=/i.test(rangeHeader)) return null;
  const spec = rangeHeader.replace(/^bytes=/i, "").split(",")[0].trim();
  const dashIdx = spec.indexOf("-");
  if (dashIdx === -1) return null;

  const startStr = spec.slice(0, dashIdx).trim();
  const endStr = spec.slice(dashIdx + 1).trim();

  let start;
  let end;
  if (startStr === "") {
    const suffixLen = Number.parseInt(endStr, 10);
    if (!Number.isFinite(suffixLen) || suffixLen <= 0) return { invalid: true };
    start = Math.max(0, totalLength - suffixLen);
    end = totalLength - 1;
  } else {
    start = Number.parseInt(startStr, 10);
    end = endStr === "" ? totalLength - 1 : Number.parseInt(endStr, 10);
    if (!Number.isFinite(start) || !Number.isFinite(end) || start < 0 || start > end || start >= totalLength) {
      return { invalid: true };
    }
    end = Math.min(end, totalLength - 1);
  }
  return { start, end };
}

function buildAssetHeaders(path, entry) {
  const headers = new Headers();
  headers.set("content-type", entry.type || contentTypeFor(path));
  headers.set(
    "cache-control",
    path === "/index.html" ? "public, max-age=60" : "public, max-age=31536000, immutable"
  );
  headers.set("x-content-type-options", "nosniff");
  headers.set("cross-origin-resource-policy", "same-origin");
  headers.set("accept-ranges", "bytes");
  return headers;
}

async function serveEmbeddedAsset(path, entry, request) {
  const isHead = request.method === "HEAD";
  const headers = buildAssetHeaders(path, entry);

  // Plain UTF-8 text asset (e.g. index.html)
  if (typeof entry.text === "string") {
    const bytes = new TextEncoder().encode(entry.text);
    const rangeHeader = request.headers.get("range");
    if (rangeHeader) {
      const parsed = parseByteRange(rangeHeader, bytes.byteLength);
      if (parsed && parsed.invalid) {
        headers.set("content-range", "bytes */" + bytes.byteLength);
        return new Response(null, { status: 416, headers });
      }
      if (parsed) {
        const slice = bytes.subarray(parsed.start, parsed.end + 1);
        headers.set("content-range", "bytes " + parsed.start + "-" + parsed.end + "/" + bytes.byteLength);
        headers.set("content-length", String(slice.byteLength));
        return new Response(isHead ? null : slice, { status: 206, headers });
      }
    }
    headers.set("content-length", String(bytes.byteLength));
    return new Response(isHead ? null : bytes, { status: 200, headers });
  }

  const rawBytes = getBinaryAssetBytes(path, entry);

  // Gzip-compressed asset: serve compressed directly when client accepts gzip (all modern browsers),
  // or decompress cleanly on-the-fly for non-gzip HTTP clients if DecompressionStream is available.
  if (entry.gzip) {
    const acceptsGzip = /\bgzip\b/i.test(request.headers.get("accept-encoding") || "");
    headers.set("vary", "Accept-Encoding");

    if (acceptsGzip || isHead) {
      headers.set("content-encoding", "gzip");
      headers.set("content-length", String(rawBytes.byteLength));
      return new Response(isHead ? null : rawBytes, { status: 200, headers });
    }

    if (typeof DecompressionStream === "function") {
      const decompressedStream = new Blob([rawBytes])
        .stream()
        .pipeThrough(new DecompressionStream("gzip"));
      return new Response(decompressedStream, { status: 200, headers });
    }

    headers.set("content-encoding", "gzip");
    headers.set("content-length", String(rawBytes.byteLength));
    return new Response(rawBytes, { status: 200, headers });
  }

  // Uncompressed binary asset (supports HTTP Range requests for video/audio/images)
  const rangeHeader = request.headers.get("range");
  if (rangeHeader) {
    const parsed = parseByteRange(rangeHeader, rawBytes.byteLength);
    if (parsed && parsed.invalid) {
      headers.set("content-range", "bytes */" + rawBytes.byteLength);
      return new Response(null, { status: 416, headers });
    }
    if (parsed) {
      const slice = rawBytes.subarray(parsed.start, parsed.end + 1);
      headers.set("content-range", "bytes " + parsed.start + "-" + parsed.end + "/" + rawBytes.byteLength);
      headers.set("content-length", String(slice.byteLength));
      return new Response(isHead ? null : slice, { status: 206, headers });
    }
  }

  headers.set("content-length", String(rawBytes.byteLength));
  return new Response(isHead ? null : rawBytes, { status: 200, headers });
}

async function handleRequest(request) {
  if (request.method !== "GET" && request.method !== "HEAD") {
    return new Response("Method Not Allowed", {
      status: 405,
      headers: { Allow: "GET, HEAD", "content-type": "text/plain; charset=utf-8" },
    });
  }

  const url = new URL(request.url);
  const path = cleanPath(url.pathname);
  if (!path) {
    return new Response("Bad Request", {
      status: 400,
      headers: { "content-type": "text/plain; charset=utf-8" },
    });
  }

  if (path === "/healthz") {
    const assetPaths = EMBEDDED_ASSETS ? Object.keys(EMBEDDED_ASSETS) : [];
    return new Response(
      request.method === "HEAD"
        ? null
        : JSON.stringify({
            ok: Boolean(EMBEDDED_ASSETS && EMBEDDED_ASSETS["/index.html"]),
            app: "jazireh-bagha",
            mode: "self-contained-edge",
            assets: assetPaths.length,
          }),
      {
        status: 200,
        headers: {
          "content-type": "application/json; charset=utf-8",
          "cache-control": "no-store",
        },
      }
    );
  }

  if (!EMBEDDED_ASSETS || !EMBEDDED_ASSETS["/index.html"]) {
    return new Response(
      "Arvan Edge bundle not generated yet. Run `npm run build && npm run build:arvan` and deploy dist/arvan-edge-worker.js.",
      {
        status: 503,
        headers: { "content-type": "text/plain; charset=utf-8" },
      }
    );
  }

  let targetPath = path;
  let entry = EMBEDDED_ASSETS[targetPath];

  // SPA routing: client-side routes without file extensions fall back to /index.html;
  // missing /assets/* or files with extensions must return a real 404.
  const isAssetPath = targetPath.startsWith("/assets/") || /\.[a-z0-9]{1,8}$/i.test(targetPath);
  if (!entry && !isAssetPath) {
    targetPath = "/index.html";
    entry = EMBEDDED_ASSETS[targetPath];
  }

  if (!entry) {
    return new Response("Not Found", {
      status: 404,
      headers: {
        "content-type": "text/plain; charset=utf-8",
        "cache-control": "no-store",
      },
    });
  }

  return serveEmbeddedAsset(targetPath, entry, request);
}

addEventListener("fetch", (event) => {
  event.respondWith(handleRequest(event.request));
});
