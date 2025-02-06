import { Elysia, error, t } from 'elysia';
import Comcigan, { School, Weekday } from 'comcigan.ts';

const comcigan = new Comcigan();

const app = new Elysia({ prefix: '/school', tags: ['학교'] })
	.get(
		'/search',
		async ({ query }) => {
			if (!query.schoolName) throw error(400, { message: '학교 이름을 입력해주세요.' });
			const searchedSchools: School[] = await comcigan.searchSchools(query.schoolName);

			return searchedSchools
				.filter((school) => school.code !== 0) // 없으면 추가 검색하세요 제외
				.map((school) => ({
					schoolName: school.name,
					schoolCode: school.code,
					region: school.region.name,
				}));
		},
		{
			query: t.Object({
				schoolName: t.String({ description: '학교 이름', error: { message: '학교 이름은 문자열이어야 해요.' } }),
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
			const { schoolCode, grade, class: classNum, weekday } = query;
			if (!schoolCode) throw error(400, '학교 코드를 입력해주세요.');
			if (!grade) throw error(400, '학년을 입력해주세요.');
			if (!classNum) throw error(400, '반을 입력해주세요.');

			try {
				const timetable = weekday ? await comcigan.getTimetable(schoolCode, grade, classNum, weekday as never as Weekday) : await comcigan.getTimetable(schoolCode, grade, classNum);
				return timetable;
			} catch (e) {
				const err = e as Error;

				if (err.message === "undefined is not an object (evaluating 'teachers.length')") throw error(404, { message: '학교를 찾을 수 없어요.' });
				else if (err.message === "undefined is not an object (evaluating 'raw[grade - 1][cls - 1][day - 1]')") throw error(404, { message: '시간표를 찾을 수 없어요.' });
				else throw error(500, { message: '알 수 없는 오류가 발생했어요.' });
			}
		},
		{
			query: t.Object({
				schoolCode: t.Number({ description: '학교 코드', error: { message: '학교 코드는 숫자여야 해요.' } }),
				grade: t.Number({ description: '학년', error: { message: '학년은 숫자여야 해요.' } }),
				class: t.Number({ description: '반', error: { message: '반은 숫자여야 해요.' } }),
				weekday: t.Optional(t.UnionEnum(['1', '2', '3', '4', '5'], { description: '요일', default: undefined, error: { message: '요일은 1부터 5까지의 숫자여야 해요.' } })),
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
			const { schoolCode } = query;
			if (!schoolCode) throw error(400, '학교 코드를 입력해주세요.');

			try {
				const timetable = await comcigan.getTimetable(schoolCode);

				return timetable.map((grade, gradeIndex) => ({
					grade: gradeIndex + 1,
					classes: grade.map((_, classIndex) => classIndex + 1),
				}));
			} catch (e) {
				const err = e as Error;

				if (err.message === "undefined is not an object (evaluating 'teachers.length')") throw error(404, { message: '학교를 찾을 수 없어요.' });
				else throw error(500, { message: '알 수 없는 오류가 발생했어요.' });
			}
		},
		{
			query: t.Object({
				schoolCode: t.Number({ description: '학교 코드', error: { message: '학교 코드는 숫자여야 해요.' } }),
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
