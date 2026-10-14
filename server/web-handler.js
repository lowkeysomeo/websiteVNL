import { Readable } from "node:stream";

export function webHandler(handler) {
  return {
    async fetch(request) {
      // Preserve the original request bytes for SePay signature verification.
      const req = request.body
        ? Readable.fromWeb(request.body)
        : Readable.from([]);
      req.method = request.method;
      req.url = request.url;
      req.headers = Object.fromEntries(request.headers);
      req.socket = {
        remoteAddress:
          request.headers.get("x-vercel-forwarded-for") || "unknown",
      };
      return new Promise((resolve, reject) => {
        const headers = new Headers();
        const res = {
          headersSent: false,
          statusCode: 200,
          setHeader(name, value) {
            headers.set(name, value);
          },
          writeHead(status, values = {}) {
            this.statusCode = status;
            for (const [name, value] of Object.entries(values))
              headers.set(name, value);
            this.headersSent = true;
          },
          end(body) {
            resolve(new Response(body, { status: this.statusCode, headers }));
          },
        };
        handler(req, res).catch(reject);
      });
    },
  };
}
