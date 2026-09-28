#!/bin/zsh
set -euo pipefail

EXPECTED_PLUGIN="pixverse-api"
EXPECTED_MARKETPLACE="pixverse-private-beta"
SCRIPT_PATH="${0:A}"
SOURCE_ROOT="${SCRIPT_PATH:h}"
SUPPORT_ROOT="$HOME/Library/Application Support/PixVerse/api-plugin"
RECEIPT_PATH="$SUPPORT_ROOT/install-receipt.json"

safe_remove_directory() {
  local target="$1"
  SUPPORT_ROOT_VALUE="$SUPPORT_ROOT" INSTALL_ROOT_VALUE="$INSTALL_ROOT" TARGET_VALUE="$target" "$NODE_BIN" -e '
const fs = require("node:fs");
const path = require("node:path");
const root = path.resolve(process.env.SUPPORT_ROOT_VALUE);
const installRoot = path.resolve(process.env.INSTALL_ROOT_VALUE || "");
const target = path.resolve(process.env.TARGET_VALUE);
if (!(target.startsWith(root + path.sep) || target === installRoot)) process.exit(2);
fs.rmSync(target, { recursive: true, force: true });
' || {
    echo "Refusing to remove a path outside PixVerse API Plugin support storage." >&2
    return 1
  }
}

remove_registration_or_accept_absent() {
  local output
  if output="$("$@" 2>&1)"; then
    return 0
  fi
  if [[ "$output" == *"not configured or installed"* || "$output" == *"not installed"* ]]; then
    return 0
  fi
  echo "$REGISTRATION_OWNER could not remove the plugin registration. Local plugin files were preserved." >&2
  return 1
}

NODE_BIN="$(command -v node || true)"
if [[ -z "$NODE_BIN" ]]; then
  echo "Node.js is required to safely remove the plugin registration." >&2
  exit 1
fi
if [[ ! -f "$RECEIPT_PATH" ]]; then
  echo "No PixVerse API Plugin installation receipt was found. Nothing was removed."
  exit 0
fi

RECEIPT_LINES=("${(@f)$("$NODE_BIN" -e '
const fs = require("node:fs");
const path = require("node:path");
const receipt = JSON.parse(fs.readFileSync(process.argv[1], "utf8"));
for (const key of ["install_root", "marketplace", "plugin", "version"]) {
  if (typeof receipt[key] !== "string" || !receipt[key] || /[\r\n]/.test(receipt[key])) process.exit(1);
}
const installRoot = path.resolve(receipt.install_root);
const supportRoot = path.resolve(process.argv[2]);
const supportInstallRoot = path.join(supportRoot, receipt.version);
const isSupportInstall = installRoot === supportInstallRoot;
const isNodeInstall = installRoot.endsWith("/lib/node_modules/pixverse-api");
if (!isSupportInstall && !isNodeInstall) process.exit(1);
const binPath = typeof receipt.bin_path === "string" && receipt.bin_path && !/[\r\n]/.test(receipt.bin_path)
  ? receipt.bin_path
  : "";
const binTarget = typeof receipt.bin_target === "string" && receipt.bin_target && !/[\r\n]/.test(receipt.bin_target)
  ? receipt.bin_target
  : "";
// Receipts written before multi-agent support registered Codex only.
const agents = Array.isArray(receipt.agents)
  ? receipt.agents.map((agent) => agent?.name).filter((name) => typeof name === "string" && /^[a-z]+$/.test(name))
  : ["codex"];
process.stdout.write([installRoot, receipt.marketplace, receipt.plugin, receipt.version, binPath, binTarget, agents.join(",")].join("\n"));
' "$RECEIPT_PATH" "$SUPPORT_ROOT")}")

if [[ "${#RECEIPT_LINES[@]}" -lt 6 || "${#RECEIPT_LINES[@]}" -gt 7 ]]; then
  echo "The PixVerse API Plugin installation receipt is invalid." >&2
  exit 1
fi
INSTALL_ROOT="${RECEIPT_LINES[1]}"
MARKETPLACE_NAME="${RECEIPT_LINES[2]}"
PLUGIN_NAME="${RECEIPT_LINES[3]}"
VERSION="${RECEIPT_LINES[4]}"
BIN_PATH="${RECEIPT_LINES[5]}"
BIN_TARGET="${RECEIPT_LINES[6]}"
RECEIPT_AGENTS=("${(@s:,:)${RECEIPT_LINES[7]:-}}")

if [[ "$MARKETPLACE_NAME" != "$EXPECTED_MARKETPLACE" || "$PLUGIN_NAME" != "$EXPECTED_PLUGIN" ]]; then
  echo "The installation receipt identifies an unexpected plugin." >&2
  exit 1
fi

if (( ${RECEIPT_AGENTS[(Ie)codex]} )); then
  CODEX_BIN="$(command -v codex || true)"
  if [[ -z "$CODEX_BIN" ]]; then
    echo "Codex is required to safely remove the Codex plugin registration. Local plugin files were preserved." >&2
    exit 1
  fi
  REGISTRATION_OWNER="Codex"
  remove_registration_or_accept_absent \
    "$CODEX_BIN" plugin remove "$PLUGIN_NAME@$MARKETPLACE_NAME" --json
  remove_registration_or_accept_absent \
    "$CODEX_BIN" plugin marketplace remove "$MARKETPLACE_NAME" --json
fi

AGENTS_SCRIPT="$INSTALL_ROOT/dist/agents.js"
if [[ ! -f "$AGENTS_SCRIPT" ]]; then
  AGENTS_SCRIPT="$SOURCE_ROOT/dist/agents.js"
fi
if [[ -n "${RECEIPT_AGENTS[(r)(claude|gemini|cursor|copilot|opencode)]:-}" ]]; then
  if [[ ! -f "$AGENTS_SCRIPT" ]]; then
    echo "The PixVerse API Plugin agent helper is missing. Local plugin files were preserved." >&2
    exit 1
  fi
  "$NODE_BIN" "$AGENTS_SCRIPT" uninstall --receipt "$RECEIPT_PATH" || {
    echo "Some agent registrations could not be removed. Local plugin files were preserved." >&2
    exit 1
  }
fi

if [[ -d "$INSTALL_ROOT" ]]; then
  safe_remove_directory "$INSTALL_ROOT"
fi
if [[ -n "$BIN_PATH" && -L "$BIN_PATH" ]]; then
  CURRENT_BIN_TARGET="$(/bin/ls -l "$BIN_PATH" | /usr/bin/sed 's/^.* -> //')"
  if [[ -z "$BIN_TARGET" || "$CURRENT_BIN_TARGET" == "$BIN_TARGET" ]]; then
    /bin/rm -f -- "$BIN_PATH"
  fi
fi
/bin/rm -f -- "$RECEIPT_PATH"
echo "PixVerse API Plugin $VERSION was removed."
