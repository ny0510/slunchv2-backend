import Neis from 'neis.ts';

import { getCache, setCache, getCacheRange, getCacheValues, CacheCollection } from './cache';
import { ALLERGY_TYPES } from '../constants';
import { handleNeisError } from '../utils/errors';
import { formatDate } from '../utils/validation';
import { trackSchoolAccess } from '../services/access-tracker';
import type { Cache, Meal, SchoolSearchResult, MealItem, Origin, Nutrition, ScheduleItem, ScheduleCache } from '../types';

export const neis = new Neis({
  key: process.env.NEIS_API_KEY,
  timeout: 60000, // 1분 타임아웃 (기본값 5초에서 증가)
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
  const startTime = Date.now();
  try {
    // Track school access for popularity metrics
    trackSchoolAccess(school_code, region_code);

    const isMonthQuery = mlsv_ymd.length === 6; // YYYYMM format
    const cacheCheckStart = Date.now();

    if (isMonthQuery) {
      // 월 단위 조회: 캐시된 모든 급식 중 해당 월의 데이터 확인
      const year = mlsv_ymd.slice(0, 4);
      const month = mlsv_ymd.slice(4, 6);
      const cachePrefix = `${region_code}_${school_code}_${year}-${month}`;
      
      const cachedMeals: Meal[] = [];
      for (const { key, value } of getCacheRange(CacheCollection.MEAL, cachePrefix, cachePrefix + '\xFF')) {
        if (typeof key === 'string' && key.startsWith(cachePrefix)) {
          cachedMeals.push(formatMealResponse(value as Cache, showAllergy, showOrigin, showNutrition));
        }
      }
      console.log(`[MEAL] Monthly cache check took ${Date.now() - cacheCheckStart}ms`);
      
      if (cachedMeals.length > 0) {
        console.log(`[MEAL] Monthly cache HIT for ${cachePrefix} - Found ${cachedMeals.length} meals - Total: ${Date.now() - startTime}ms`);
        return cachedMeals.sort((a, b) => a.date.localeCompare(b.date));
      }
      console.log(`[MEAL] Monthly cache MISS for ${cachePrefix} - Fetching from NEIS API`);
    } else {
      // 일 단위 조회: 기존 로직
      const db_date = formatDate(mlsv_ymd);
      const cacheKey = `${region_code}_${school_code}_${db_date}`;
      const cachedMeal = getCache<Cache>(CacheCollection.MEAL, cacheKey);
      console.log(`[MEAL] Cache check took ${Date.now() - cacheCheckStart}ms`);

      if (cachedMeal != null && cachedMeal != undefined) {
        console.log(`[MEAL] Cache HIT for ${cacheKey} - Total: ${Date.now() - startTime}ms`);
        return [formatMealResponse(cachedMeal, showAllergy, showOrigin, showNutrition)];
      }
      console.log(`[MEAL] Cache MISS for ${cacheKey} - Fetching from NEIS API`);
    }

    const apiStart = Date.now();
    const fetchedMeals = await neis.getMeal({
      SD_SCHUL_CODE: school_code,
      ATPT_OFCDC_SC_CODE: region_code,
      MLSV_YMD: mlsv_ymd,
    });
    console.log(`[MEAL] NEIS API call took ${Date.now() - apiStart}ms`);

    const parseStart = Date.now();
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
        await setCache(CacheCollection.MEAL, cacheKey, cacheData);

        return formatMealResponse(cacheData, showAllergy, showOrigin, showNutrition);
      })
    );
    console.log(`[MEAL] Parse & cache took ${Date.now() - parseStart}ms`);
    console.log(`[MEAL] Total request time: ${Date.now() - startTime}ms`);

    return meals;
  } catch (e) {
    handleNeisError(e as Error);
  }
}

