import { Elysia, error, t } from 'elysia';
import Neis from 'neis.ts';

const neis = new Neis({
	key: process.env.NEIS_API_KEY,
});

const app = new Elysia({ prefix: '/neis', tags: ['나이스'] })
	.get(
		'/search',
		async ({ query }) => {
			const { schoolName } = query;
			if (!schoolName) throw error(400, { message: '학교 이름을 입력해주세요.' });

			try {
				const searchedSchools = await neis.getSchool({
					SCHUL_NM: schoolName,
					pSize: 100,
				});

				return searchedSchools
					.filter((school) => school.SCHUL_KND_SC_NM !== '초등학교')
					.map((school) => ({
						schoolName: school.SCHUL_NM,
						schoolCode: school.SD_SCHUL_CODE,
						region: school.ATPT_OFCDC_SC_NM,
						regionCode: school.ATPT_OFCDC_SC_CODE,
					}));
			} catch (e) {
				const err = e as Error;

				throw error(400, { message: err.message });
			}
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
					{ description: '검색된 학교 목록' }
				),
				400: t.Object({ message: t.String() }, { description: '에러 메시지' }),
			},
			detail: { summary: '학교 검색' },
		}
	)
	.get(
		'/meal',
		async ({ query }) => {
			const { schoolCode, regionCode, year, month, day, showAllergy, showOrigin, showNutrition } = query;
			if (!schoolCode) throw error(400, { message: '학교 코드를 입력해주세요.' });
			if (!regionCode) throw error(400, { message: '지역 코드를 입력해주세요.' });
			if (!year) throw error(400, { message: '년도를 입력해주세요.' });
			if (!month) throw error(400, { message: '월을 입력해주세요.' });

			try {
				const fetchedMeals = await neis.getMeal({
					SD_SCHUL_CODE: schoolCode,
					ATPT_OFCDC_SC_CODE: regionCode,
					MLSV_YMD: `${year}${month.padStart(2, '0')}${day ? day.padStart(2, '0') : ''}`,
				});

				const allergyTypes: { [key: number]: string } = {
					1: '난류',
					2: '우유',
					3: '메밀',
					4: '땅콩',
					5: '대두',
					6: '밀',
					7: '고등어',
					8: '게',
					9: '새우',
					10: '돼지고기',
					11: '복숭아',
					12: '토마토',
					13: '아황산류',
					14: '호두',
					15: '닭고기',
					16: '쇠고기',
					17: '오징어',
					18: '조개류(굴, 전복, 홍합 포함)',
					19: '잣',
				};

				const meals = fetchedMeals.map((m) => {
					const foods = m.DDISH_NM.split('<br/>').map((item) => {
						const [food, allergyCodes] = item.split(' (').map((str) => str.trim());
						const allergies = allergyCodes
							? allergyCodes
									.replace(')', '')
									.split('.')
									.map((code) => ({
										type: allergyTypes[parseInt(code)],
										code,
									}))
							: [];
						return { food, allergy: allergies };
					});

					const origin = m.ORPLC_INFO.split('<br/>')
						.map((item) => {
							const [food, origin] = item.split(' : ');
							return { food, origin };
						})
						.filter(({ food }) => food !== '비고');

					const nutrition = m.NTR_INFO.split('<br/>').map((item) => {
						const [type, amount] = item.split(' : ');
						return { type, amount };
					});

					const mealResponse = showAllergy ? foods : foods.map((item) => item.food);
					const originResponse = showOrigin ? origin : undefined;
					const nutritionResponse = showNutrition ? nutrition : undefined;

					return {
						date: m.MLSV_YMD,
						meal: mealResponse,
						type: m.MMEAL_SC_NM,
						origin: originResponse,
						calorie: m.CAL_INFO.replace('Kcal', '').trim(),
						nutrition: nutritionResponse,
					};
				});

				return meals;
			} catch (e) {
				const err = e as Error;

				throw error(400, { message: err.message });
			}
		},
		{
			query: t.Object({
				schoolCode: t.String({ description: '학교 코드', error: { message: '학교 코드는 문자열이어야 해요.' } }),
				regionCode: t.String({ description: '지역 코드', error: { message: '지역 코드는 문자열이어야 해요.' } }),
				year: t.String({ description: '년도', error: { message: '년도는 문자열이어야 해요.' } }),
				month: t.String({ description: '월', error: { message: '월은 문자열이어야 해요.' } }),
				day: t.String({ description: '일', error: { message: '일은 문자열이어야 해요.' } }),
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
			},
			detail: { summary: '급식 정보' },
		}
	);

export default app;
