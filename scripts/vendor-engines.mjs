import { copyFileSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");

const WEBSCORE_FILES = [
  "webmscore.mjs",
  "webmscore.lib.wasm",
  "webmscore.lib.data",
  "webmscore.lib.mem.wasm",
];

export function patchNodeShim() {
  const path = resolve(root, "node_modules/webmscore/webmscore.nodejs.cjs");
  const source = readFileSync(path, "utf8");
  const needle = "globalthis.navigator = globalthis.navigator || {};";
  if (!source.includes(needle)) return;
  writeFileSync(
    path,
    source.replace(needle, "try { globalthis.navigator = globalthis.navigator || {}; } catch (e) {}"),
  );
}

export function copyBrowserEngines() {
  const vendorDir = resolve(root, "public/vendor/webmscore");
  mkdirSync(vendorDir, { recursive: true });
  for (const name of WEBSCORE_FILES) {
    copyFileSync(resolve(root, "node_modules/webmscore", name), resolve(vendorDir, name));
  }
  const scriptPath = resolve(vendorDir, "webmscore.mjs");
  const script = readFileSync(scriptPath, "utf8");
  const needle = "const MSCORE_SCRIPT_URL$1 = getSelfURL();";
  const replacement = `const MSCORE_SCRIPT_URL$1 = (() => {
    const selfUrl = getSelfURL();
    if (selfUrl && !selfUrl.startsWith("blob:") && selfUrl.includes("webmscore.mjs")) return selfUrl;
    if (typeof location !== "undefined" && location.origin) {
      return location.origin + "/vendor/webmscore/webmscore.mjs";
    }
    return selfUrl;
  })();`;
  if (!script.includes(needle) && !script.includes("location.origin + \"/vendor/webmscore/webmscore.mjs\"")) {
    throw new Error("webmscore.mjs no longer contains the script URL assignment this copy step expects.");
  }
  if (script.includes(needle)) writeFileSync(scriptPath, script.replace(needle, replacement));
  copyFileSync(
    resolve(root, "node_modules/@soundtouchjs/audio-worklet/.dist/soundtouch-processor.js"),
    resolve(root, "public/soundtouch-processor.js"),
  );
}

if (process.argv[1] && fileURLToPath(import.meta.url) === resolve(process.argv[1])) {
  patchNodeShim();
  copyBrowserEngines();
}
