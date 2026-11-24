// Arvan Edge Worker — serves the built Bazi game from the static GitHub origin.
const STATIC_ORIGIN = "https://raw.githubusercontent.com/sotonnasa-glitch/Bazi/arvan-static";

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

async function getFromOrigin(path, request) {
  const upstreamUrl = STATIC_ORIGIN + path;
  const upstreamHeaders = new Headers();

  // Forward byte-range requests so large video files can seek and stream.
  const range = request.headers.get("Range");
  if (range) upstreamHeaders.set("Range", range);

  const upstream = await fetch(upstreamUrl, {
    method: "GET",
    headers: upstreamHeaders,
    redirect: "follow",
  });

  if (!upstream.ok) return upstream;

  const headers = new Headers(upstream.headers);
  if (!headers.has("content-type")) {
    headers.set("content-type", contentTypeFor(path));
  }
  headers.set("cache-control", path.endsWith(".html")
    ? "public, max-age=60"
    : "public, max-age=3600");

  // Allow the game to be embedded/loaded from its own edge URL.
  headers.set("x-content-type-options", "nosniff");
  return new Response(request.method === "HEAD" ? null : upstream.body, {
    status: upstream.status,
    statusText: upstream.statusText,
    headers,
  });
}

async function handleRequest(request) {
  if (request.method !== "GET" && request.method !== "HEAD") {
    return new Response("Method Not Allowed", {
      status: 405,
      headers: { Allow: "GET, HEAD", "content-type": "text/plain; charset=utf-8" },
    });
  }

  const path = cleanPath(new URL(request.url).pathname);
  if (!path) {
    return new Response("Bad Request", { status: 400 });
  }

  if (path === "/healthz") {
    return new Response("Bazi edge is online", {
      headers: { "content-type": "text/plain; charset=utf-8" },
    });
  }

  try {
    let response = await getFromOrigin(path, request);

    // Client-side routes should serve the game shell; asset paths must keep real 404s.
    const isAsset = path.startsWith("/assets/") || /\.[a-z0-9]{1,8}$/i.test(path);
    if (response.status === 404 && !isAsset) {
      response = await getFromOrigin("/index.html", request);
    }

    return response;
  } catch (error) {
    return new Response("Game assets are temporarily unavailable. Please try again.", {
      status: 502,
      headers: { "content-type": "text/plain; charset=utf-8" },
    });
  }
}

addEventListener("fetch", (event) => {
  event.respondWith(handleRequest(event.request));
});
