import cron, { Patterns } from '@elysiajs/cron';
import * as db from 'mongoose';
import Neis from 'neis.ts';

import { MealSchema } from './schema';

await db.connect(process.env.MONGO_URI ?? '');

const allergyTypes: Record<number, string> = {
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

export const neis = new Neis({
	key: process.env.NEIS_API_KEY,
});

export const cronjob = cron({
	name: 'refresh',
	pattern: Patterns.EVERY_DAY_AT_1AM,
	async run() {
		console.log('start refresh cache');
		const now = new Date();
		for await (const v of MealSchema.find()) {
			const dateValue: string = v.date ?? '2021-01-01';
			const date = new Date(dateValue);
			date.setHours(23, 59, 59);
			if (date < now) {
				await v.deleteOne();
			}
		}
		console.log('refresh cache finished');
	},
});

export interface Meal {
	date: string;
	meal: string[];
	type: string;
	origin: { food: string; origin: string }[];
	calorie: string;
	nutrition: { type: string; amount: string }[];
}

export async function getMeal(school_code: string, region_code: string, mlsv_ymd: string, forceFetch: boolean = false): Promise<Meal[]> {
	const cachedMeals: MealSchema[] = forceFetch ? [] : await MealSchema.find({ school_code: school_code }).exec();
  const unwrap = (x: string | null | undefined) => {return x ?? ""}
	if (cachedMeals.length != 0) {
		return cachedMeals.map((v) => {
      return {
        date: unwrap(v.date),
        meal: v.meal,
        type: unwrap(v.type),
        origin: v.origin.map((val) => {return {food: unwrap(val.food), origin: unwrap(val.origin)}}),
        calorie: unwrap(v.calorie),
        nutrition: v.nutrition.map((val) => {return {type: val.type, amount: val.amount}})
      }
    });
	}
	const fetchedMeals = await neis.getMeal({
		SD_SCHUL_CODE: school_code,
		ATPT_OFCDC_SC_CODE: region_code,
		MLSV_YMD: mlsv_ymd,
	});

	const meals: Meal[] = fetchedMeals.map((m) => {
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

		return {
			date: `${m.MLSV_YMD.slice(0, 4)}-${m.MLSV_YMD.slice(4, 6)}-${m.MLSV_YMD.slice(6, 8)}`, // YYYYMMDD -> YYYY-MM-DD
			meal: foods.map((item) => item.food),
			type: m.MMEAL_SC_NM,
			origin: origin,
			calorie: m.CAL_INFO.replace('Kcal', '').trim(),
			nutrition: nutrition,
		};
	});

	meals.forEach(async (v: Meal) => {
		await new MealSchema(v).save();
	});

	return meals;
}
