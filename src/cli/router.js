import { mapLegacyGrowthStudioCommand } from "../growth-studio/cli.js";

const PROVIDERS = new Set(["growth-studio", "platform"]);

export function routeCommand(argv) {
  const [command, ...args] = argv;

  if (PROVIDERS.has(command)) {
    return {
      provider: command,
      providerArgs: [...args],
      legacy: false,
    };
  }

  const mapped = mapLegacyGrowthStudioCommand(command, args);
  if (mapped) {
    return {
      provider: "growth-studio",
      providerArgs: mapped,
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
