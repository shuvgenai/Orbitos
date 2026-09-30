import { createServer, type Server } from 'node:http';

// Every ORBIT program exposes GET /healthz so compose and the uptime check can probe it.
export function startHealthServer(opts: { name: string; port: number }): Server {
  const server = createServer((req, res) => {
    if (req.method === 'GET' && req.url === '/healthz') {
      res.writeHead(200, { 'content-type': 'application/json' });
      res.end(JSON.stringify({ status: 'ok', program: opts.name }));
      return;
    }
    res.writeHead(404).end();
  });
  server.listen(opts.port);
  return server;
}
