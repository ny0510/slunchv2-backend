import { Elysia, error, t } from 'elysia';
import { getPopularSchools, getAllPopularSchools } from '../libraries/cache';

const password = process.env.ADMIN_KEY;
if (password === undefined) {
  throw new Error('ADMIN_KEY is not defined');
}
const hash = await Bun.password.hash(password);

const app = new Elysia({ prefix: '/admin', tags: ['관리자'] })
  .get(
    '/popular-schools',
    async ({ headers }) => {
      const { token } = headers;
      if (!token) throw error(400, { message: '토큰을 입력해주세요.' });

      if (!(await Bun.password.verify(token, hash))) {
        throw error(403, { message: '권한이 없습니다.' });
      }

      const statsBasedSchools = await getPopularSchools();
      const allPopularSchools = await getAllPopularSchools();

      return {
        statsBasedSchools,
        allPopularSchools,
        totalStatsBasedCount: statsBasedSchools.length,
        totalPopularCount: allPopularSchools.length,
      };
    },
    {
      headers: t.Object({
        token: t.String({ description: '관리자 토큰' }),
      }),
      detail: { summary: '인기 학교 통계 조회' },
      response: {
        200: t.Object({
          statsBasedSchools: t.Array(
            t.Object({
              schoolCode: t.String({ description: '학교 코드' }),
              regionCode: t.String({ description: '지역 코드' }),
              requestCount: t.Number({ description: '요청 횟수' }),
            })
          ),
          allPopularSchools: t.Array(
            t.Object({
              schoolCode: t.String({ description: '학교 코드' }),
              regionCode: t.String({ description: '지역 코드' }),
            })
          ),
          totalStatsBasedCount: t.Number({ description: '통계 기반 인기 학교 수' }),
          totalPopularCount: t.Number({ description: '전체 인기 학교 수' }),
        }),
        400: t.Object({ message: t.String() }, { description: '에러 메시지' }),
        403: t.Object({ message: t.String() }),
      },
    }
  )
  .post(
    '/force-preload',
    async ({ headers }) => {
      const { token } = headers;
      if (!token) throw error(400, { message: '토큰을 입력해주세요.' });

      if (!(await Bun.password.verify(token, hash))) {
        throw error(403, { message: '권한이 없습니다.' });
      }

      // 강제로 preload 실행
      try {
        const { getAllPopularSchools, getMeal } = await import('../libraries/cache');
        const popularSchools = await getAllPopularSchools();

        const today = new Date();
        const tomorrow = new Date(today);
        tomorrow.setDate(tomorrow.getDate() + 1);

        const dates = [`${today.getFullYear()}${String(today.getMonth() + 1).padStart(2, '0')}${String(today.getDate()).padStart(2, '0')}`, `${tomorrow.getFullYear()}${String(tomorrow.getMonth() + 1).padStart(2, '0')}${String(tomorrow.getDate()).padStart(2, '0')}`];

        let preloadedCount = 0;
        for (const school of popularSchools) {
          for (const date of dates) {
            try {
              await getMeal(school.schoolCode, school.regionCode, date);
              preloadedCount++;
              await new Promise((resolve) => setTimeout(resolve, 100)); // API 과부하 방지
            } catch (err) {
              console.error(`Failed to preload ${school.schoolCode} for ${date}:`, err);
            }
          }
        }

        return {
          message: `인기 학교 선제적 캐싱이 완료되었습니다. (${preloadedCount}건 처리)`,
          schoolsCount: popularSchools.length,
          preloadedCount,
        };
      } catch (err) {
        console.error('Force preload error:', err);
        throw error(500, { message: '선제적 캐싱 중 오류가 발생했습니다.' });
      }
    },
    {
      headers: t.Object({
        token: t.String({ description: '관리자 토큰' }),
      }),
      detail: { summary: '인기 학교 선제적 캐싱 강제 실행' },
      response: {
        200: t.Object({
          message: t.String(),
          schoolsCount: t.Number({ description: '대상 학교 수' }),
          preloadedCount: t.Number({ description: '실제 캐싱된 건수' }),
        }),
        400: t.Object({ message: t.String() }, { description: '에러 메시지' }),
        403: t.Object({ message: t.String() }),
        500: t.Object({ message: t.String() }),
      },
    }
  );

export default app;
