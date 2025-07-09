import cron, { Patterns } from '@elysiajs/cron';
import Neis from 'neis.ts';

import { db } from './db';
import { error } from 'elysia';

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

const mealCollection = db.openDB({ name: 'meal' });
const schoolCollection = db.openDB({ name: 'school', dupSort: true });
const schoolInformationCollection = db.openDB({ name: 'schoolInformation' });

interface Meal {
  date: string;
  meal: { food: string; allergy: { type: string; code: string }[] }[] | string[];
  type: string;
  origin: { food: string; origin: string }[] | undefined;
  calorie: string;
  nutrition: { type: string; amount: string }[] | undefined;
  school_code?: string;
  region_code?: string;
}

export interface Cache extends Meal {
  meal: { food: string; allergy: { type: string; code: string }[] }[];
  origin: { food: string; origin: string }[];
  nutrition: { type: string; amount: string }[];
  region_code: string;
  school_code: string;
}

export const refreshCache = cron({
  name: 'refresh',
  pattern: Patterns.EVERY_DAY_AT_1AM,
  async run() {
    console.log('start refresh cache');
    await mealCollection.clearAsync();
    console.log('refresh cache finished');
  },
});

export const refreshSchoolCache = cron({
  name: 'refreshSchool',
  pattern: Patterns.EVERY_WEEKEND,
  async run() {
    console.log('start refresh school cache');
    await schoolCollection.clearAsync();
    await schoolInformationCollection.clearAsync();
    console.log('refresh school cache finished');
  },
});

export async function getMeal(school_code: string, region_code: string, mlsv_ymd: string, showAllergy: boolean = false, showOrigin: boolean = false, showNutrition: boolean = false): Promise<Meal[]> {
  try {
    const db_date = mlsv_ymd.slice(0, 4) + '-' + mlsv_ymd.slice(4, 6) + '-' + mlsv_ymd.slice(6, 8);
    const cachedMeal: Cache | undefined | null = mealCollection.get(`${region_code}_${school_code}_${db_date}`);
    const unwrap = (x: string | null | undefined) => {
      return x ?? '';
    };
    if (cachedMeal != null && cachedMeal != undefined) {
      let v = cachedMeal;
      return [
        {
          date: v.date,
          meal: showAllergy
            ? v.meal.map((v) => {
                return {
                  food: v.food,
                  allergy: v.allergy.map((val) => {
                    return { type: val.type, code: val.code };
                  }),
                };
              })
            : v.meal.map((v) => v.food),
          type: unwrap(v.type),
          origin: showOrigin
            ? v.origin.map((val) => {
                return { food: val.food, origin: val.origin };
              })
            : undefined,
          calorie: unwrap(v.calorie),
          nutrition: showNutrition
            ? v.nutrition.map((val) => {
                return { type: val.type, amount: val.amount };
              })
            : undefined,
        },
      ];
    }

    const fetchedMeals = await neis.getMeal({
      SD_SCHUL_CODE: school_code,
      ATPT_OFCDC_SC_CODE: region_code,
      MLSV_YMD: mlsv_ymd,
    });

    const meals: Meal[] = await Promise.all(
      fetchedMeals.map(async (m) => {
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

        const resp_db: Cache = {
          date: `${m.MLSV_YMD.slice(0, 4)}-${m.MLSV_YMD.slice(4, 6)}-${m.MLSV_YMD.slice(6, 8)}`, // YYYYMMDD -> YYYY-MM-DD
          meal: foods,
          type: m.MMEAL_SC_NM,
          origin: origin,
          calorie: m.CAL_INFO.replace('Kcal', '').trim(),
          nutrition: nutrition,
          school_code: school_code,
          region_code: region_code,
        };

        if (!mealCollection.doesExist(`${region_code}_${school_code}_${resp_db.date}`)) {
          await mealCollection.put(`${region_code}_${school_code}_${resp_db.date}`, resp_db);
        }

        const resp: Meal = resp_db;

        if (!showAllergy) resp.meal = foods.map((v) => v.food);
        if (!showOrigin) resp.origin = undefined;
        if (!showNutrition) resp.nutrition = undefined;
        delete resp.school_code;
        delete resp.region_code;
        return resp;
      })
    );

    return meals;
  } catch (e) {
    const err = e as Error;
    const message = err.message.replace(/INFO-\d+\s*/g, '');
    if (message === '해당하는 데이터가 없습니다.') throw error(404, { message });
    else throw error(400, { message: err.message.replace(/INFO-\d+\s*/g, '') });
  }
}

export interface SchoolSearchResult {
  schoolName: string;
  schoolCode: string;
  region: string;
  regionCode: string;
}

export async function search(schoolName: string): Promise<SchoolSearchResult[]> {
  const school: string[] = Array.from(schoolCollection.getValues(schoolName));
  if (school.length > 0) {
    return school.map((s) => schoolInformationCollection.get(s) as SchoolSearchResult).sort((a, b) => a.schoolName.localeCompare(b.schoolName));
  }
  try {
    const searchedSchools = await neis.getSchool({
      SCHUL_NM: schoolName,
      pSize: 100,
    });

    const schools = searchedSchools
      .filter((school) => school.SCHUL_KND_SC_NM !== '초등학교')
      .map((school) => ({
        schoolName: school.SCHUL_NM,
        schoolCode: school.SD_SCHUL_CODE,
        region: school.ATPT_OFCDC_SC_NM,
        regionCode: school.ATPT_OFCDC_SC_CODE,
      }));

    for (const school of schools) {
      await schoolCollection.put(schoolName, school.schoolName);
      if (schoolInformationCollection.doesExist(school.schoolName)) continue;
      await schoolInformationCollection.put(school.schoolName, school);
    }

    return schools;
  } catch (e) {
    const err = e as Error;
    const message = err.message.replace(/INFO-\d+\s*/g, '');

    if (message === '해당하는 데이터가 없습니다.') throw error(404, { message });
    else throw error(400, { message: err.message.replace(/INFO-\d+\s*/g, '') });
  }
}
