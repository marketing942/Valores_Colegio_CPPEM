// Gera o PDF do guia a partir de guia-pdf.html usando o Microsoft Edge em modo headless.
// Fotos em JPEG de propósito: o Edge embute JPEG como está, mas regrava WebP sem perdas (PDF 4x maior).
// Uso: node build-pdf.mjs
import { execFileSync } from "node:child_process";
import { existsSync, mkdtempSync, rmSync, statSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import { pathToFileURL } from "node:url";

const EDGE_PATHS = [
  "C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe",
  "C:\\Program Files\\Microsoft\\Edge\\Application\\msedge.exe",
];
// Tempo para baixar as fontes do Google Fonts e decodificar as imagens antes de imprimir.
const RENDER_BUDGET_MS = 15000;
// O processo do Edge encerra antes de terminar de gravar o PDF; aguardamos o tamanho estabilizar.
const FILE_WAIT_TIMEOUT_MS = 60000;
const FILE_POLL_INTERVAL_MS = 500;

function sleep(milliseconds) {
  Atomics.wait(new Int32Array(new SharedArrayBuffer(4)), 0, 0, milliseconds);
}

function waitForFinishedFile(path) {
  const deadline = Date.now() + FILE_WAIT_TIMEOUT_MS;
  let previousSize = -1;
  while (Date.now() < deadline) {
    const currentSize = existsSync(path) ? statSync(path).size : -1;
    if (currentSize > 0 && currentSize === previousSize) return;
    previousSize = currentSize;
    sleep(FILE_POLL_INTERVAL_MS);
  }
  throw new Error(`O Edge não gerou ${path} em ${FILE_WAIT_TIMEOUT_MS / 1000}s. Verifique se guia-pdf.html abre sem erros no navegador.`);
}

const edgePath = EDGE_PATHS.find(existsSync);
if (!edgePath) {
  throw new Error(`Microsoft Edge não encontrado. Caminhos verificados: ${EDGE_PATHS.join(", ")}`);
}

const source = pathToFileURL(resolve("guia-pdf.html")).href;
const output = resolve("Guia-Matriculas-CPPEM-2027.pdf");

// Perfil isolado: sem ele, o Edge repassa o comando para uma janela já aberta e não gera o PDF.
const isolatedProfile = mkdtempSync(join(tmpdir(), "cppem-pdf-"));
// Remove o PDF anterior para que a checagem abaixo detecte uma falha real de geração.
rmSync(output, { force: true });

execFileSync(edgePath, [
  "--headless=new",
  `--user-data-dir=${isolatedProfile}`,
  "--disable-gpu",
  "--no-pdf-header-footer",
  `--virtual-time-budget=${RENDER_BUDGET_MS}`,
  `--print-to-pdf=${output}`,
  source,
], { stdio: "inherit" });
waitForFinishedFile(output);
rmSync(isolatedProfile, { recursive: true, force: true });

const sizeInMegabytes = (statSync(output).size / 1024 / 1024).toFixed(1);
console.log(`PDF gerado: ${output} (${sizeInMegabytes} MB)`);
