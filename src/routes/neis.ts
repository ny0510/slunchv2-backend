import { Elysia, t } from 'elysia';
import { getMeal, search, getSchedule } from '../libraries/neis';
import { ERROR_MESSAGES } from '../constants';
import { validateRequired, validateSchoolParams, validateDateParams, formatDateForApi } from '../utils/validation';
import logger from '../libraries/logger';


const app = new Elysia({ prefix: '/neis', tags: ['나이스'] })
  .get(
    '/search',
    async ({ query }) => {
      const timer = logger.startTimer('NEIS-ROUTE', '/search');
      const { schoolName } = query;
      validateRequired(schoolName, ERROR_MESSAGES.SCHOOL_NAME_REQUIRED);

      const result = await search(schoolName);
      timer.end('Search request completed', { schoolName, resultCount: result.length });
      return result;
    },
    {
      query: t.Object({
        schoolName: t.String({ description: '학교 이름' }),
      }),
      response: {
        200: t.Array(
          t.Object({
            schoolName: t.String({ description: '학교 이름', default: '선린인터넷고' }),
            schoolCode: t.String({ description: '학교 코드', default: '7010908' }),
            region: t.String({ description: '지역', default: '서울특별시교육청' }),
            regionCode: t.String({ description: '지역 코드', default: 'B10' }),
          }),
          { description: '검색된 학교 목록' }
        ),
        400: t.Object({ message: t.String() }, { description: '에러 메시지' }),
        404: t.Object({ message: t.String() }),
      },
      detail: { summary: '학교 검색' },
    }
  )
  .get(
    '/meal',
    async ({ query }) => {
      const timer = logger.startTimer('NEIS-ROUTE', '/meal');
      const { schoolCode, regionCode, year, month, day, showAllergy, showOrigin, showNutrition } = query;
      validateSchoolParams(schoolCode, regionCode);
      validateDateParams(year, month);

      const dateFormatted = formatDateForApi(year!, month!, day);
      const result = await getMeal(schoolCode!, regionCode!, dateFormatted, showAllergy, showOrigin, showNutrition);
      timer.end('Meal request completed', { schoolCode, regionCode, date: dateFormatted, resultCount: result.length });
      return result;
    },
    {
      query: t.Object({
        schoolCode: t.String({ description: '학교 코드' }),
        regionCode: t.String({ description: '지역 코드' }),
        year: t.String({ description: '년도' }),
        month: t.String({ description: '월' }),
        day: t.Optional(t.String({ description: '일' })),
        showAllergy: t.Boolean({ description: '알레르기 정보 표시 여부', default: false }),
        showOrigin: t.Boolean({ description: '원산지 정보 표시 여부', default: false }),
        showNutrition: t.Boolean({ description: '영양 정보 표시 여부', default: false }),
      }),
      response: {
        200: t.Array(
          t.Object({
            date: t.String({ description: '급식 일자', default: '20250206' }),
            meal: t.Union([
              t.Array(t.String({ description: '음식 이름', default: '들깨무채국' })),
              t.Array(
                t.Object({
                  food: t.String({ description: '음식 이름', default: '들깨무채국' }),
                  allergy: t.Array(
                    t.Object({
                      type: t.String({ description: '알레르기 종류', default: '대두' }),
                      code: t.String({ description: '알레르기 코드', default: '5' }),
                    }),
                    t.Object({
                      type: t.String({ description: '알레르기 종류', default: '밀' }),
                      code: t.String({ description: '알레르기 코드', default: '6' }),
                    })
                  ),
                }),
                { description: '급식' }
              ),
            ]),
            type: t.String({ description: '급식 종류', default: '중식' }),
            origin: t.Optional(
              t.Array(
                t.Object({
                  food: t.String({ description: '음식 이름', default: '김치찌개' }),
                  origin: t.String({ description: '원산지', default: '국내산' }),
                })
              )
            ),
            calorie: t.String({ description: '칼로리', default: '1234' }),
            nutrition: t.Optional(
              t.Array(
                t.Object({
                  type: t.String({ description: '영양소 종류', default: '탄수화물(g)' }),
                  amount: t.String({ description: '영양소 양', default: '147.4' }),
                })
              )
            ),
          }),
          { description: '급식 정보' }
        ),
        400: t.Object({ message: t.String() }, { description: '에러 메시지' }),
        404: t.Object({ message: t.String() }),
      },
      detail: { summary: '급식 정보' },
    }
  )
  .get('/schedule', async ({ query }) => {
      const timer = logger.startTimer('NEIS-ROUTE', '/schedule');
      const { schoolCode, regionCode, year, month, day } = query;
      validateSchoolParams(schoolCode, regionCode);
      validateDateParams(year, month);

      const dateFormatted = formatDateForApi(year!, month!, day);
      const result = await getSchedule(schoolCode!, regionCode!, dateFormatted);
      timer.end('Schedule request completed', { schoolCode, regionCode, date: dateFormatted, resultCount: result.length });
      return result;
    },
    {
      query: t.Object({
        schoolCode: t.String({ description: '학교 코드' }),
        regionCode: t.String({ description: '지역 코드' }),
        year: t.String({ description: '년도' }),
        month: t.String({ description: '월' }),
        day: t.Optional(t.String({ description: '일' })),
      }),
      response: {
        200: t.Array(
          t.Object({
            date: t.Object({
              start: t.String({ description: '시작 일자', default: '2025-02-06' }),
              end: t.String({ description: '종료 일자', default: '2025-02-06' }),
            }),
            schedule: t.String({ description: '일정', default: '해피 버스데이 미' }),
          }),
          { description: '일정 정보' }
        ),
        400: t.Object({ message: t.String() }, { description: '에러 메시지' }),
        404: t.Object({ message: t.String() }),
      },
      detail: { summary: '일정 정보' },
    }
  );

export default app;
