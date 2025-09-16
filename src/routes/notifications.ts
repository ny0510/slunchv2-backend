import { randomUUIDv7 as randomUUID } from 'bun';

import { Elysia, t } from 'elysia';
import { db } from '../libraries/db';
import { ERROR_MESSAGES, DB_COLLECTIONS } from '../constants';
import { validateRequired } from '../utils/validation';
import { throwUnauthorized } from '../utils/errors';
import type { Notification } from '../types';

const collection = db.openDB({ name: DB_COLLECTIONS.NOTIFICATIONS, cache: true });
const password = process.env.ADMIN_KEY;
if (password === undefined) {
  throw new Error('ADMIN_KEY is not defined');
}
const hash = await Bun.password.hash(password);

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
          { description: '공지 목록' }
        ),
        400: t.Object({ message: t.String() }, { description: '에러 메시지' }),
      },
      detail: { summary: '공지 목록' },
    }
  )
  .post(
    '/',
    async ({ headers, body }) => {
      const { token } = headers;
      const { title, content, date } = body;
      validateRequired(token, ERROR_MESSAGES.TOKEN_REQUIRED);
      validateRequired(title, ERROR_MESSAGES.TITLE_REQUIRED);
      validateRequired(content, ERROR_MESSAGES.CONTENT_REQUIRED);
      validateRequired(date, ERROR_MESSAGES.DATE_REQUIRED);

      if (!(await Bun.password.verify(token!, hash))) {
        throwUnauthorized();
      }

      const id = randomUUID();
      const notification: Notification = { id, title: title!, content: content!, date: date! };
      await collection.put(id, notification);

      return notification;
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
      validateRequired(token, ERROR_MESSAGES.TOKEN_REQUIRED);

      if (!(await Bun.password.verify(token!, hash))) {
        throwUnauthorized();
      }

      await collection.clearAsync();
      return { message: ERROR_MESSAGES.ALL_NOTIFICATIONS_DELETED };
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
      validateRequired(token, ERROR_MESSAGES.TOKEN_REQUIRED);
      validateRequired(id, ERROR_MESSAGES.ID_REQUIRED);

      if (!(await Bun.password.verify(token!, hash))) {
        throwUnauthorized();
      }

      await collection.remove(id!);
      return { message: ERROR_MESSAGES.NOTIFICATION_DELETED(id!) };
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
      validateRequired(token, ERROR_MESSAGES.TOKEN_REQUIRED);
      validateRequired(id, ERROR_MESSAGES.ID_REQUIRED);
      validateRequired(title, ERROR_MESSAGES.TITLE_REQUIRED);
      validateRequired(content, ERROR_MESSAGES.CONTENT_REQUIRED);
      validateRequired(date, ERROR_MESSAGES.DATE_REQUIRED);

      if (!(await Bun.password.verify(token!, hash))) {
        throwUnauthorized();
      }

      const notification: Notification = { id: id!, title: title!, content: content!, date: date! };
      await collection.put(id!, notification);
      return notification;
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
