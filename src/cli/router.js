const PROVIDERS = new Set(["growth-studio", "platform"]);
const LEGACY_GROWTH_STUDIO_COMMANDS = Object.freeze({
  avatars: ["avatars", "list"],
  folders: ["folders", "list"],
  "ensure-folder": ["folders", "ensure"],
  "upload-image": ["upload", "image"],
  "create-from-url": ["video", "create-from-url"],
  "create-from-json": ["video", "create-from-json"],
  get: ["video", "get"],
  poll: ["video", "poll"],
  list: ["video", "list"],
  edit: ["video", "edit"],
  "run-job": ["run-job"],
});

export function routeCommand(argv) {
  const [command, ...args] = argv;

  if (PROVIDERS.has(command)) {
    return {
      provider: command,
      providerArgs: [...args],
      legacy: false,
    };
  }

  const mapped = LEGACY_GROWTH_STUDIO_COMMANDS[command];
  if (mapped) {
    return {
      provider: "growth-studio",
      providerArgs: [...mapped, ...args],
      legacy: true,
      legacyCommand: command,
    };
  }

  return {
    provider: "unknown",
    providerArgs: [...args],
    legacy: false,
    command,
  };
}
