import { copyFile, mkdir, readdir, readFile, writeFile } from "node:fs/promises";
import { extname, join, relative, resolve, sep } from "node:path";
import { pathToFileURL } from "node:url";

const serverEntry = resolve("dist/server/index.mjs");
const serverModule = await import(`${pathToFileURL(serverEntry).href}?t=${Date.now()}`);
const response = await serverModule.default.fetch(
  new Request("https://local.build/"),
  {},
  {
    waitUntil() {},
  },
);
const indexHtml = await response.text();

await mkdir("dist/.openai", { recursive: true });
await copyFile(".openai/hosting.json", "dist/.openai/hosting.json");

const mimeTypes = {
  ".css": "text/css; charset=utf-8",
  ".js": "text/javascript; charset=utf-8",
  ".mjs": "text/javascript; charset=utf-8",
  ".png": "image/png",
  ".svg": "image/svg+xml",
  ".webp": "image/webp",
  ".jpg": "image/jpeg",
  ".jpeg": "image/jpeg",
  ".ico": "image/x-icon",
  ".json": "application/json; charset=utf-8",
  ".txt": "text/plain; charset=utf-8",
};

async function listFiles(directory) {
  const entries = await readdir(directory, { withFileTypes: true });
  const files = await Promise.all(
    entries.map(async (entry) => {
      const fullPath = join(directory, entry.name);
      return entry.isDirectory() ? listFiles(fullPath) : [fullPath];
    }),
  );

  return files.flat();
}

const clientDir = resolve("dist/client");
const assets = Object.fromEntries(
  await Promise.all(
    (await listFiles(clientDir)).map(async (filePath) => {
      const urlPath = `/${relative(clientDir, filePath).split(sep).join("/")}`;
      const body = await readFile(filePath);
      const contentType = mimeTypes[extname(filePath).toLowerCase()] ?? "application/octet-stream";

      return [urlPath, { contentType, body: body.toString("base64") }];
    }),
  ),
);

const worker = `const INDEX_HTML = ${JSON.stringify(indexHtml)};
const ASSETS = ${JSON.stringify(assets)};

function decodeBase64(value) {
  const binary = atob(value);
  const bytes = new Uint8Array(binary.length);

  for (let index = 0; index < binary.length; index += 1) {
    bytes[index] = binary.charCodeAt(index);
  }

  return bytes;
}

export default {
  async fetch(request) {
    const url = new URL(request.url);
    const asset = ASSETS[url.pathname];

    if (asset) {
      return new Response(decodeBase64(asset.body), {
        headers: {
          "content-type": asset.contentType,
          "x-sites-adapter": "static-worker",
          "cache-control": url.pathname.startsWith("/assets/")
            ? "public, max-age=31536000, immutable"
            : "public, max-age=3600",
        },
      });
    }

    if (url.pathname.startsWith("/assets/")) {
      return new Response("Not found", {
        status: 404,
        headers: {
          "content-type": "text/plain; charset=utf-8",
          "x-sites-adapter": "static-worker",
        },
      });
    }

    return new Response(INDEX_HTML, {
      headers: {
        "content-type": "text/html; charset=utf-8",
        "x-sites-adapter": "static-worker",
        "cache-control": "no-store",
      },
    });
  },
};
`;

await writeFile(serverEntry, worker);
