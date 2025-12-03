import { db } from '../libraries/db';
import { setCache, cacheExists, CacheCollection } from '../libraries/cache';
import { DB_COLLECTIONS, ALLERGY_TYPES } from '../constants';
import { formatDate, getCurrentDateFormatted } from '../utils/validation';
import { getPopularSchools, cleanupOldAccessRecords } from './access-tracker';
import type { Cache, MealItem, Origin, Nutrition } from '../types';
import logger from '../libraries/logger';
import Neis from 'neis.ts';

// Create a separate Neis instance for precaching with longer timeout
const neisForPrecache = new Neis({
  key: process.env.NEIS_API_KEY,
  timeout: 15000, // 15초 타임아웃 for precaching
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

async function precacheSchoolMeal(schoolCode: string, regionCode: string, date: string): Promise<{ success: boolean; schoolCode: string; date: string; error?: any }> {
  try {
    const cacheKey = `${regionCode}_${schoolCode}_${formatDate(date)}`;

    // Skip if already cached
    if (cacheExists(CacheCollection.MEAL, cacheKey)) {
      return { success: true, schoolCode, date };
    }

    // Retry logic for NEIS API
    let retries = 2;
    let fetchedMeals;

    while (retries > 0) {
      try {
        fetchedMeals = await neisForPrecache.getMeal({
          SD_SCHUL_CODE: schoolCode,
          ATPT_OFCDC_SC_CODE: regionCode,
          MLSV_YMD: date,
        });
        break; // Success, exit retry loop
      } catch (err) {
        retries--;
        if (retries === 0) throw err;
        logger.warn('MEAL-PRECACHE', `Retrying for ${schoolCode}`, { retriesLeft: retries });
        await new Promise((resolve) => setTimeout(resolve, 2000)); // Wait 2 seconds before retry
      }
    }

    if (!fetchedMeals) {
      throw new Error('Failed to fetch meals after retries');
    }

    for (const meal of fetchedMeals) {
      const foods = parseMealData(meal.DDISH_NM);
      const origin = parseOriginData(meal.ORPLC_INFO);
      const nutrition = parseNutritionData(meal.NTR_INFO);

      const cacheData: Cache = {
        date: formatDate(meal.MLSV_YMD),
        meal: foods,
        type: meal.MMEAL_SC_NM,
        origin: origin,
        calorie: meal.CAL_INFO.replace('Kcal', '').trim(),
        nutrition: nutrition,
        school_code: schoolCode,
        region_code: regionCode,
      };

      const key = `${regionCode}_${schoolCode}_${cacheData.date}`;
      await setCache(CacheCollection.MEAL, key, cacheData);
      logger.info('MEAL-PRECACHE', `Cached meal`, { schoolCode, date: cacheData.date });
    }
    return { success: true, schoolCode, date };
  } catch (error) {
    logger.error('MEAL-PRECACHE', `Failed to precache meal`, error, { schoolCode });
    return { success: false, schoolCode, date, error };
  }
}

export async function precachePopularSchools(): Promise<void> {
  logger.info('MEAL-PRECACHE', 'Starting meal pre-caching for popular schools');

  // Clean up old access records first
  cleanupOldAccessRecords();

  const today = getCurrentDateFormatted();
  const tomorrow = new Date();
  tomorrow.setDate(tomorrow.getDate() + 1);
  const tomorrowFormatted = `${tomorrow.getFullYear()}${String(tomorrow.getMonth() + 1).padStart(2, '0')}${String(tomorrow.getDate()).padStart(2, '0')}`;

  const promises: Promise<{ success: boolean; schoolCode: string; date: string; error?: any }>[] = [];

  // Get dynamically determined popular schools based on actual usage
  const popularSchools = getPopularSchools(50); // Get top 50 most accessed schools
  logger.info('MEAL-PRECACHE', `Found popular schools to pre-cache`, { count: popularSchools.length });

  // Cache meals for popular schools
  for (const school of popularSchools) {
    promises.push(precacheSchoolMeal(school.schoolCode, school.regionCode, today));
    promises.push(precacheSchoolMeal(school.schoolCode, school.regionCode, tomorrowFormatted));
  }

  // Also check FCM subscriptions for active users
  try {
    const fcmCollection = db.openDB({ name: DB_COLLECTIONS.FCM });
    const fcmEntries = fcmCollection.getRange().asArray;

    for (const entry of fcmEntries.slice(0, 100)) {
      // Limit to 100 to avoid overload
      if (entry?.value?.schoolCode && entry?.value?.regionCode) {
        promises.push(precacheSchoolMeal(entry.value.schoolCode, entry.value.regionCode, today));
        promises.push(precacheSchoolMeal(entry.value.schoolCode, entry.value.regionCode, tomorrowFormatted));
      }
    }
  } catch (error) {
    logger.error('MEAL-PRECACHE', 'Error reading FCM collection', error);
  }

  const results = await Promise.all(promises);
  const successful = results.filter((r) => r.success).length;
  const failed = results.filter((r) => !r.success).length;

  logger.info('MEAL-PRECACHE', 'Pre-caching completed', { successful, failed });

  // Log failed attempts for debugging
  const failedResults = results.filter((r) => !r.success);
  if (failedResults.length > 0) {
    logger.warn('MEAL-PRECACHE', 'Failed schools', { schools: failedResults.map((r) => `${r.schoolCode} (${r.date})`) });
  }
}
