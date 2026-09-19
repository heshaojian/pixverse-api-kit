import { ACCOUNT_OPERATIONS } from "./operations/account.js";
import { AGENT_OPERATIONS } from "./operations/agents.js";
import { RESOURCE_OPERATIONS } from "./operations/resources.js";
import { UPLOAD_OPERATIONS } from "./operations/uploads.js";
import { VIDEO_EDITING_OPERATIONS } from "./operations/video-editing.js";
import { VIDEO_GENERATION_OPERATIONS } from "./operations/video-generation.js";

const DOCUMENTATION_URL = "https://docs.platform.pixverse.ai/pixverse-api-llm-txt-2109771m0";

const operationDefinitions = [
  ...ACCOUNT_OPERATIONS,
  ...UPLOAD_OPERATIONS,
  ...RESOURCE_OPERATIONS,
  ...VIDEO_GENERATION_OPERATIONS.filter(({ id }) => id !== "video.avatar"),
  ...VIDEO_EDITING_OPERATIONS.filter(({ id }) => id !== "video.status"),
  VIDEO_GENERATION_OPERATIONS.find(({ id }) => id === "video.avatar"),
  ...AGENT_OPERATIONS,
  VIDEO_EDITING_OPERATIONS.find(({ id }) => id === "video.status"),
];

export const PLATFORM_OPERATIONS = Object.freeze(operationDefinitions.map((definition) => Object.freeze({
  ...definition,
  command: Object.freeze([...definition.command]),
  documentationUrl: DOCUMENTATION_URL,
})));

const OPERATIONS_BY_ID = new Map(PLATFORM_OPERATIONS.map((operation) => [operation.id, operation]));
const OPERATIONS_BY_COMMAND = new Map(
  PLATFORM_OPERATIONS.map((operation) => [operation.command.join("\0"), operation]),
);

export function getPlatformOperation(id) {
  return OPERATIONS_BY_ID.get(id);
}

export function matchPlatformCommand(segments) {
  if (!Array.isArray(segments)) return undefined;
  return OPERATIONS_BY_COMMAND.get(segments.slice(0, 2).join("\0"));
}
