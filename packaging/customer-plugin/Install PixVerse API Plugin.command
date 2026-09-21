#!/bin/zsh
set -euo pipefail

PLUGIN_NAME="pixverse-api"
MARKETPLACE_NAME="pixverse-private-beta"
VERSION="0.3.0-beta.1"
SCRIPT_PATH="${0:A}"
SOURCE_ROOT="${SCRIPT_PATH:h}"
SUPPORT_ROOT="$HOME/Library/Application Support/PixVerse/API Plugin"
INSTALL_ROOT="$SUPPORT_ROOT/$VERSION"
RECEIPT_PATH="$SUPPORT_ROOT/install-receipt.json"
TEMP_ROOT=""
BACKUP_ROOT="$SUPPORT_ROOT/.backup-$VERSION-$$"
INSTALLED_NEW=0
MARKETPLACE_ADDED=0
PLUGIN_ADDED=0
SUCCEEDED=0

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

cleanup() {
  local status=$?
  if [[ "$SUCCEEDED" -ne 1 ]]; then
    if [[ "$PLUGIN_ADDED" -eq 1 ]]; then
      "$CODEX_BIN" plugin remove "$PLUGIN_NAME@$MARKETPLACE_NAME" --json >/dev/null 2>&1 || true
    fi
    if [[ "$MARKETPLACE_ADDED" -eq 1 ]]; then
      "$CODEX_BIN" plugin marketplace remove "$MARKETPLACE_NAME" --json >/dev/null 2>&1 || true
    fi
    if [[ "$INSTALLED_NEW" -eq 1 && -d "$INSTALL_ROOT" ]]; then
      safe_remove_directory "$INSTALL_ROOT" || true
    fi
    if [[ -d "$BACKUP_ROOT" ]]; then
      /bin/mv -- "$BACKUP_ROOT" "$INSTALL_ROOT"
    fi
  elif [[ -d "$BACKUP_ROOT" ]]; then
    safe_remove_directory "$BACKUP_ROOT"
  fi
  if [[ -n "$TEMP_ROOT" && -d "$TEMP_ROOT" ]]; then
    safe_remove_directory "$TEMP_ROOT" || true
  fi
  return "$status"
}
trap cleanup EXIT

if [[ "$(/usr/bin/uname -s)" != "Darwin" ]]; then
  echo "PixVerse API Plugin private demo installation currently supports macOS only." >&2
  exit 1
fi

NODE_BIN="$(command -v node || true)"
if [[ -z "$NODE_BIN" ]]; then
  echo "Install Node.js 20 or newer, then run this installer again." >&2
  exit 1
fi
NODE_MAJOR="$($NODE_BIN -p 'process.versions.node.split(".")[0]')"
if [[ "$NODE_MAJOR" -lt 20 ]]; then
  echo "PixVerse API Plugin requires Node.js 20 or newer." >&2
  exit 1
fi

CODEX_BIN="$(command -v codex || true)"
if [[ -z "$CODEX_BIN" ]]; then
  echo "Install and sign in to Codex, then run this installer again." >&2
  exit 1
fi

for required_file in marketplace.json MANIFEST.sha256 plugins/pixverse-api/.codex-plugin/plugin.json; do
  if [[ ! -f "$SOURCE_ROOT/$required_file" ]]; then
    echo "The extracted plugin package is incomplete: $required_file is missing." >&2
    exit 1
  fi
done

(
  cd "$SOURCE_ROOT"
  /usr/bin/shasum -a 256 -c MANIFEST.sha256 >/dev/null
)

"$NODE_BIN" -e '
const fs = require("node:fs");
const manifest = JSON.parse(fs.readFileSync(process.argv[1], "utf8"));
if (manifest.name !== "pixverse-api" || manifest.version !== "0.3.0-beta.1") process.exit(1);
' "$SOURCE_ROOT/plugins/pixverse-api/.codex-plugin/plugin.json" || {
  echo "The PixVerse API Plugin manifest is invalid." >&2
  exit 1
}

/bin/mkdir -p -- "$SUPPORT_ROOT"
TEMP_ROOT="$(/usr/bin/mktemp -d "$SUPPORT_ROOT/.install-$VERSION-XXXXXX")"
/usr/bin/ditto --noqtn "$SOURCE_ROOT" "$TEMP_ROOT"

if [[ -d "$INSTALL_ROOT" ]]; then
  /bin/mv -- "$INSTALL_ROOT" "$BACKUP_ROOT"
fi
/bin/mv -- "$TEMP_ROOT" "$INSTALL_ROOT"
TEMP_ROOT=""
INSTALLED_NEW=1

if ! "$CODEX_BIN" plugin marketplace add "$INSTALL_ROOT" --json >/dev/null; then
  safe_remove_directory "$INSTALL_ROOT"
  INSTALLED_NEW=0
  if [[ -d "$BACKUP_ROOT" ]]; then
    /bin/mv -- "$BACKUP_ROOT" "$INSTALL_ROOT"
  fi
  echo "Codex could not register the PixVerse private marketplace. The installation was rolled back." >&2
  exit 1
fi
MARKETPLACE_ADDED=1
if ! "$CODEX_BIN" plugin add "$PLUGIN_NAME@$MARKETPLACE_NAME" --json >/dev/null; then
  "$CODEX_BIN" plugin marketplace remove "$MARKETPLACE_NAME" --json >/dev/null 2>&1 || true
  MARKETPLACE_ADDED=0
  safe_remove_directory "$INSTALL_ROOT"
  INSTALLED_NEW=0
  if [[ -d "$BACKUP_ROOT" ]]; then
    /bin/mv -- "$BACKUP_ROOT" "$INSTALL_ROOT"
  fi
  echo "Codex could not install the PixVerse API Plugin. The installation was rolled back." >&2
  exit 1
fi
PLUGIN_ADDED=1

RECEIPT_TEMP="$SUPPORT_ROOT/.install-receipt-$$.json"
INSTALL_ROOT_VALUE="$INSTALL_ROOT" MARKETPLACE_VALUE="$MARKETPLACE_NAME" VERSION_VALUE="$VERSION" \
  "$NODE_BIN" -e '
const fs = require("node:fs");
const receipt = {
  install_root: process.env.INSTALL_ROOT_VALUE,
  marketplace: process.env.MARKETPLACE_VALUE,
  plugin: "pixverse-api",
  version: process.env.VERSION_VALUE,
};
fs.writeFileSync(process.argv[1], JSON.stringify(receipt, null, 2) + "\n", { mode: 0o600 });
' "$RECEIPT_TEMP"
/bin/chmod 600 "$RECEIPT_TEMP"
/bin/mv -f -- "$RECEIPT_TEMP" "$RECEIPT_PATH"

SUCCEEDED=1
echo "PixVerse API Plugin $VERSION is installed. Close and reopen Codex, then start a new task."
