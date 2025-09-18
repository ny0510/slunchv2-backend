import { Elysia, t } from 'elysia';
import { db } from '../libraries/db';
import { ERROR_MESSAGES, DB_COLLECTIONS } from '../constants';
import { validateRequired, validateTimeFormat } from '../utils/validation';
import { throwNotFound, throwConflict } from '../utils/errors';
import type { MealSubscription, TimetableSubscription } from '../types';

const mealCollection = db.openDB({ name: DB_COLLECTIONS.FCM_MEAL });
const timetableCollection = db.openDB({ name: DB_COLLECTIONS.FCM_TIMETABLE });

const app = new Elysia({ prefix: '/fcm', tags: ['fcm'] })
  .group('/meal', meal => meal
    .get(
      '/',
      async ({ query }) => {
        validateRequired(query.token, ERROR_MESSAGES.TOKEN_REQUIRED);

        if (!mealCollection.doesExist(query.token!)) {
          throwNotFound(ERROR_MESSAGES.TOKEN_NOT_FOUND);
        }

        return mealCollection.get(query.token!) as MealSubscription;
      },
      {
        detail: { summary: '급식 알림 정보 불러오기' },
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

        if (mealCollection.doesExist(token!)) {
          throwConflict(ERROR_MESSAGES.TOKEN_ALREADY_EXISTS);
        }

        const subscription: MealSubscription = {
          token: token!,
          time: time!,
          schoolCode: String(schoolCode!),
          regionCode: regionCode!
        };
        await mealCollection.put(token!, subscription);

        return subscription;
      },
      {
        body: t.Object({
          token: t.String({ description: 'fcm 토큰' }),
          time: t.String({ description: '알림 시간', example: '07:00' }),
          schoolCode: t.Union([t.String(), t.Number()], { description: '학교 코드' }),
          regionCode: t.String({ description: '지역 코드' }),
        }),
        detail: { summary: '급식 알림 추가' },
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

        if (!mealCollection.doesExist(token!)) {
          throwNotFound(ERROR_MESSAGES.TOKEN_NOT_FOUND);
        }

        await mealCollection.remove(token!);

        return { message: ERROR_MESSAGES.TOKEN_DELETED };
      },
      {
        body: t.Object({
          token: t.String(),
        }),
        detail: { summary: '급식 알림 삭제' },
        response: {
          200: t.Object({ message: t.String() }),
          400: t.Object({ message: t.String() }, { description: '에러 메시지' }),
          404: t.Object({ message: t.String() }, { description: '에러 메시지' }),
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

        if (!mealCollection.doesExist(token!)) {
          throwNotFound(ERROR_MESSAGES.TOKEN_NOT_FOUND);
        }

        const subscription: MealSubscription = {
          token: token!,
          time: time!,
          schoolCode: String(schoolCode!),
          regionCode: regionCode!
        };
        await mealCollection.put(token!, subscription);

        return subscription;
      },
      {
        body: t.Object({
          token: t.String({ description: 'fcm 토큰' }),
          time: t.String({ description: '알림 시간', example: '07:00' }),
          schoolCode: t.Union([t.String(), t.Number()], { description: '학교 코드' }),
          regionCode: t.String({ description: '지역 코드' }),
        }),
        detail: { summary: '급식 알림 수정' },
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
    )
  )
  .group('/timetable', timetable => timetable
    .get(
      '/',
      async ({ query }) => {
        validateRequired(query.token, ERROR_MESSAGES.TOKEN_REQUIRED);

        if (!timetableCollection.doesExist(query.token!)) {
          throwNotFound(ERROR_MESSAGES.TOKEN_NOT_FOUND);
        }

        return timetableCollection.get(query.token!) as TimetableSubscription;
      },
      {
        detail: { summary: '시간표 알림 정보 불러오기' },
        query: t.Object({
          token: t.String({ description: 'fcm 토큰' }),
        }),
        response: {
          200: t.Object({
            token: t.String({ description: 'fcm 토큰' }),
            time: t.String({ description: '알림 시간', example: '07:00' }),
            schoolCode: t.String({ description: '학교 코드' }),
            grade: t.String({ description: '학년' }),
            class: t.String({ description: '반' }),
          }),
          404: t.Object({ message: t.String() }),
          400: t.Object({ message: t.String() }, { description: '에러 메시지' }),
        },
      }
    )
    .post(
      '/',
      async ({ body }) => {
        const { token, time, schoolCode, grade, class: classNum } = body;
        validateRequired(token, ERROR_MESSAGES.TOKEN_REQUIRED);
        validateRequired(time, ERROR_MESSAGES.TIME_REQUIRED);
        validateRequired(schoolCode, ERROR_MESSAGES.SCHOOL_CODE_REQUIRED);
        validateRequired(grade, ERROR_MESSAGES.GRADE_REQUIRED);
        validateRequired(classNum, ERROR_MESSAGES.CLASS_REQUIRED);

        validateTimeFormat(time!);

        if (timetableCollection.doesExist(token!)) {
          throwConflict(ERROR_MESSAGES.TOKEN_ALREADY_EXISTS);
        }

        const subscription: TimetableSubscription = {
          token: token!,
          time: time!,
          schoolCode: String(schoolCode!),
          grade: String(grade!),
          class: String(classNum!)
        };
        await timetableCollection.put(token!, subscription);

        return subscription;
      },
      {
        body: t.Object({
          token: t.String({ description: 'fcm 토큰' }),
          time: t.String({ description: '알림 시간', example: '07:00' }),
          schoolCode: t.Number({ description: '학교 코드' }),
          grade: t.Union([t.String(), t.Number()], { description: '학년' }),
          class: t.Union([t.String(), t.Number()], { description: '반' }),
        }),
        detail: { summary: '시간표 알림 추가' },
        response: {
          200: t.Object({
            token: t.String({ description: 'fcm 토큰' }),
            time: t.String({ description: '알림 시간', example: '07:00' }),
            schoolCode: t.String({ description: '학교 코드' }),
            grade: t.String({ description: '학년' }),
            class: t.String({ description: '반' }),
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

        if (!timetableCollection.doesExist(token!)) {
          throwNotFound(ERROR_MESSAGES.TOKEN_NOT_FOUND);
        }

        await timetableCollection.remove(token!);

        return { message: ERROR_MESSAGES.TOKEN_DELETED };
      },
      {
        body: t.Object({
          token: t.String(),
        }),
        detail: { summary: '시간표 알림 삭제' },
        response: {
          200: t.Object({ message: t.String() }),
          400: t.Object({ message: t.String() }, { description: '에러 메시지' }),
          404: t.Object({ message: t.String() }, { description: '에러 메시지' }),
          500: t.Object({ message: t.String() }, { description: '에러 메시지' }),
        },
      }
    )
    .put(
      '/',
      async ({ body }) => {
        const { token, time, schoolCode, grade, class: classNum } = body;
        validateRequired(token, ERROR_MESSAGES.TOKEN_REQUIRED);
        validateRequired(time, ERROR_MESSAGES.TIME_REQUIRED);
        validateRequired(schoolCode, ERROR_MESSAGES.SCHOOL_CODE_REQUIRED);
        validateRequired(grade, ERROR_MESSAGES.GRADE_REQUIRED);
        validateRequired(classNum, ERROR_MESSAGES.CLASS_REQUIRED);

        validateTimeFormat(time!);

        if (!timetableCollection.doesExist(token!)) {
          throwNotFound(ERROR_MESSAGES.TOKEN_NOT_FOUND);
        }

        const subscription: TimetableSubscription = {
          token: token!,
          time: time!,
          schoolCode: String(schoolCode!),
          grade: String(grade!),
          class: String(classNum!)
        };
        await timetableCollection.put(token!, subscription);

        return subscription;
      },
      {
        body: t.Object({
          token: t.String({ description: 'fcm 토큰' }),
          time: t.String({ description: '알림 시간', example: '07:00' }),
          schoolCode: t.Number({ description: '학교 코드' }),
          grade: t.Union([t.String(), t.Number()], { description: '학년' }),
          class: t.Union([t.String(), t.Number()], { description: '반' }),
        }),
        detail: { summary: '시간표 알림 수정' },
        response: {
          200: t.Object({
            token: t.String({ description: 'fcm 토큰' }),
            time: t.String({ description: '알림 시간', example: '07:00' }),
            schoolCode: t.String({ description: '학교 코드' }),
            grade: t.String({ description: '학년' }),
            class: t.String({ description: '반' }),
          }),
          400: t.Object({ message: t.String() }, { description: '에러 메시지' }),
          404: t.Object({ message: t.String() }, { description: '에러 메시지' }),
          500: t.Object({ message: t.String() }, { description: '에러 메시지' }),
        },
      }
    )
  );

export default app;