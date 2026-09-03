import { copyFileSync, cpSync, mkdirSync, rmSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const root = dirname(fileURLToPath(import.meta.url));
const output = join(root, "dist");
const publicFiles = [
  "index.html",
  "feedback.html",
  "privacy.html",
  "terms.html",
  "styles.css",
  "app.js",
  "pages.js",
  "model-data.js",
  "manifest.webmanifest",
  "sw.js",
  "robots.txt",
  "LICENSE.txt",
  ".nojekyll"
];

rmSync(output, { recursive: true, force: true });
mkdirSync(output, { recursive: true });

for (const file of publicFiles) {
  copyFileSync(join(root, file), join(output, file));
}

cpSync(join(root, "icons"), join(output, "icons"), { recursive: true });

console.log(`Built ${publicFiles.length} static files plus install icons in dist/`);
