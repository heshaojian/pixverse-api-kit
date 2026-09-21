export const AUDIO_OPERATIONS = Object.freeze([Object.freeze({
  id: "audio.verify",
  command: Object.freeze(["audio", "verify"]),
  method: "POST",
  path: "/openapi/v2/audio/verification",
  bodyMode: "json",
  validationPolicy: "audio.verify",
  billing: "non-billable",
  asynchronous: false,
  resultIdPath: null,
})]);
