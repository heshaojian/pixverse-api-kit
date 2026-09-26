#!/bin/zsh
set -euo pipefail

EXPECTED_PLUGIN="pixverse-api"
EXPECTED_MARKETPLACE="pixverse-private-beta"
SUPPORT_ROOT="$HOME/Library/Application Support/PixVerse/api-plugin"
RECEIPT_PATH="$SUPPORT_ROOT/install-receipt.json"

safe_remove_directory() {
  local target="$1"
  SUPPORT_ROOT_VALUE="$SUPPORT_ROOT" TARGET_VALUE="$target" "$NODE_BIN" -e '
const fs = require("node:fs");
const path = require("node:path");
const root = path.resolve(process.env.SUPPORT_ROOT_VALUE);
const target = path.resolve(process.env.TARGET_VALUE);
if (!target.startsWith(root + path.sep)) process.exit(2);
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
  echo "Codex could not remove the plugin registration. Local plugin files were preserved." >&2
  return 1
}

NODE_BIN="$(command -v node || true)"
CODEX_BIN="$(command -v codex || true)"
if [[ -z "$NODE_BIN" || -z "$CODEX_BIN" ]]; then
  echo "Node.js and Codex are required to safely remove the plugin registration." >&2
  exit 1
fi
if [[ ! -f "$RECEIPT_PATH" ]]; then
  echo "No PixVerse API Plugin installation receipt was found. Nothing was removed."
  exit 0
fi

RECEIPT_LINES=("${(@f)$("$NODE_BIN" -e '
const fs = require("node:fs");
const receipt = JSON.parse(fs.readFileSync(process.argv[1], "utf8"));
for (const key of ["install_root", "marketplace", "plugin", "version"]) {
  if (typeof receipt[key] !== "string" || !receipt[key] || /[\r\n]/.test(receipt[key])) process.exit(1);
}
process.stdout.write([receipt.install_root, receipt.marketplace, receipt.plugin, receipt.version].join("\n"));
' "$RECEIPT_PATH")}")

if [[ "${#RECEIPT_LINES[@]}" -ne 4 ]]; then
  echo "The PixVerse API Plugin installation receipt is invalid." >&2
  exit 1
fi
INSTALL_ROOT="${RECEIPT_LINES[1]}"
MARKETPLACE_NAME="${RECEIPT_LINES[2]}"
PLUGIN_NAME="${RECEIPT_LINES[3]}"
VERSION="${RECEIPT_LINES[4]}"

case "$INSTALL_ROOT" in
  "$SUPPORT_ROOT"/"$VERSION") ;;
  *) echo "The installation receipt points outside the expected version directory." >&2; exit 1 ;;
esac
if [[ "$MARKETPLACE_NAME" != "$EXPECTED_MARKETPLACE" || "$PLUGIN_NAME" != "$EXPECTED_PLUGIN" ]]; then
  echo "The installation receipt identifies an unexpected plugin." >&2
  exit 1
fi

remove_registration_or_accept_absent \
  "$CODEX_BIN" plugin remove "$PLUGIN_NAME@$MARKETPLACE_NAME" --json
remove_registration_or_accept_absent \
  "$CODEX_BIN" plugin marketplace remove "$MARKETPLACE_NAME" --json

if [[ -d "$INSTALL_ROOT" ]]; then
  safe_remove_directory "$INSTALL_ROOT"
fi
/bin/rm -f -- "$RECEIPT_PATH"
echo "PixVerse API Plugin $VERSION was removed."
