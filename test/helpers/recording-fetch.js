export function createRecordingFetch(responses = []) {
  const calls = [];
  let responseIndex = 0;

  const fetchImpl = async (url, init = {}) => {
    calls.push({
      url: String(url),
      method: init.method ?? "GET",
      headers: new Headers(init.headers),
      body: init.body,
      signal: init.signal,
    });
    const response = responses[Math.min(responseIndex, responses.length - 1)];
    responseIndex += 1;
    if (response instanceof Error) throw response;
    if (typeof response === "function") return response(calls.at(-1), calls.length);
    return response ?? jsonResponse({ ErrCode: 0, ErrMsg: "success", Resp: {} });
  };

  return { calls, fetchImpl };
}

export function jsonResponse(body, init = {}) {
  const responseBody = typeof body === "string" ? body : JSON.stringify(body);
  return new Response(responseBody, {
    status: init.status ?? 200,
    headers: { "content-type": "application/json", ...init.headers },
  });
}

export async function describeRecordedBody(body) {
  if (body === undefined || body === null) return null;
  if (typeof body === "string") return JSON.parse(body);
  if (body instanceof FormData) {
    const fields = {};
    for (const [name, value] of body.entries()) {
      fields[name] = typeof value === "string"
        ? value
        : { name: value.name, size: value.size, type: value.type };
    }
    return fields;
  }
  throw new TypeError(`Unsupported recorded request body: ${body.constructor?.name ?? typeof body}`);
}
