#!/bin/zsh
set -euo pipefail

SUPPORT_ROOT="$HOME/Library/Application Support/PixVerse/api-plugin"
CREDENTIALS_PATH="$SUPPORT_ROOT/credentials.env"
LEGACY_CREDENTIALS_PATH="$HOME/Library/Application Support/PixVerse/API Plugin/credentials.env"

NODE_BIN="$(command -v node || true)"
if [[ -z "$NODE_BIN" ]]; then
  echo "Install Node.js 20 or newer, then run this helper again." >&2
  exit 1
fi

echo "PixVerse API Plugin credentials"
echo
echo "Paste the dedicated API keys you want this Mac to use."
echo "Leave a prompt blank to keep the existing value."
echo

read -r -s "platform_key?Platform API key: "
echo
if [[ -n "$platform_key" ]]; then
  echo "Platform API key captured: ${#platform_key} characters."
else
  echo "Platform API key left blank; keeping existing value if one is configured."
fi
read -r -s "growth_key?Growth Studio API key: "
echo
if [[ -n "$growth_key" ]]; then
  echo "Growth Studio API key captured: ${#growth_key} characters."
else
  echo "Growth Studio API key left blank; keeping existing value if one is configured."
fi
echo

if [[ -z "$platform_key" && -z "$growth_key" && ! -f "$CREDENTIALS_PATH" && ! -f "$LEGACY_CREDENTIALS_PATH" ]]; then
  echo "No keys were entered, so no credential file was created."
  exit 0
fi

/bin/mkdir -p -- "$SUPPORT_ROOT"
PLATFORM_KEY="$platform_key" GROWTH_KEY="$growth_key" CREDENTIALS_PATH="$CREDENTIALS_PATH" LEGACY_CREDENTIALS_PATH="$LEGACY_CREDENTIALS_PATH" "$NODE_BIN" <<'NODE'
const fs = require("node:fs");
const path = require("node:path");

const credentialsPath = process.env.CREDENTIALS_PATH;
const legacyCredentialsPath = process.env.LEGACY_CREDENTIALS_PATH;
const platformKey = (process.env.PLATFORM_KEY || "").trim();
const growthKey = (process.env.GROWTH_KEY || "").trim();
if (growthKey && !growthKey.startsWith("mh_live_")) {
  process.stderr.write("Growth Studio API key must start with mh_live_.\n");
  process.exit(1);
}

const allowed = new Set([
  "PIXVERSE_PLATFORM_API_KEY",
  "PIXVERSE_GROWTH_API_KEY",
]);
const values = {};
const readFromPath = fs.existsSync(credentialsPath)
  ? credentialsPath
  : fs.existsSync(legacyCredentialsPath)
    ? legacyCredentialsPath
    : null;
if (readFromPath) {
  for (const line of fs.readFileSync(readFromPath, "utf8").split(/\r?\n/)) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("#")) continue;
    const separator = trimmed.indexOf("=");
    if (separator < 1) continue;
    const key = trimmed.slice(0, separator).trim();
    if (!allowed.has(key)) continue;
    values[key] = trimmed.slice(separator + 1).trim().replace(/^['"]|['"]$/g, "");
  }
}
if (platformKey) values["PIXVERSE_PLATFORM_API_KEY"] = platformKey;
if (growthKey) values["PIXVERSE_GROWTH_API_KEY"] = growthKey;

const rows = [
  "# PixVerse API Plugin credentials",
  "# Created by auth.command.",
];
for (const key of ["PIXVERSE_PLATFORM_API_KEY", "PIXVERSE_GROWTH_API_KEY"]) {
  if (values[key]) rows.push(`${key}=${JSON.stringify(values[key])}`);
}
fs.mkdirSync(path.dirname(credentialsPath), { recursive: true, mode: 0o700 });
const temporaryPath = `${credentialsPath}.${process.pid}.tmp`;
fs.writeFileSync(temporaryPath, `${rows.join("\n")}\n`, { mode: 0o600 });
fs.chmodSync(temporaryPath, 0o600);
fs.renameSync(temporaryPath, credentialsPath);
fs.chmodSync(credentialsPath, 0o600);

const configured = {
  platform: Boolean(values["PIXVERSE_PLATFORM_API_KEY"]),
  growthStudio: Boolean(values["PIXVERSE_GROWTH_API_KEY"]),
};
process.stdout.write("Credentials saved for this macOS user.\n");
process.stdout.write(`Platform API key: ${configured.platform ? "configured" : "missing"}\n`);
process.stdout.write(`Growth Studio API key: ${configured.growthStudio ? "configured" : "missing"}\n`);
NODE

echo "Close and reopen your coding agent, then start a new task."
