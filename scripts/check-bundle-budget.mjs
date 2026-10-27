import { readdir, stat } from "node:fs/promises";
import path from "node:path";

const assetsDir = path.resolve("dist/client/assets");
const entries = await readdir(assetsDir);
const nexoChunks = entries.filter((name) => /^NexoWorkspacePage-.*\.js$/.test(name));

if (nexoChunks.length !== 1) {
  throw new Error(
    `Esperado exatamente um chunk inicial do NEXO em ${assetsDir}; encontrados: ${nexoChunks.join(", ") || "nenhum"}.`,
  );
}

const chunkPath = path.join(assetsDir, nexoChunks[0]);
const { size } = await stat(chunkPath);
const maximumBytes = 850_000;

if (size > maximumBytes) {
  throw new Error(
    `Chunk inicial do NEXO excedeu o limite: ${size} bytes > ${maximumBytes} bytes (${nexoChunks[0]}).`,
  );
}

console.log(`Bundle NEXO dentro do limite: ${size} bytes <= ${maximumBytes} bytes.`);
