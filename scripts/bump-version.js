#!/usr/bin/env node
/**
 * Incrementa la patch (X.Y.Z → X.Y.(Z+1)) in:
 * - package.json (root)
 * - frontend/package.json
 * - backend/package.json
 */
const fs = require('fs');
const path = require('path');

function bumpFile(relPath) {
  const full = path.join(__dirname, '..', relPath);
  const raw = fs.readFileSync(full, 'utf8');
  const pkg = JSON.parse(raw);
  const parts = String(pkg.version || '0.0.0').split('.').map((n) => parseInt(n, 10) || 0);
  while (parts.length < 3) parts.push(0);
  parts[2] += 1;
  pkg.version = parts.join('.');
  fs.writeFileSync(full, JSON.stringify(pkg, null, 2) + '\n', 'utf8');
  console.log(`${relPath} → ${pkg.version}`);
}

['package.json', 'frontend/package.json', 'backend/package.json'].forEach(bumpFile);

/** Sincronizza la versione mostrata nel footer (import da `frontend/src/version.js`). */
function writeFrontendVersionFile() {
  const full = path.join(__dirname, '..', 'frontend/package.json');
  const pkg = JSON.parse(fs.readFileSync(full, 'utf8'));
  const v = pkg.version || '0.0.0';
  const outPath = path.join(__dirname, '..', 'frontend/src/version.js');
  const body =
    '/** Generato da scripts/bump-version.js — non modificare a mano */\n' +
    `export const FRONTEND_VERSION = '${v}';\n`;
  fs.writeFileSync(outPath, body, 'utf8');
  console.log(`frontend/src/version.js → ${v}`);
}

writeFrontendVersionFile();
