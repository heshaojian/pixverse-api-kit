import fs from "node:fs";
import fsp from "node:fs/promises";
import http from "node:http";
import path from "node:path";
import { pathToFileURL } from "node:url";

const CONTENT_TYPES = Object.freeze({
  ".css": "text/css; charset=utf-8",
  ".html": "text/html; charset=utf-8",
  ".jpg": "image/jpeg",
  ".jpeg": "image/jpeg",
  ".js": "text/javascript; charset=utf-8",
  ".json": "application/json; charset=utf-8",
  ".mp4": "video/mp4",
  ".png": "image/png",
  ".svg": "image/svg+xml",
  ".webp": "image/webp",
});

const ALLOWED_ROUTES = Object.freeze([
  Object.freeze({ prefix: "/qa/revolve-v3-v4-comparison/", directory: "qa/revolve-v3-v4-comparison", extensions: Object.freeze([".css", ".html", ".js", ".json"]) }),
  Object.freeze({ prefix: "/pixverse-cli-jobs/revolve-v3/", directory: "pixverse-cli-jobs/revolve-v3", extensions: Object.freeze([".mp4"]) }),
  Object.freeze({ prefix: "/pixverse-cli-jobs/revolve-v4/", directory: "pixverse-cli-jobs/revolve-v4", extensions: Object.freeze([".mp4"]) }),
  Object.freeze({ prefix: "/deploy/brand-pitches/revolve/v3/assets/posters/", directory: "deploy/brand-pitches/revolve/v3/assets/posters", extensions: Object.freeze([".jpeg", ".jpg", ".png", ".webp"]) }),
  Object.freeze({ prefix: "/deploy/brand-pitches/revolve/v4/assets/", directory: "deploy/brand-pitches/revolve/v4/assets", extensions: Object.freeze([".jpeg", ".jpg", ".png", ".svg", ".webp"]) }),
  Object.freeze({ prefix: "/assets/revolve-pilot-controlled-images/", directory: "assets/revolve-pilot-controlled-images", extensions: Object.freeze([".jpeg", ".jpg", ".png", ".webp"]) }),
]);

class RequestPathError extends Error {
  constructor(status, message) {
    super(message);
    this.status = status;
  }
}

const sendText = (response, status, message) => {
  response.writeHead(status, { "Content-Type": "text/plain; charset=utf-8" });
  response.end(message);
};

const parseRange = (rangeHeader, size) => {
  const match = /^bytes=(\d*)-(\d*)$/.exec(rangeHeader ?? "");
  if (!match) return null;

  const requestedStart = match[1] === "" ? null : Number(match[1]);
  const requestedEnd = match[2] === "" ? null : Number(match[2]);
  if (requestedStart === null && requestedEnd === null) return null;

  const start = requestedStart === null ? Math.max(0, size - requestedEnd) : requestedStart;
  const end = requestedStart === null ? size - 1 : Math.min(requestedEnd ?? size - 1, size - 1);
  if (!Number.isInteger(start) || !Number.isInteger(end) || start < 0 || start > end || start >= size) return null;
  return Object.freeze({ start, end });
};

const resolveRequestPath = async (root, requestUrl) => {
  let pathname;
  try {
    pathname = decodeURIComponent(new URL(requestUrl, "http://local").pathname);
  } catch {
    throw new RequestPathError(400, "Bad request");
  }

  const normalizedPath = path.posix.normalize(pathname);
  if (normalizedPath.split("/").some((segment) => segment.startsWith("."))) return null;
  const route = ALLOWED_ROUTES.find(({ prefix }) => normalizedPath.startsWith(prefix));
  if (!route) return null;

  const routeRoot = await fsp.realpath(path.join(root, route.directory));
  const relativeRequest = normalizedPath.slice(route.prefix.length);
  let candidate = path.resolve(routeRoot, relativeRequest || ".");
  const initialRelative = path.relative(routeRoot, candidate);
  if (initialRelative.startsWith("..") || path.isAbsolute(initialRelative)) {
    throw new RequestPathError(403, "Forbidden");
  }

  const stats = await fsp.stat(candidate);
  if (stats.isDirectory()) candidate = path.join(candidate, "index.html");
  const realCandidate = await fsp.realpath(candidate);
  const realRelative = path.relative(routeRoot, realCandidate);
  if (realRelative.startsWith("..") || path.isAbsolute(realRelative)) {
    throw new RequestPathError(403, "Forbidden");
  }
  const extension = path.extname(realCandidate).toLowerCase();
  if (!route.extensions.includes(extension) || !Object.hasOwn(CONTENT_TYPES, extension)) return null;
  return realCandidate;
};

