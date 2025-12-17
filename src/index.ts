import Elysia, { redirect } from 'elysia';
import { swagger } from '@elysiajs/swagger';
import { staticPlugin } from '@elysiajs/static';
import { rateLimit } from 'elysia-rate-limit';
import logixlysia from 'logixlysia';

import comcigan from './routes/comcigan';
import neis from './routes/neis';
import notifications from './routes/notifications';
import fcm from './routes/fcm';
import admin from './routes/admin';
import { refreshCache, refreshSchoolCache, refreshScheduleCache } from './libraries/cache';
import { sendFcm } from './libraries/fcm';
import { precachePopularSchools } from './services/meal-precache';
import { cleanupOldAccessRecords } from './services/access-tracker';
import logger, { compressOldLogs } from './libraries/logger';
import cron from '@elysiajs/cron';

import { SUS_VIDEOS, API_CONFIG } from './constants';

const susVideo = (): string => {
  return `https://youtu.be/${SUS_VIDEOS[Math.floor(Math.random() * SUS_VIDEOS.length)]}`;
};

const mealPrecache = cron({
  name: 'mealPrecache',
  pattern: '0 5 * * *', // 매일 새벽 5시
  async run() {
    await precachePopularSchools();
  },
});

const cleanupAccessRecords = cron({
  name: 'cleanupAccessRecords',
  pattern: '0 3 * * 0', // 매주 일요일 새벽 3시
  async run() {
    cleanupOldAccessRecords();
  },
});

const compressLogs = cron({
  name: 'compressLogs',
  pattern: '0 4 * * 0', // 매주 일요일 새벽 4시
  async run() {
    await compressOldLogs();
  },
});

export const app = new Elysia()
  .use(
    swagger({
      documentation: {
        info: { title: 'Slunch-V2 API', description: 'API for slunch-v2', version: '1.0.0' },
        servers: [
          { url: 'https://slunch-v2.ny64.kr', description: 'Production server' },
          { url: 'http://localhost:3000', description: 'Local server' },
        ],
      },
    })
  )
  .use(
    // @ts-ignore
    logixlysia({
      config: {
        showStartupMessage: false,
        timestamp: {
          translateTime: 'yyyy-mm-dd HH:MM:ss',
        },
        ip: true,
        customLogFormat: '{now} {level} {duration} {method} {pathname} {status} {message} {ip}',
      },
    })
  )
  .use(staticPlugin({ assets: 'public' }))
  .use(
    rateLimit({
      errorResponse: new Response(`You are rate limited!\nvideo for you: https://youtu.be/${[susVideo()]}`, {
        status: 429,
        statusText: 'Rate Limit Exceeded',
        headers: { 'Content-Type': 'text/plain' },
      }),
      max: API_CONFIG.RATE_LIMIT.MAX_REQUESTS,
      duration: API_CONFIG.RATE_LIMIT.DURATION_MS,
    })
  )

  .use(refreshCache)
  .use(refreshSchoolCache)
  .use(refreshScheduleCache)
  .use(sendFcm)
  .use(mealPrecache)
  .use(cleanupAccessRecords)
  .use(compressLogs)

  .use(comcigan)
  .use(neis)
  .use(notifications)
  .use(fcm)
  .use(admin)

  .onError(({ code }) => {
    if (code === 'NOT_FOUND') return redirect(susVideo());
  })
  .listen(process.env.PORT ?? API_CONFIG.DEFAULT_PORT);

logger.info('SERVER', `Slunch-V2 backend started`, { url: app.server!.url.toString() });
console.log(`
🍤 Slunch-V2 backend is running at ${app.server!.url}
📄 Swagger documentation is available at ${app.server!.url}swagger
`);