export async function search(schoolName: string): Promise<SchoolSearchResult[]> {
  const startTime = Date.now();

  const cacheCheckStart = Date.now();
  const school: string[] = getCacheValues<string>(CacheCollection.SCHOOL, schoolName);
  console.log(`[SEARCH] Cache check took ${Date.now() - cacheCheckStart}ms`);

  if (school.length > 0) {
    console.log(`[SEARCH] Cache HIT for "${schoolName}" - Found ${school.length} schools - Total: ${Date.now() - startTime}ms`);
    return school
      .map((s) => getCache<SchoolSearchResult>(CacheCollection.SCHOOL_INFORMATION, s))
      .filter((s): s is SchoolSearchResult => s != null)
      .sort((a, b) => a.schoolName.localeCompare(b.schoolName));
  }

  console.log(`[SEARCH] Cache MISS for "${schoolName}" - Fetching from NEIS API`);
  try {
    const apiStart = Date.now();
    const searchedSchools = await neis.getSchool({
      SCHUL_NM: schoolName,
      pSize: 100,
    });
    console.log(`[SEARCH] NEIS API call took ${Date.now() - apiStart}ms`);

    const parseStart = Date.now();
    const schools = searchedSchools
      .filter((school) => school.SCHUL_KND_SC_NM !== '초등학교')
      .map((school) => ({
        schoolName: school.SCHUL_NM,
        schoolCode: school.SD_SCHUL_CODE,
        region: school.ATPT_OFCDC_SC_NM,
        regionCode: school.ATPT_OFCDC_SC_CODE,
      }));

    const cacheWriteStart = Date.now();
    for (const school of schools) {
      await setCache(CacheCollection.SCHOOL, schoolName, school.schoolName, true);
      const existing = getCache(CacheCollection.SCHOOL_INFORMATION, school.schoolName);
      if (!existing) {
        await setCache(CacheCollection.SCHOOL_INFORMATION, school.schoolName, school);
      }
    }
    console.log(`[SEARCH] Cache write took ${Date.now() - cacheWriteStart}ms`);
    console.log(`[SEARCH] Total request time: ${Date.now() - startTime}ms - Found ${schools.length} schools`);

    return schools;
  } catch (e) {
    handleNeisError(e as Error);
  }
}

export async function getSchedule(
  schoolCode: string,
  regionCode: string,
  dateFormatted: string
): Promise<ScheduleItem[]> {
  const startTime = Date.now();
  try {
    const cacheKey = `${regionCode}_${schoolCode}_${dateFormatted}`;

    const cacheCheckStart = Date.now();
    const cachedSchedule = getCache<ScheduleCache>(CacheCollection.SCHEDULE, cacheKey);
    console.log(`[SCHEDULE] Cache check took ${Date.now() - cacheCheckStart}ms`);

    if (cachedSchedule != null && cachedSchedule != undefined) {
      console.log(`[SCHEDULE] Cache HIT for ${cacheKey} - Total: ${Date.now() - startTime}ms`);
      return cachedSchedule.schedules;
    }

    console.log(`[SCHEDULE] Cache MISS for ${cacheKey} - Fetching from NEIS API`);
    const apiStart = Date.now();
    const fetchedSchedules = await neis.getSchedule({
      SD_SCHUL_CODE: schoolCode,
      ATPT_OFCDC_SC_CODE: regionCode,
      AA_YMD: dateFormatted,
    });
    console.log(`[SCHEDULE] NEIS API call took ${Date.now() - apiStart}ms`);

    const parseStart = Date.now();
    const schedulesMap: { [key: string]: { start: string; end: string; schedules: string[] } } = {};

    fetchedSchedules.forEach((s: any) => {
      if (s.EVENT_NM === '토요휴업일') return;

      const formattedDate = formatDate(s.AA_YMD);

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

    const combinedSchedules: ScheduleItem[] = [];
    let prevSchedule: ScheduleItem | null = null;

    for (const schedule of schedules) {
      if (prevSchedule && prevSchedule.schedule === schedule.schedule) {
        prevSchedule.date.end = schedule.date.end;
      } else {
        if (prevSchedule) combinedSchedules.push(prevSchedule);
        prevSchedule = schedule;
      }
    }

    if (prevSchedule) combinedSchedules.push(prevSchedule);
    console.log(`[SCHEDULE] Parse took ${Date.now() - parseStart}ms`);

    // Cache the result
    const cacheData: ScheduleCache = {
      schedules: combinedSchedules,
      schoolCode,
      regionCode,
      dateKey: dateFormatted,
    };
    await setCache(CacheCollection.SCHEDULE, cacheKey, cacheData);
    console.log(`[SCHEDULE] Total request time: ${Date.now() - startTime}ms`);

    return combinedSchedules;
  } catch (e) {
    handleNeisError(e as Error);
  }
}
