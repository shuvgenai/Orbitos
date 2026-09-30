import { pino } from 'pino';
import { startHealthServer } from '@orbit/shared/health';

// Stage 0 stub: health endpoint only. Stage 1 adds the real program.
const PROGRAM = 'worker';
const log = pino({ name: PROGRAM });
const port = Number(process.env.PORT ?? 8080);

startHealthServer({ name: PROGRAM, port }).on('listening', () => log.info({ port }, 'listening'));
