import cron, { Patterns } from '@elysiajs/cron';
import * as db from 'mongoose';
import Neis from 'neis.ts';

import { MealSchema } from './schema';
import { error } from 'elysia';

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
  meal: { food: string, allergy: {type: string, code: string }[]}[] | string[];
  type: string;
  origin: { food: string; origin: string }[] | undefined;
  calorie: string;
  nutrition: { type: string; amount: string }[] | undefined;
}

interface Cache extends Meal {
  school_code: string,
  region_code: string
}

export async function getMeal(
  school_code: string,
  region_code: string,
  mlsv_ymd: string,
  showAllergy: boolean = false,
  showOrigin: boolean = false,
  showNutrition: boolean = false
): Promise<Meal[]> {
  try {
    const cachedMeals: MealSchema[] = await MealSchema.find({
      school_code: school_code,
      region_code: region_code,
      date: `${mlsv_ymd.slice(0, 4)}-${mlsv_ymd.slice(4, 6)}-${mlsv_ymd.slice(6, 8)}`
    }).exec();
    const unwrap = (x: string | null | undefined) => {return x ?? ""}
    if (cachedMeals.length != 0) {
      return cachedMeals.map((v) => {
        return {
          date: unwrap(v.date),
          meal: showAllergy ?
            v.meal.map((v)=>{
              return {
                food: unwrap(v.food),
                allergy: v.allergy.map((val) => {return {type: val.type, code: val.code}})
              }
            }):v.meal.map((v)=>v.food),
          type: unwrap(v.type),
          origin: showOrigin ? v.origin.map((val) => {return {food: unwrap(val.food), origin: unwrap(val.origin)}}): undefined,
          calorie: unwrap(v.calorie),
          nutrition: showNutrition ? v.nutrition.map((val) => {return {type: val.type, amount: val.amount}}): undefined
        }
      });
    }

    const fetchedMeals = await neis.getMeal({
      SD_SCHUL_CODE: school_code,
      ATPT_OFCDC_SC_CODE: region_code,
      MLSV_YMD: mlsv_ymd,
    });

    const meals: Meal[] = await Promise.all(fetchedMeals.map(async (m) => {
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

      const resp: Meal = {
        date: `${m.MLSV_YMD.slice(0, 4)}-${m.MLSV_YMD.slice(4, 6)}-${m.MLSV_YMD.slice(6, 8)}`, // YYYYMMDD -> YYYY-MM-DD
        meal: foods,
        type: m.MMEAL_SC_NM,
        origin: origin,
        calorie: m.CAL_INFO.replace('Kcal', '').trim(),
        nutrition: nutrition,
      };
      if (await MealSchema.findOne({date: resp.date, region_code, school_code}).exec() == null) {
        const resp_db = {...resp, school_code, region_code};
        await (new MealSchema(resp_db).save());
      }

      if (!showAllergy) resp["meal"] = foods.map((v) => v.food);
      if (!showOrigin) resp["origin"] = undefined;
      if (!showNutrition) resp["nutrition"] = undefined;
      return resp
    }));

    return meals;
  } catch (e) {
    const err = e as Error;
    const message = err.message.replace(/INFO-\d+\s*/g, '');
    if (message === '해당하는 데이터가 없습니다.') throw error(404, { message });
    else throw error(400, { message: err.message.replace(/INFO-\d+\s*/g, '') });
  }
}
