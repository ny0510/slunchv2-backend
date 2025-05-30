import { generate } from 'jsr:@babia/uuid-v7';

import { Elysia, error, t } from 'elysia';
import { db } from '../libraries/db.ts';
import { hash, verify } from "jsr:@bronti/argon2"

interface Notification {
  id: string;
  title: string;
  content: string;
  date: string;
}

const collection = db.openDB({ name: 'notifications', cache: true });
const password = Deno.env.get("ADMIN_KEY");
if (password === undefined) {
  throw new Error('ADMIN_KEY is not defined');
}
const passwordHash = hash(password);

const app = new Elysia({ prefix: '/notifications', tags: ['공지'] })
  .get(
    '/',
    async () => {
      const notifications: Notification[] = await collection.getMany(collection.getKeys().asArray);
      notifications.sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
      return notifications;
    },
    {
      query: t.Object({}),
      response: {
        200: t.Array(
          t.Object({
            id: t.String({ description: '공지 ID' }),
            title: t.String({ description: '공지 제목', default: '제목' }),
            content: t.String({ description: '공지 내용', default: '내용' }),
            date: t.String({ description: '공지 날짜', default: '2025-03-08T05:52:06.583Z' }),
          }),
          { description: '공지 목록' },
        ),
        400: t.Object({ message: t.String() }, { description: '에러 메시지' }),
      },
      detail: { summary: '공지 목록' },
    },
  )
  .post(
    '/',
    async ({ headers, body }) => {
      const { token } = headers;
      const { title, content, date } = body;
      if (!token) throw error(400, { message: '토큰을 입력해주세요.' });
      if (!title) throw error(400, { message: '제목을 입력해주세요.' });
      if (!content) throw error(400, { message: '내용을 입력해주세요.' });
      if (!date) throw error(400, { message: '날짜를 입력해주세요.' });

      if (!verify(token, passwordHash)) {
        throw error(403, { message: '권한이 없습니다.' });
      }

      const id = generate();
      await collection.put(id, { id, title, content, date });

      return { id, title, content, date };
    },
    {
      headers: t.Object({
        token: t.String({ description: '관리자 토큰' }),
      }),
      body: t.Object({
        title: t.String({ description: '공지 제목', default: 'title' }),
        content: t.String({ description: '공지 내용', default: 'description' }),
        date: t.String({ description: '공지 날짜', default: '2025-03-08T05:52:06.583Z' }),
      }),
      response: {
        200: t.Object({
          id: t.String(),
          title: t.String(),
          content: t.String(),
          date: t.String(),
        }),
        400: t.Object({ message: t.String() }, { description: '에러 메시지' }),
        401: t.Object({ message: t.String() }),
        403: t.Object({ message: t.String() }),
      },
      detail: { summary: '공지 추가' },
    }
  )
  .delete(
    '/',
    async ({ headers }) => {
      const { token } = headers;
      if (!token) throw error(400, { message: '토큰을 입력해주세요.' });

      if (!verify(token, passwordHash)) {
        throw error(403, { message: '권한이 없습니다.' });
      }

      await collection.clearAsync();
      return { message: '모든 공지가 삭제되었습니다.' };
    },
    {
      headers: t.Object({
        token: t.String({ description: '관리자 토큰' }),
      }),
      response: {
        200: t.Object({ message: t.String() }),
        400: t.Object({ message: t.String() }, { description: '에러 메시지' }),
        403: t.Object({ message: t.String() }),
      },
      detail: { summary: '모든 공지 삭제' },
    }
  )
  .delete(
    '/:id',
    async ({ headers, params }) => {
      const { token } = headers;
      const { id } = params;
      if (!token) throw error(400, { message: '토큰을 입력해주세요.' });
      if (!id) throw error(400, { message: 'ID를 입력해주세요.' });

      if (!verify(token, passwordHash)) {
        throw error(403, { message: '권한이 없습니다.' });
      }

      await collection.remove(id);
      return { message: `공지 ${id}가 삭제되었습니다.` };
    },
    {
      headers: t.Object({
        token: t.String({ description: '관리자 토큰' }),
      }),
      params: t.Object({
        id: t.String({ description: '공지 ID' }),
      }),
      response: {
        200: t.Object({ message: t.String() }),
        400: t.Object({ message: t.String() }, { description: '에러 메시지' }),
        403: t.Object({ message: t.String() }),
      },
      detail: { summary: '특정 공지 삭제' },
    }
  )
  .put(
    '/:id',
    async ({ headers, params, body }) => {
      const { token } = headers;
      const { id } = params;
      const { title, content, date } = body;
      if (!token) throw error(400, { message: '토큰을 입력해주세요.' });
      if (!id) throw error(400, { message: 'ID를 입력해주세요.' });
      if (!title) throw error(400, { message: '제목을 입력해주세요.' });
      if (!content) throw error(400, { message: '내용을 입력해주세요.' });
      if (!date) throw error(400, { message: '날짜를 입력해주세요.' });

      if (!verify(token, passwordHash)) {
        throw error(403, { message: '권한이 없습니다.' });
      }

      await collection.put(id, { id, title, content, date });
      return { id, title, content, date };
    },
    {
      headers: t.Object({
        token: t.String({ description: '관리자 토큰' }),
      }),
      params: t.Object({
        id: t.String({ description: '공지 ID' }),
      }),
      body: t.Object({
        title: t.String({ description: '공지 제목', default: 'title' }),
        content: t.String({ description: '공지 내용', default: 'description' }),
        date: t.String({ description: '공지 날짜', default: '2025-03-08T05:52:06.583Z' }),
      }),
      response: {
        200: t.Object({
          id: t.String(),
          title: t.String(),
          content: t.String(),
          date: t.String(),
        }),
        400: t.Object({ message: t.String() }, { description: '에러 메시지' }),
        403: t.Object({ message: t.String() }),
      },
      detail: { summary: '공지 수정' },
    }
  );

export default app;
