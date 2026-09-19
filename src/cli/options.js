export function isHelpRequest(argv) {
  return argv.length === 0 || argv[0] === "help" || argv[0] === "--help" || argv[0] === "-h";
}

export function getTopLevelHelp() {
  return `Usage:
  pixverse-api platform <resource> <operation> [options]
  pixverse-api growth-studio <resource> <operation> [options]

Run "pixverse-api <provider> --help" for provider commands.
Legacy Growth Studio commands remain available during the 0.x release series.`;
}
