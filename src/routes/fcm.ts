import { Elysia, error, t } from 'elysia';
import { db } from '../libraries/db';

const collection = db.openDB({ name: 'fcm' });

const app = new Elysia({ prefix: '/fcm', tags: ['fcm'] })
  .get(
    '/',
    async ({ query }) => {
      if (!query.token) throw error(400, { message: '토큰을 입력해주세요.' });

      if (!collection.doesExist(query.token)) {
        throw error(404, { message: '토큰을 찾을 수 없어요.' });
      }

      return collection.get(query.token);
    },
    {
      detail: { summary: 'fcm 토큰 정보 불러오기' },
      query: t.Object({
        token: t.String({ description: 'fcm 토큰' }),
      }),
      response: {
        200: t.Object({
          token: t.String({ description: 'fcm 토큰' }),
          time: t.String({ description: '알림 시간', example: '07:00' }),
        }),
        404: t.Object({ message: t.String() }),
        400: t.Object({ message: t.String() }, { description: '에러 메시지' }),
      },
    }
  )
  .post(
    '/',
    async ({ body }) => {
      const { token, time } = body;
      if (!token) throw error(400, '토큰을 입력해주세요.');
      if (!time) throw error(400, '알림 시간을 입력해주세요.');

      const [hour, minute] = time.split(':').map(Number);

      if (hour < 0 || hour > 23) throw error(400, '시간은 0~23 사이여야 해요.');
      if (minute < 0 || minute > 59) throw error(400, '분은 0~59 사이여야 해요.');

      if (collection.doesExist(token)) throw error(409, '이미 존재하는 토큰이에요.');

      await collection.put(token, { token, time });

      return { token, time };
    },
    {
      body: t.Object({
        token: t.String({ description: 'fcm 토큰' }),
        time: t.String({ description: '알림 시간', example: '07:00' }),
      }),
      detail: { summary: 'fcm 토큰 추가' },
      response: {
        200: t.Object({
          token: t.String({ description: 'fcm 토큰' }),
          time: t.String({ description: '알림 시간', example: '07:00' }),
        }),
        400: t.Object({ message: t.String() }, { description: '에러 메시지' }),
        409: t.Object({ message: t.String() }, { description: '에러 메시지' }),
        500: t.Object({ message: t.String() }, { description: '에러 메시지' }),
      },
    }
  )
  .delete(
    '/',
    async ({ body }) => {
      const { token } = body;

      if (!token) throw error(400, '토큰을 입력해주세요.');

      if (!collection.doesExist(token)) throw error(404, '토큰을 찾을 수 없어요.');

      await collection.remove(token);

      return { message: '토큰이 삭제되었어요.' };
    },
    {
      body: t.Object({
        token: t.String({ description: 'fcm 토큰' }),
      }),
      detail: { summary: 'fcm 토큰 삭제' },
      response: {
        200: t.Object({ message: t.String() }),
        400: t.Object({ message: t.String() }, { description: '에러 메시지' }),
        500: t.Object({ message: t.String() }, { description: '에러 메시지' }),
      },
    }
  )
  .put(
    '/',
    async ({ body }) => {
      const { token, time } = body;
      if (!token) throw error(400, '토큰을 입력해주세요.');
      if (!time) throw error(400, '알림 시간을 입력해주세요.');

      const [hour, minute] = time.split(':').map(Number);

      if (hour < 0 || hour > 23) throw error(400, '시간은 0~23 사이여야 해요.');
      if (minute < 0 || minute > 59) throw error(400, '분은 0~59 사이여야 해요.');

      if (!collection.doesExist(token)) throw error(404, '토큰을 찾을 수 없어요.');

      await collection.put(token, { token, time });

      return { token, time };
    },
    {
      body: t.Object({
        token: t.String({ description: 'fcm 토큰' }),
        time: t.String({ description: '알림 시간', example: '07:00' }),
      }),
      detail: { summary: 'fcm 토큰 시간 수정' },
      response: {
        200: t.Object({
          token: t.String({ description: 'fcm 토큰' }),
          time: t.String({ description: '알림 시간', example: '07:00' }),
        }),
        400: t.Object({ message: t.String() }, { description: '에러 메시지' }),
        404: t.Object({ message: t.String() }, { description: '에러 메시지' }),
        500: t.Object({ message: t.String() }, { description: '에러 메시지' }),
      },
    }
  );

export default app;
