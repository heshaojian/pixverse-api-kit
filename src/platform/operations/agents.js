export const AGENT_OPERATIONS = [
  ["agent.viral-recreation", "viral-recreation"],
  ["agent.real-estate", "real-estate"],
].map(([id, command]) => ({
  id,
  command: ["agent", command],
  method: "POST",
  path: "/openapi/v2/video/agent/generate",
  bodyMode: "json",
  validationPolicy: id,
  billing: "billable",
  asynchronous: true,
  resultIdPath: "Resp.video_id",
}));
