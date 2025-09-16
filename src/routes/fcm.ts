import { Elysia, t } from 'elysia';
import { db } from '../libraries/db';
import { ERROR_MESSAGES, DB_COLLECTIONS } from '../constants';
import { validateRequired, validateTimeFormat } from '../utils/validation';
import { throwNotFound, throwConflict } from '../utils/errors';
import type { FcmSubscription } from '../types';

const collection = db.openDB({ name: DB_COLLECTIONS.FCM });

const app = new Elysia({ prefix: '/fcm', tags: ['fcm'] })
  .get(
    '/',
    async ({ query }) => {
      validateRequired(query.token, ERROR_MESSAGES.TOKEN_REQUIRED);

      if (!collection.doesExist(query.token!)) {
        throwNotFound(ERROR_MESSAGES.TOKEN_NOT_FOUND);
      }

      return collection.get(query.token!) as FcmSubscription;
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
          schoolCode: t.String({ description: '학교 코드' }),
          regionCode: t.String({ description: '지역 코드' }),
        }),
        404: t.Object({ message: t.String() }),
        400: t.Object({ message: t.String() }, { description: '에러 메시지' }),
      },
    }
  )
  .post(
    '/',
    async ({ body }) => {
      const { token, time, schoolCode, regionCode } = body;
      validateRequired(token, ERROR_MESSAGES.TOKEN_REQUIRED);
      validateRequired(time, ERROR_MESSAGES.TIME_REQUIRED);
      validateRequired(schoolCode, ERROR_MESSAGES.SCHOOL_CODE_REQUIRED);
      validateRequired(regionCode, ERROR_MESSAGES.REGION_CODE_REQUIRED);

      validateTimeFormat(time!);

      if (collection.doesExist(token!)) {
        throwConflict(ERROR_MESSAGES.TOKEN_ALREADY_EXISTS);
      }

      const subscription: FcmSubscription = { token: token!, time: time!, schoolCode: schoolCode!, regionCode: regionCode! };
      await collection.put(token!, subscription);

      return subscription;
    },
    {
      body: t.Object({
        token: t.String({ description: 'fcm 토큰' }),
        time: t.String({ description: '알림 시간', example: '07:00' }),
        schoolCode: t.String({ description: '학교 코드' }),
        regionCode: t.String({ description: '지역 코드' }),
      }),
      detail: { summary: 'fcm 토큰 추가' },
      response: {
        200: t.Object({
          token: t.String({ description: 'fcm 토큰' }),
          time: t.String({ description: '알림 시간', example: '07:00' }),
          schoolCode: t.String({ description: '학교 코드' }),
          regionCode: t.String({ description: '지역 코드' }),
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
      validateRequired(token, ERROR_MESSAGES.TOKEN_REQUIRED);

      if (!collection.doesExist(token!)) {
        throwNotFound(ERROR_MESSAGES.TOKEN_NOT_FOUND);
      }

      await collection.remove(token!);

      return { message: ERROR_MESSAGES.TOKEN_DELETED };
    },
    {
      body: t.Object({
        token: t.String(),
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
      const { token, time, schoolCode, regionCode } = body;
      validateRequired(token, ERROR_MESSAGES.TOKEN_REQUIRED);
      validateRequired(time, ERROR_MESSAGES.TIME_REQUIRED);
      validateRequired(schoolCode, ERROR_MESSAGES.SCHOOL_CODE_REQUIRED);
      validateRequired(regionCode, ERROR_MESSAGES.REGION_CODE_REQUIRED);

      validateTimeFormat(time!);

      if (!collection.doesExist(token!)) {
        throwNotFound(ERROR_MESSAGES.TOKEN_NOT_FOUND);
      }

      const subscription: FcmSubscription = { token: token!, time: time!, schoolCode: schoolCode!, regionCode: regionCode! };
      await collection.put(token!, subscription);

      return subscription;
    },
    {
      body: t.Object({
        token: t.String({ description: 'fcm 토큰' }),
        time: t.String({ description: '알림 시간', example: '07:00' }),
        schoolCode: t.String({ description: '학교 코드' }),
        regionCode: t.String({ description: '지역 코드' }),
      }),
      detail: { summary: 'fcm 토큰 시간 수정' },
      response: {
        200: t.Object({
          token: t.String({ description: 'fcm 토큰' }),
          time: t.String({ description: '알림 시간', example: '07:00' }),
          schoolCode: t.String({ description: '학교 코드' }),
          regionCode: t.String({ description: '지역 코드' }),
        }),
        400: t.Object({ message: t.String() }, { description: '에러 메시지' }),
        404: t.Object({ message: t.String() }, { description: '에러 메시지' }),
        500: t.Object({ message: t.String() }, { description: '에러 메시지' }),
      },
    }
  );

export default app;