export const createComparisonServer = ({ root = process.cwd() } = {}) => {
  const safeRoot = path.resolve(root);
  return http.createServer(async (request, response) => {
    if (request.method !== "GET" && request.method !== "HEAD") {
      response.setHeader("Allow", "GET, HEAD");
      sendText(response, 405, "Method not allowed");
      return;
    }

    try {
      const filePath = await resolveRequestPath(safeRoot, request.url ?? "/");
      if (!filePath) {
        sendText(response, 404, "Not found");
        return;
      }

      const stats = await fsp.stat(filePath);
      if (!stats.isFile()) {
        sendText(response, 404, "Not found");
        return;
      }

      const contentType = CONTENT_TYPES[path.extname(filePath).toLowerCase()] ?? "application/octet-stream";
      const range = request.headers.range ? parseRange(request.headers.range, stats.size) : null;
      if (request.headers.range && !range) {
        response.writeHead(416, { "Content-Range": `bytes */${stats.size}` });
        response.end();
        return;
      }

      const headers = {
        "Accept-Ranges": "bytes",
        "Cache-Control": "no-store",
        "Content-Type": contentType,
      };

      if (range) {
        response.writeHead(206, {
          ...headers,
          "Content-Length": range.end - range.start + 1,
          "Content-Range": `bytes ${range.start}-${range.end}/${stats.size}`,
        });
        if (request.method === "HEAD") response.end();
        else fs.createReadStream(filePath, range).pipe(response);
        return;
      }

      response.writeHead(200, { ...headers, "Content-Length": stats.size });
      if (request.method === "HEAD") response.end();
      else fs.createReadStream(filePath).pipe(response);
    } catch (error) {
      if (error instanceof RequestPathError) {
        sendText(response, error.status, error.message);
        return;
      }
      if (error?.code === "ENOENT" || error?.code === "ENOTDIR") {
        sendText(response, 404, "Not found");
        return;
      }
      console.error(error);
      sendText(response, 500, "Internal server error");
    }
  });
};

const parseArguments = (argumentsList) => {
  let options = Object.freeze({ port: 8912, root: process.cwd() });
  for (let index = 0; index < argumentsList.length; index += 1) {
    const argument = argumentsList[index];
    if (argument === "--port") options = Object.freeze({ ...options, port: Number(argumentsList[index += 1]) });
    else if (argument === "--root") options = Object.freeze({ ...options, root: path.resolve(argumentsList[index += 1]) });
    else throw new Error(`Unknown argument: ${argument}`);
  }
  if (!Number.isInteger(options.port) || options.port < 1 || options.port > 65535) throw new Error("Port must be between 1 and 65535");
  return Object.freeze({ ...options });
};

const isDirectRun = process.argv[1] && import.meta.url === pathToFileURL(path.resolve(process.argv[1])).href;
if (isDirectRun) {
  const options = parseArguments(process.argv.slice(2));
  const server = createComparisonServer({ root: options.root });
  server.listen(options.port, "127.0.0.1", () => {
    const pagePath = "/qa/revolve-v3-v4-comparison/";
    console.log(`REVOLVE comparison ready at http://127.0.0.1:${options.port}${pagePath}`);
  });
}
