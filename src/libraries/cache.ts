import cron, { Patterns } from '@elysiajs/cron';
import Neis from 'neis.ts';

import { db } from './db';
import { ALLERGY_TYPES, DB_COLLECTIONS } from '../constants';
import { handleNeisError } from '../utils/errors';
import { formatDate } from '../utils/validation';
import { trackSchoolAccess } from '../services/access-tracker';
import type { Cache, Meal, SchoolSearchResult, MealItem, Origin, Nutrition } from '../types';

export const neis = new Neis({
  key: process.env.NEIS_API_KEY,
  timeout: 10000, // 10초 타임아웃 (기본값 5초에서 증가)
});

const mealCollection = db.openDB({ name: DB_COLLECTIONS.MEAL });
const schoolCollection = db.openDB({ name: DB_COLLECTIONS.SCHOOL, dupSort: true });
const schoolInformationCollection = db.openDB({ name: DB_COLLECTIONS.SCHOOL_INFORMATION });


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

function parseMealData(dishName: string): MealItem[] {
  return dishName.split('<br/>').map((item) => {
    const [food, allergyCodes] = item.split(' (').map((str) => str.trim());
    const allergies = allergyCodes
      ? allergyCodes
          .replace(')', '')
          .split('.')
          .map((code) => ({
            type: ALLERGY_TYPES[parseInt(code)],
            code,
          }))
      : [];
    return { food, allergy: allergies };
  });
}

function parseOriginData(originInfo: string): Origin[] {
  return originInfo
    .split('<br/>')
    .map((item) => {
      const [food, origin] = item.split(' : ');
      return { food, origin };
    })
    .filter(({ food }) => food !== '비고');
}

function parseNutritionData(nutritionInfo: string): Nutrition[] {
  return nutritionInfo.split('<br/>').map((item) => {
    const [type, amount] = item.split(' : ');
    return { type, amount };
  });
}

function formatMealResponse(
  cachedMeal: Cache,
  showAllergy: boolean,
  showOrigin: boolean,
  showNutrition: boolean
): Meal {
  return {
    date: cachedMeal.date,
    meal: showAllergy
      ? cachedMeal.meal
      : cachedMeal.meal.map((v) => v.food),
    type: cachedMeal.type ?? '',
    origin: showOrigin ? cachedMeal.origin : undefined,
    calorie: cachedMeal.calorie ?? '',
    nutrition: showNutrition ? cachedMeal.nutrition : undefined,
  };
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
    // Track school access for popularity metrics
    trackSchoolAccess(school_code, region_code);

    const db_date = formatDate(mlsv_ymd);
    const cacheKey = `${region_code}_${school_code}_${db_date}`;
    const cachedMeal = mealCollection.get(cacheKey) as Cache | undefined | null;

    if (cachedMeal != null && cachedMeal != undefined) {
      return [formatMealResponse(cachedMeal, showAllergy, showOrigin, showNutrition)];
    }

    const fetchedMeals = await neis.getMeal({
      SD_SCHUL_CODE: school_code,
      ATPT_OFCDC_SC_CODE: region_code,
      MLSV_YMD: mlsv_ymd,
    });

    const meals: Meal[] = await Promise.all(
      fetchedMeals.map(async (m) => {
        const foods = parseMealData(m.DDISH_NM);
        const origin = parseOriginData(m.ORPLC_INFO);
        const nutrition = parseNutritionData(m.NTR_INFO);

        const cacheData: Cache = {
          date: formatDate(m.MLSV_YMD),
          meal: foods,
          type: m.MMEAL_SC_NM,
          origin: origin,
          calorie: m.CAL_INFO.replace('Kcal', '').trim(),
          nutrition: nutrition,
          school_code: school_code,
          region_code: region_code,
        };

        const cacheKey = `${region_code}_${school_code}_${cacheData.date}`;
        if (!mealCollection.doesExist(cacheKey)) {
          await mealCollection.put(cacheKey, cacheData);
        }

        return formatMealResponse(cacheData, showAllergy, showOrigin, showNutrition);
      })
    );

    return meals;
  } catch (e) {
    handleNeisError(e as Error);
  }
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
    handleNeisError(e as Error);
  }
}
