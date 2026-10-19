import express from 'express';
import { createServer } from 'http';

/**
 * Hostinger restarts the app unless it calls listen() within 3 seconds of
 * starting, and loading all the Nest modules takes about that long there. So
 * the port is opened first on a bare Express app that answers 503 until Nest is
 * ready, and only then are the modules loaded (server.ts).
 */
async function bootstrap() {
  const server = express();
  let ready = false;
  server.use((_req, res, next) => {
    if (ready) return next();
    res
      .status(503)
      .set('Retry-After', '5')
      .json({ success: false, statusCode: 503, error: 'Starting up' });
  });
  const port = process.env.PORT ?? 3000;
  createServer(server).listen(port);

  const { startNest } = await import('./server.js');
  await startNest(server, port);
  ready = true;
}

bootstrap();
