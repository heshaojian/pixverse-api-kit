#!/bin/zsh
set -euo pipefail

PLUGIN_NAME="pixverse-api"
MARKETPLACE_NAME="pixverse-private-beta"
VERSION="0.3.0-beta.2"
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
PRIOR_INSTALL_ROOT=""
PRIOR_VERSION=""

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

restore_previous_install() {
  local restore_root=""
  if [[ -d "$BACKUP_ROOT" ]]; then
    /bin/mv -- "$BACKUP_ROOT" "$INSTALL_ROOT"
    restore_root="$INSTALL_ROOT"
  elif [[ -n "$PRIOR_INSTALL_ROOT" && -d "$PRIOR_INSTALL_ROOT" ]]; then
    restore_root="$PRIOR_INSTALL_ROOT"
  else
    return 0
  fi
  if ! "$CODEX_BIN" plugin marketplace add "$restore_root" --json >/dev/null; then
    echo "The previous plugin files were restored, but Codex could not restore their marketplace registration." >&2
    return 1
  fi
  if ! "$CODEX_BIN" plugin add "$PLUGIN_NAME@$MARKETPLACE_NAME" --json >/dev/null; then
    echo "The previous plugin files were restored, but Codex could not restore the plugin registration." >&2
    return 1
  fi
}

cleanup() {
  local exit_status=$?
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
  return "$exit_status"
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

if [[ -f "$RECEIPT_PATH" ]]; then
  PRIOR_RECEIPT="$({
    SUPPORT_ROOT_VALUE="$SUPPORT_ROOT" "$NODE_BIN" -e '
const fs = require("node:fs");
const path = require("node:path");
const receipt = JSON.parse(fs.readFileSync(process.argv[1], "utf8"));
for (const key of ["install_root", "marketplace", "plugin", "version"]) {
  if (typeof receipt[key] !== "string" || !receipt[key] || /[\r\n]/.test(receipt[key])) process.exit(1);
}
if (receipt.marketplace !== "pixverse-private-beta" || receipt.plugin !== "pixverse-api") process.exit(1);
if (!/^[0-9A-Za-z][0-9A-Za-z._-]*$/.test(receipt.version)) process.exit(1);
const expectedRoot = path.join(path.resolve(process.env.SUPPORT_ROOT_VALUE), receipt.version);
if (path.resolve(receipt.install_root) !== expectedRoot) process.exit(1);
const stats = fs.lstatSync(expectedRoot);
if (!stats.isDirectory() || stats.isSymbolicLink()) process.exit(1);
process.stdout.write(`${expectedRoot}\n${receipt.version}`);
' "$RECEIPT_PATH"
  } 2>/dev/null)" || {
    echo "The existing PixVerse API Plugin installation receipt is invalid. No changes were made." >&2
    exit 1
  }
  PRIOR_RECEIPT_LINES=("${(@f)PRIOR_RECEIPT}")
  if [[ "${#PRIOR_RECEIPT_LINES[@]}" -ne 2 ]]; then
    echo "The existing PixVerse API Plugin installation receipt is invalid. No changes were made." >&2
    exit 1
  fi
  PRIOR_INSTALL_ROOT="${PRIOR_RECEIPT_LINES[1]}"
  PRIOR_VERSION="${PRIOR_RECEIPT_LINES[2]}"
fi

for required_file in .agents/plugins/marketplace.json MANIFEST.sha256 plugins/pixverse-api/.codex-plugin/plugin.json; do
  if [[ ! -f "$SOURCE_ROOT/$required_file" ]]; then
    echo "The extracted plugin package is incomplete: $required_file is missing." >&2
    exit 1
  fi
done

SOURCE_ROOT_VALUE="$SOURCE_ROOT" "$NODE_BIN" -e '
const fs = require("node:fs");
const path = require("node:path");
const root = path.resolve(process.env.SOURCE_ROOT_VALUE);
const manifestPath = path.join(root, "MANIFEST.sha256");
const rows = fs.readFileSync(manifestPath, "utf8").split("\n").filter(Boolean);
const expected = rows.map((row) => {
  const match = /^[a-f0-9]{64}  ([^\n]+)$/.exec(row);
  if (!match) throw new Error("invalid manifest row");
  const relativePath = match[1];
  if (path.isAbsolute(relativePath) || relativePath.split("/").includes("..")) {
    throw new Error("unsafe manifest path");
  }
  return relativePath;
});
if (new Set(expected).size !== expected.length) throw new Error("duplicate manifest path");
const actual = [];
function walk(current) {
  for (const name of fs.readdirSync(current).sort()) {
    const fullPath = path.join(current, name);
    const stats = fs.lstatSync(fullPath);
    if (stats.isSymbolicLink()) throw new Error("symlink is not allowed");
    if (stats.isDirectory()) walk(fullPath);
    else if (stats.isFile()) {
      const relativePath = path.relative(root, fullPath).split(path.sep).join("/");
      if (relativePath !== "MANIFEST.sha256") actual.push(relativePath);
    } else throw new Error("unsupported package entry");
  }
}
walk(root);
expected.sort();
actual.sort();
if (JSON.stringify(actual) !== JSON.stringify(expected)) throw new Error("inventory mismatch");
' 2>/dev/null || {
  echo "The extracted plugin package inventory is invalid." >&2
  exit 1
}

(
  cd "$SOURCE_ROOT"
  /usr/bin/shasum -a 256 -c MANIFEST.sha256 >/dev/null
)

"$NODE_BIN" -e '
const fs = require("node:fs");
const manifest = JSON.parse(fs.readFileSync(process.argv[1], "utf8"));
if (manifest.name !== "pixverse-api" || manifest.version !== "0.3.0-beta.2") process.exit(1);
' "$SOURCE_ROOT/plugins/pixverse-api/.codex-plugin/plugin.json" || {
  echo "The PixVerse API Plugin manifest is invalid." >&2
  exit 1
}

/bin/mkdir -p -- "$SUPPORT_ROOT"
TEMP_ROOT="$(/usr/bin/mktemp -d "$SUPPORT_ROOT/.install-$VERSION-XXXXXX")"
/usr/bin/ditto "$SOURCE_ROOT" "$TEMP_ROOT"

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
  if ! restore_previous_install; then
    SUCCEEDED=1
    exit 1
  fi
  SUCCEEDED=1
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
if [[ -n "$PRIOR_INSTALL_ROOT" && "$PRIOR_INSTALL_ROOT" != "$INSTALL_ROOT" && -d "$PRIOR_INSTALL_ROOT" ]]; then
  safe_remove_directory "$PRIOR_INSTALL_ROOT" || \
    echo "The new plugin is installed, but the older package directory could not be removed." >&2
fi
echo "PixVerse API Plugin $VERSION is installed. Close and reopen Codex, then start a new task."
