import http from "node:http";

export async function createMockApiServer(handler) {
  const requests = [];
  const server = http.createServer(async (request, response) => {
    const chunks = [];
    for await (const chunk of request) chunks.push(chunk);
    const body = Buffer.concat(chunks);
    const record = {
      method: request.method,
      url: request.url,
      headers: { ...request.headers },
      body,
    };
    requests.push(record);
    await handler(record, response, requests.length - 1);
  });
  await new Promise((resolve) => server.listen(0, "127.0.0.1", resolve));
  const { port } = server.address();
  return {
    baseUrl: `http://127.0.0.1:${port}`,
    requests,
    close: () => new Promise((resolve, reject) => server.close((error) => error ? reject(error) : resolve())),
  };
}

export function sendJson(response, body, status = 200, headers = {}) {
  response.writeHead(status, { "content-type": "application/json", ...headers });
  response.end(typeof body === "string" ? body : JSON.stringify(body));
}
