import { Elysia, error, t } from 'elysia';
import { getMeal, neis, search } from '../libraries/cache';

const app = new Elysia({ prefix: '/neis', tags: ['나이스'] })
  .get(
    '/search',
    async ({ query }) => {
      const { schoolName } = query;
      if (!schoolName) throw error(400, { message: '학교 이름을 입력해주세요.' });

      return await search(schoolName);
    },
    {
      query: t.Object({
        schoolName: t.String({ description: '학교 이름', error: { message: '학교 이름은 문자열이어야 해요.' } }),
      }),
      response: {
        200: t.Array(
          t.Object({
            schoolName: t.String({ description: '학교 이름', default: '선린인터넷고' }),
            schoolCode: t.String({ description: '학교 코드', default: '7010908' }),
            region: t.String({ description: '지역', default: '서울특별시교육청' }),
            regionCode: t.String({ description: '지역 코드', default: 'B10' }),
          }),
          { description: '검색된 학교 목록' },
        ),
        400: t.Object({ message: t.String() }, { description: '에러 메시지' }),
        404: t.Object({ message: t.String() }),
      },
      detail: { summary: '학교 검색' },
    },
  )
  .get(
    '/meal',
    async ({ query }) => {
      const { schoolCode, regionCode, year, month, day, showAllergy, showOrigin, showNutrition } = query;
      if (!schoolCode) throw error(400, { message: '학교 코드를 입력해주세요.' });
      if (!regionCode) throw error(400, { message: '지역 코드를 입력해주세요.' });
      if (!year) throw error(400, { message: '년도를 입력해주세요.' });
      if (!month) throw error(400, { message: '월을 입력해주세요.' });
      return getMeal(schoolCode, regionCode, `${year}${month.padStart(2, '0')}${day ? day.padStart(2, '0') : ''}`, showAllergy, showOrigin, showNutrition);
    },
    {
      query: t.Object({
        schoolCode: t.String({ description: '학교 코드', error: { message: '학교 코드는 문자열이어야 해요.' } }),
        regionCode: t.String({ description: '지역 코드', error: { message: '지역 코드는 문자열이어야 해요.' } }),
        year: t.String({ description: '년도', error: { message: '년도는 문자열이어야 해요.' } }),
        month: t.String({ description: '월', error: { message: '월은 문자열이어야 해요.' } }),
        day: t.Optional(t.String({ description: '일', error: { message: '일은 문자열이어야 해요.' } })),
        showAllergy: t.Boolean({ description: '알레르기 정보 표시 여부', default: false, error: { message: '알레르기 정보 표시 여부는 불이어야 해요.' } }),
        showOrigin: t.Boolean({ description: '원산지 정보 표시 여부', default: false, error: { message: '원산지 정보 표시 여부는 불이어야 해요.' } }),
        showNutrition: t.Boolean({ description: '영양 정보 표시 여부', default: false, error: { message: '영양 정보 표시 여부는 불이어야 해요.' } }),
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
                    }),
                  ),
                }),
                { description: '급식' },
              ),
            ]),
            type: t.String({ description: '급식 종류', default: '중식' }),
            origin: t.Optional(
              t.Array(
                t.Object({
                  food: t.String({ description: '음식 이름', default: '김치찌개' }),
                  origin: t.String({ description: '원산지', default: '국내산' }),
                }),
              ),
            ),
            calorie: t.String({ description: '칼로리', default: '1234' }),
            nutrition: t.Optional(
              t.Array(
                t.Object({
                  type: t.String({ description: '영양소 종류', default: '탄수화물(g)' }),
                  amount: t.String({ description: '영양소 양', default: '147.4' }),
                }),
              ),
            ),
          }),
          { description: '급식 정보' },
        ),
        400: t.Object({ message: t.String() }, { description: '에러 메시지' }),
        404: t.Object({ message: t.String() }),
      },
      detail: { summary: '급식 정보' },
    },
  )
  .get(
    '/schedule',
    async ({ query }) => {
      const { schoolCode, regionCode, year, month, day } = query;
      if (!schoolCode) throw error(400, { message: '학교 코드를 입력해주세요.' });
      if (!regionCode) throw error(400, { message: '지역 코드를 입력해주세요.' });
      if (!year) throw error(400, { message: '년도를 입력해주세요.' });
      if (!month) throw error(400, { message: '월을 입력해주세요.' });

      try {
        const fetchedSchedules = await neis.getSchedule({
          SD_SCHUL_CODE: schoolCode,
          ATPT_OFCDC_SC_CODE: regionCode,
          AA_YMD: `${year}${month.padStart(2, '0')}${day ? day.padStart(2, '0') : ''}`,
        });

        const schedulesMap: { [key: string]: { start: string; end: string; schedules: string[] } } = {};

        fetchedSchedules.forEach((s) => {
          if (s.EVENT_NM === '토요휴업일') return;

          const formattedDate = `${s.AA_YMD.slice(0, 4)}-${s.AA_YMD.slice(4, 6)}-${s.AA_YMD.slice(6, 8)}`;

          if (!schedulesMap[formattedDate]) {
            schedulesMap[formattedDate] = { start: formattedDate, end: formattedDate, schedules: [s.EVENT_NM] };
          } else {
            schedulesMap[formattedDate].schedules.push(s.EVENT_NM);
          }
        });

        const schedules = Object.entries(schedulesMap).map(([_, { start, end, schedules }]) => ({
          schedule: schedules.join(', '),
          date: { start, end },
        }));

        const combinedSchedules = [];
        let prevSchedule = null;

        for (const schedule of schedules) {
          if (prevSchedule && prevSchedule.schedule === schedule.schedule) {
            prevSchedule.date.end = schedule.date.end;
          } else {
            if (prevSchedule) combinedSchedules.push(prevSchedule);
            prevSchedule = schedule;
          }
        }

        if (prevSchedule) combinedSchedules.push(prevSchedule);

        return combinedSchedules;
      } catch (e) {
        const err = e as Error;
        const message = err.message.replace(/INFO-\d+\s*/g, '');

        if (message === '해당하는 데이터가 없습니다.') throw error(404, { message });
        else throw error(400, { message: err.message.replace(/INFO-\d+\s*/g, '') });
      }
    },
    {
      query: t.Object({
        schoolCode: t.String({ description: '학교 코드', error: { message: '학교 코드는 문자열이어야 해요.' } }),
        regionCode: t.String({ description: '지역 코드', error: { message: '지역 코드는 문자열이어야 해요.' } }),
        year: t.String({ description: '년도', error: { message: '년도는 문자열이어야 해요.' } }),
        month: t.String({ description: '월', error: { message: '월은 문자열이어야 해요.' } }),
        day: t.Optional(t.String({ description: '일', error: { message: '일은 문자열이어야 해요.' } })),
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
          { description: '일정 정보' },
        ),
        400: t.Object({ message: t.String() }, { description: '에러 메시지' }),
        404: t.Object({ message: t.String() }),
      },
      detail: { summary: '일정 정보' },
    },
  );

export default app;
