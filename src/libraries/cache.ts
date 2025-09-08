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

// 자주 요청되는 학교들 저장용 컬렉션
const popularSchoolsCollection = db.openDB({ name: 'popularSchools' });

// 학교별 요청 횟수 저장용 컬렉션
const schoolRequestStatsCollection = db.openDB({ name: 'schoolRequestStats' });

export const refreshCache = cron({
  name: 'refresh',
  pattern: Patterns.EVERY_DAY_AT_1AM,
  async run() {
    console.log('start refresh cache');
    await mealCollection.clearAsync();
    console.log('refresh cache finished');
  },
});

// 자주 요청되는 학교들을 위한 선제적 캐싱 크론잡 (자정에 실행)
export const preloadPopularSchools = cron({
  name: 'preloadPopularSchools',
  pattern: '0 0 * * *', // 매일 자정
  async run() {
    console.log('start preloading popular schools');

    try {
      // 자주 요청되는 학교들 목록 가져오기
      const popularSchools = await getAllPopularSchools();
      const today = new Date();
      const tomorrow = new Date(today);
      tomorrow.setDate(tomorrow.getDate() + 1);

      // 오늘과 내일의 급식 정보를 미리 캐싱
      const dates = [`${today.getFullYear()}${String(today.getMonth() + 1).padStart(2, '0')}${String(today.getDate()).padStart(2, '0')}`, `${tomorrow.getFullYear()}${String(tomorrow.getMonth() + 1).padStart(2, '0')}${String(tomorrow.getDate()).padStart(2, '0')}`];

      for (const school of popularSchools) {
        for (const date of dates) {
          try {
            // 이미 캐시가 있는지 확인
            const cacheKey = `${school.regionCode}_${school.schoolCode}_${date.slice(0, 4)}-${date.slice(4, 6)}-${date.slice(6, 8)}`;
            if (!mealCollection.doesExist(cacheKey)) {
              console.log(`Preloading meal data for school ${school.schoolCode} on ${date}`);
              await getMeal(school.schoolCode, school.regionCode, date);
              // API 과부하 방지를 위한 지연
              await new Promise((resolve) => setTimeout(resolve, 200));
            }
          } catch (error) {
            console.error(`Failed to preload meal for school ${school.schoolCode} on ${date}:`, error);
          }
        }
      }

      console.log(`Preloading completed for ${popularSchools.length} popular schools`);
    } catch (error) {
      console.error('Error during preloading popular schools:', error);
    }
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

// 학교별 요청 횟수 증가
export async function incrementSchoolRequestCount(schoolCode: string, regionCode: string): Promise<void> {
  const key = `${regionCode}_${schoolCode}`;
  const currentCount = schoolRequestStatsCollection.get(key) || 0;
  await schoolRequestStatsCollection.put(key, currentCount + 1);
}

// 자주 요청되는 학교 목록 조회 (요청 횟수 기준 상위 30개)
export async function getPopularSchools(): Promise<Array<{ schoolCode: string; regionCode: string; requestCount: number }>> {
  const allStats: Array<{ schoolCode: string; regionCode: string; requestCount: number }> = [];

  for (const key of schoolRequestStatsCollection.getKeys()) {
    const keyStr = key.toString();
    const [regionCode, schoolCode] = keyStr.split('_');
    const requestCount = schoolRequestStatsCollection.get(keyStr) || 0;

    if (requestCount >= 5) {
      // 최소 5회 이상 요청된 학교만 포함
      allStats.push({ schoolCode, regionCode, requestCount });
    }
  }

  // 요청 횟수 기준으로 내림차순 정렬하고 상위 30개만 반환
  return allStats.sort((a, b) => b.requestCount - a.requestCount).slice(0, 30);
}

// FCM 등록된 학교들도 인기 학교로 간주
export async function getPopularSchoolsFromFCM(): Promise<Array<{ schoolCode: string; regionCode: string }>> {
  const fcmCollection = db.openDB({ name: 'fcm' });
  const fcmSchools = new Set<string>();

  for (const key of fcmCollection.getKeys()) {
    const fcmData = fcmCollection.get(key.toString());
    if (fcmData && fcmData.schoolCode && fcmData.regionCode) {
      fcmSchools.add(`${fcmData.regionCode}_${fcmData.schoolCode}`);
    }
  }

  return Array.from(fcmSchools).map((key) => {
    const [regionCode, schoolCode] = key.split('_');
    return { schoolCode, regionCode };
  });
}

// 통합된 인기 학교 목록 조회
export async function getAllPopularSchools(): Promise<Array<{ schoolCode: string; regionCode: string }>> {
  const statsBasedSchools = await getPopularSchools();
  const fcmBasedSchools = await getPopularSchoolsFromFCM();

  // 중복 제거를 위한 Set 사용
  const allSchools = new Set<string>();
  const result: Array<{ schoolCode: string; regionCode: string }> = [];

  // 통계 기반 학교들 추가
  for (const school of statsBasedSchools) {
    const key = `${school.regionCode}_${school.schoolCode}`;
    if (!allSchools.has(key)) {
      allSchools.add(key);
      result.push({ schoolCode: school.schoolCode, regionCode: school.regionCode });
    }
  }

  // FCM 기반 학교들 추가
  for (const school of fcmBasedSchools) {
    const key = `${school.regionCode}_${school.schoolCode}`;
    if (!allSchools.has(key)) {
      allSchools.add(key);
      result.push({ schoolCode: school.schoolCode, regionCode: school.regionCode });
    }
  }

  return result;
}

export async function getMeal(school_code: string, region_code: string, mlsv_ymd: string, showAllergy: boolean = false, showOrigin: boolean = false, showNutrition: boolean = false): Promise<Meal[]> {
  try {
    // 요청 통계 기록 (백그라운드에서 비동기로 실행)
    incrementSchoolRequestCount(school_code, region_code).catch((err) => {
      console.error('Failed to increment school request count:', err);
    });

    const unwrap = (x: string | null | undefined) => {
      return x ?? '';
    };

    if (mlsv_ymd.length === 6) {
      // YYYYMM 형태인 경우 - 해당 월의 모든 캐시된 급식 데이터 검색
      const year = mlsv_ymd.slice(0, 4);
      const month = mlsv_ymd.slice(4, 6);
      const yearMonth = `${year}-${month}`;

      console.log(`월별 캐시 검색: ${region_code}_${school_code}_${yearMonth}-*`);

      const monthlyMeals: Meal[] = [];

      // 캐시에서 해당 월의 모든 급식 데이터 찾기
      for (const key of mealCollection.getKeys()) {
        const keyStr = key.toString();
        if (keyStr.startsWith(`${region_code}_${school_code}_${yearMonth}-`)) {
          const cachedMeal: Cache | undefined | null = mealCollection.get(keyStr);
          if (cachedMeal != null && cachedMeal != undefined) {
            console.log(`월별 캐시 히트: ${keyStr}`);
            let v = cachedMeal;
            monthlyMeals.push({
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
            });
          }
        }
      }

      if (monthlyMeals.length > 0) {
        console.log(`월별 캐시 데이터 ${monthlyMeals.length}개 반환`);
        return monthlyMeals.sort((a, b) => a.date.localeCompare(b.date));
      }
    } else {
      // YYYYMMDD 형태인 경우 - 특정 날짜 검색
      const db_date = mlsv_ymd.slice(0, 4) + '-' + mlsv_ymd.slice(4, 6) + '-' + mlsv_ymd.slice(6, 8);
      const cacheKey = `${region_code}_${school_code}_${db_date}`;
      console.log(`일별 캐시 검색: ${cacheKey}`);
      const cachedMeal: Cache | undefined | null = mealCollection.get(cacheKey);

      if (cachedMeal != null && cachedMeal != undefined) {
        console.log(`일별 캐시 히트: ${cacheKey}`);
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

    // 타임아웃이나 서버 오류인 경우 캐시된 데이터를 찾아서 반환
    if (message.includes('Request timed out') || message.includes('timeout') || message.includes('ECONNRESET') || message.includes('network')) {
      console.log(`나이스 API 오류 발생 (${message}), 캐시된 데이터 검색 중...`);

      if (mlsv_ymd.length === 6) {
        // YYYYMM 형태인 경우 - 해당 월의 모든 캐시된 급식 데이터 검색
        const year = mlsv_ymd.slice(0, 4);
        const month = mlsv_ymd.slice(4, 6);
        const yearMonth = `${year}-${month}`;

        console.log(`월별 급식 캐시 검색: ${region_code}_${school_code}_${yearMonth}-*`);

        const monthlyMeals: Meal[] = [];

        // 캐시에서 해당 월의 모든 급식 데이터 찾기
        for (const key of mealCollection.getKeys()) {
          const keyStr = key.toString();
          if (keyStr.startsWith(`${region_code}_${school_code}_${yearMonth}-`)) {
            const cachedMeal: Cache | undefined | null = mealCollection.get(keyStr);
            if (cachedMeal != null && cachedMeal != undefined) {
              console.log(`월별 캐시 데이터 발견: ${keyStr}`);
              let v = cachedMeal;
              monthlyMeals.push({
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
                type: (v.type ?? '') + ' (캐시됨)',
                origin: showOrigin
                  ? v.origin.map((val) => {
                      return { food: val.food, origin: val.origin };
                    })
                  : undefined,
                calorie: v.calorie ?? '',
                nutrition: showNutrition
                  ? v.nutrition.map((val) => {
                      return { type: val.type, amount: val.amount };
                    })
                  : undefined,
              });
            }
          }
        }

        if (monthlyMeals.length > 0) {
          console.log(`월별 캐시 데이터 ${monthlyMeals.length}개 반환`);
          return monthlyMeals.sort((a, b) => a.date.localeCompare(b.date));
        }
      } else {
        // YYYYMMDD 형태인 경우 - 특정 날짜 및 주변 날짜 검색
        const db_date = mlsv_ymd.slice(0, 4) + '-' + mlsv_ymd.slice(4, 6) + '-' + mlsv_ymd.slice(6, 8);

        // 최근 7일간의 날짜 목록 생성
        const dates = [];
        const targetDate = new Date(db_date);
        for (let i = 0; i < 7; i++) {
          const checkDate = new Date(targetDate);
          checkDate.setDate(checkDate.getDate() - i);
          const formattedDate = checkDate.toISOString().split('T')[0];
          dates.push(formattedDate);
        }

        console.log(`일별 급식 캐시 검색: region_code=${region_code}, school_code=${school_code}, db_date=${db_date}`);
        console.log(`검색할 날짜들:`, dates);

        for (const date of dates) {
          const searchKey = `${region_code}_${school_code}_${date}`;
          console.log(`캐시 키 검색: ${searchKey}`);
          const cachedMeal: Cache | undefined | null = mealCollection.get(searchKey);
          if (cachedMeal != null && cachedMeal != undefined) {
            console.log(`캐시된 데이터 발견: ${date} (원래 요청: ${db_date})`);
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
                type: (v.type ?? '') + ' (캐시됨)',
                origin: showOrigin
                  ? v.origin.map((val) => {
                      return { food: val.food, origin: val.origin };
                    })
                  : undefined,
                calorie: v.calorie ?? '',
                nutrition: showNutrition
                  ? v.nutrition.map((val) => {
                      return { type: val.type, amount: val.amount };
                    })
                  : undefined,
              },
            ];
          }
        }
      }
      console.log('캐시된 데이터를 찾을 수 없음');
    }

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
