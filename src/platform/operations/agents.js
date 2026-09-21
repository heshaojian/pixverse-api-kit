const SHARED_AGENT_OPERATIONS = [
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

export const AGENT_OPERATIONS = [
  ...SHARED_AGENT_OPERATIONS,
  {
    id: "agent.music-mv",
    command: ["agent", "music-mv"],
    method: "POST",
    path: "/openapi/v2/video/music_mv_agent/generate",
    bodyMode: "json",
    validationPolicy: "agent.music-mv",
    billing: "billable",
    asynchronous: true,
    resultIdPath: "Resp.video_id",
  },
];
