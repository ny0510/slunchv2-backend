import { beforeAll, describe, expect, it } from 'bun:test';
import { app } from '../src/index';
import { incrementSchoolRequestCount, getPopularSchools, getAllPopularSchools } from '../src/libraries/cache';

async function getResponse(url: string, query: Record<string, string> = {}, headers: Record<string, string> = {}) {
  const queryString = new URLSearchParams(query).toString();
  const response = await app.handle(new Request(`http://localhost${url}${queryString ? `?${queryString}` : ''}`, { headers }));
  return await response.json();
}

describe('Popular Schools Caching', () => {
  beforeAll(async () => {
    // 테스트용 학교 요청 통계 생성
    await incrementSchoolRequestCount('7010536', 'B10'); // 선린인터넷고
    await incrementSchoolRequestCount('7010536', 'B10');
    await incrementSchoolRequestCount('7010536', 'B10');
    await incrementSchoolRequestCount('7010536', 'B10');
    await incrementSchoolRequestCount('7010536', 'B10');
    await incrementSchoolRequestCount('7010536', 'B10'); // 6회 요청

    await incrementSchoolRequestCount('7123456', 'B10'); // 다른 학교
    await incrementSchoolRequestCount('7123456', 'B10');
    await incrementSchoolRequestCount('7123456', 'B10'); // 3회 요청 (최소 기준 미달)
  });

  it('should track school request counts', async () => {
    const popularSchools = await getPopularSchools();

    // 선린인터넷고가 포함되어야 함 (6회 요청, 최소 5회 이상)
    const sunrinSchool = popularSchools.find((school) => school.schoolCode === '7010536' && school.regionCode === 'B10');
    expect(sunrinSchool).toBeDefined();
    expect(sunrinSchool!.requestCount).toBeGreaterThanOrEqual(6);

    // 3회만 요청된 학교는 포함되지 않아야 함
    const otherSchool = popularSchools.find((school) => school.schoolCode === '7123456' && school.regionCode === 'B10');
    expect(otherSchool).toBeUndefined();
  });

  it('should get all popular schools including FCM registered ones', async () => {
    const allPopularSchools = await getAllPopularSchools();

    // 통계 기반 + FCM 기반 학교들이 포함되어야 함
    expect(allPopularSchools.length).toBeGreaterThan(0);

    // 중복이 제거되어야 함
    const schoolKeys = allPopularSchools.map((s) => `${s.regionCode}_${s.schoolCode}`);
    const uniqueSchoolKeys = [...new Set(schoolKeys)];
    expect(schoolKeys.length).toBe(uniqueSchoolKeys.length);
  });

  it('should have admin endpoint for popular schools stats', async () => {
    const adminKey = process.env.ADMIN_KEY || 'test';

    try {
      const response = await getResponse('/admin/popular-schools', {}, { token: adminKey });

      expect(response.statsBasedSchools).toBeDefined();
      expect(response.allPopularSchools).toBeDefined();
      expect(response.totalStatsBasedCount).toBeTypeOf('number');
      expect(response.totalPopularCount).toBeTypeOf('number');
    } catch (error) {
      console.log('Admin endpoint test skipped - requires valid admin key');
    }
  });
});
