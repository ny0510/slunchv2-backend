import { Elysia } from 'elysia';
import { swagger } from '@elysiajs/swagger';
import { logger } from '@grotto/logysia';

import comcigan from './routes/comcigan';
import neis from './routes/neis';
import { cronjob } from './cache';

const app = new Elysia()
  .use(
    swagger({
      documentation: {
        info: {
          title: 'Slunch-V2 API',
          description: 'API for slunch-v2',
          version: '1.0.0',
        },
        servers: [
          {
            url: 'https://slunch-v2.ny64.kr',
            description: 'Production server',
          },
          {
            url: 'http://localhost:3000',
            description: 'Local server',
          },
        ],
      },
    })
  )
  .use(
    logger({
      logIP: true,
      writer: {
        write(msg: string) {
          console.log(msg);
        },
      },
    })
  )

  .use(cronjob)
  .use(comcigan)
  .use(neis)
  .listen(process.env.PORT ?? 3000);

console.log(`
🍤 Slunch-V2 backend is running at ${app.server!.url}
📄 Swagger documentation is available at ${app.server!.url}swagger
`);
