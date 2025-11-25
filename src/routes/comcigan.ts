import { Elysia, t } from 'elysia';
import Comcigan, { School, Weekday } from 'comcigan.ts';
import { ERROR_MESSAGES } from '../constants';
import { validateRequired } from '../utils/validation';
import { handleComciganError } from '../utils/errors';

const comcigan = new Comcigan();

const app = new Elysia({ prefix: '/comcigan', tags: ['컴시간'] })
  .get(
    '/search',
    async ({ query }) => {
      const startTime = Date.now();
      validateRequired(query.schoolName, ERROR_MESSAGES.SCHOOL_NAME_REQUIRED);

      console.log(`[COMCIGAN-SEARCH] Fetching from Comcigan API - No cache available`);
      const apiStart = Date.now();
      const searchedSchools: School[] = await comcigan.searchSchools(query.schoolName!);
      console.log(`[COMCIGAN-SEARCH] API call took ${Date.now() - apiStart}ms`);

      const result = searchedSchools
        .filter((school) => school.code !== 0) // 없으면 추가 검색하세요 제외
        .map((school) => ({
          schoolName: school.name,
          schoolCode: school.code,
          region: school.region.name,
        }));

      console.log(`[COMCIGAN-SEARCH] Total request time: ${Date.now() - startTime}ms - Found ${result.length} schools`);
      return result;
    },
    {
      query: t.Object({
        schoolName: t.String({ description: '학교 이름' }),
      }),
      detail: { summary: '학교 검색' },
      response: {
        200: t.Array(
          t.Object({
            schoolName: t.String({ description: '학교 이름', default: '선린인터넷고' }),
            schoolCode: t.Number({ description: '학교 코드', default: 41896 }),
            region: t.String({ description: '지역', default: '서울' }),
          }),
          { description: '검색된 학교 목록' }
        ),
        400: t.Object({ message: t.String() }, { description: '에러 메시지' }),
      },
    }
  )
  .get(
    '/timetable',
    async ({ query }) => {
      const startTime = Date.now();
      const { schoolCode, grade, class: classNum, weekday } = query;
      validateRequired(schoolCode, ERROR_MESSAGES.SCHOOL_CODE_REQUIRED);
      validateRequired(grade, ERROR_MESSAGES.GRADE_REQUIRED);
      validateRequired(classNum, ERROR_MESSAGES.CLASS_REQUIRED);

      try {
        console.log(`[COMCIGAN-TIMETABLE] Fetching from Comcigan API - No cache available`);
        const apiStart = Date.now();
        const result = weekday ? await comcigan.getTimetable(schoolCode, grade, classNum, weekday as never as Weekday) : await comcigan.getTimetable(schoolCode, grade, classNum);
        console.log(`[COMCIGAN-TIMETABLE] API call took ${Date.now() - apiStart}ms`);
        console.log(`[COMCIGAN-TIMETABLE] Total request time: ${Date.now() - startTime}ms`);
        return result;
      } catch (e) {
        handleComciganError(e as Error);
      }
    },
    {
      query: t.Object({
        schoolCode: t.Number({ description: '학교 코드' }),
        grade: t.Number({ description: '학년' }),
        class: t.Number({ description: '반' }),
        weekday: t.Optional(t.UnionEnum(['1', '2', '3', '4', '5'], { description: '요일', default: undefined })),
      }),
      detail: { summary: '시간표 조회' },
      response: {
        200: t.Union(
          [
            t.Array(
              t.Union([
                t.Object(
                  {
                    subject: t.String({ description: '과목', default: '국어' }),
                    teacher: t.String({ description: '교사', default: '홍길*' }),
                    changed: t.Literal(false),
                  },
                  { description: '변경되지 않은 시간표' }
                ),
                t.Object(
                  {
                    subject: t.String({ description: '과목', default: '국어' }),
                    teacher: t.String({ description: '교사', default: '홍길*' }),
                    changed: t.Literal(true),
                    originalSubject: t.String({ description: '변경 전 과목', default: '수학' }),
                    originalTeacher: t.String({ description: '변경 전 교사', default: '길홍*' }),
                  },
                  {
                    description: '변경된 시간표',
                  }
                ),
              ]),
              { description: '하루 시간표' }
            ),
            t.Array(
              t.Array(
                t.Union([
                  t.Object(
                    {
                      subject: t.String({ description: '과목', default: '국어' }),
                      teacher: t.String({ description: '교사', default: '홍길*' }),
                      changed: t.Literal(false),
                    },
                    { description: '변경되지 않은 시간표' }
                  ),
                  t.Object(
                    {
                      subject: t.String({ description: '과목', default: '국어' }),
                      teacher: t.String({ description: '교사', default: '홍길*' }),
                      changed: t.Literal(true),
                      originalSubject: t.String({ description: '변경 전 과목', default: '수학' }),
                      originalTeacher: t.String({ description: '변경 전 교사', default: '길홍*' }),
                    },
                    { description: '변경된 시간표' }
                  ),
                ])
              ),
              { description: '일주일 시간표' }
            ),
          ],
          { description: '시간표' }
        ),
        400: t.Object({ message: t.String() }, { description: '에러 메시지' }),
        404: t.Object({ message: t.String() }, { description: '에러 메시지' }),
      },
    }
  )
  .get(
    '/classList',
    async ({ query }) => {
      const startTime = Date.now();
      const { schoolCode } = query;
      validateRequired(schoolCode, ERROR_MESSAGES.SCHOOL_CODE_REQUIRED);

      try {
        console.log(`[COMCIGAN-CLASSLIST] Fetching from Comcigan API - No cache available`);
        const apiStart = Date.now();
        const timetable = await comcigan.getTimetable(schoolCode);
        console.log(`[COMCIGAN-CLASSLIST] API call took ${Date.now() - apiStart}ms`);

        const result = timetable.map((grade, gradeIndex) => ({
          grade: gradeIndex + 1,
          classes: grade.map((_, classIndex) => classIndex + 1),
        }));

        console.log(`[COMCIGAN-CLASSLIST] Total request time: ${Date.now() - startTime}ms`);
        return result;
      } catch (e) {
        handleComciganError(e as Error);
      }
    },
    {
      query: t.Object({
        schoolCode: t.Number({ description: '학교 코드' }),
      }),
      detail: { summary: '반 목록 조회' },
      response: {
        200: t.Array(
          t.Object({
            grade: t.Number({ description: '학년', default: 1 }),
            classes: t.Array(t.Number({ description: '반', default: 1 }), { description: '반 목록' }),
          }),
          { description: '반 목록' }
        ),
        400: t.Object({ message: t.String() }, { description: '에러 메시지' }),
        404: t.Object({ message: t.String() }, { description: '에러 메시지' }),
        500: t.Object({ message: t.String() }, { description: '에러 메시지' }),
      },
    }
  );

export default app;
