import { expect, describe, it } from 'bun:test';
import { app } from './index';
import { db } from './libraries/db';
import { DB_COLLECTIONS } from './constants';
import type { Cache, SchoolSearchResult } from './types';

const default_url = 'http://localhost:3000';

async function _getResponse(url: string, query: Record<string, string> = {}, headers: Record<string, string> = {}, body: Record<string, any> = {}, method: string = 'GET') {
  let first = true;
  let final_url = default_url + url;
  for (const v of Object.keys(query)) {
    if (first) {
      final_url += '?';
      first = false;
    } else {
      final_url += '&';
    }
    final_url += `${encodeURI(v)}=${encodeURI(query[v])}`;
  }

  const hasBody = method !== 'GET' && Object.keys(body).length > 0;
  const finalHeaders = {
    ...headers,
    ...(hasBody ? { 'Content-Type': 'application/json' } : {}),
  };

  return await app.handle(
    new Request(final_url, {
      headers: finalHeaders,
      method: method,
      body: hasBody ? JSON.stringify(body) : undefined,
    })
  );
}

async function getResponse(url: string, query: Record<string, string> = {}, headers: Record<string, string> = {}, body: Record<string, any> = {}, method: string = 'GET') {
  return await (await _getResponse(url, query, headers, body, method)).json();
}

async function getResponseStatus(url: string, query: Record<string, string> = {}, headers: Record<string, string> = {}, body: Record<string, any> = {}, method: string = 'POST') {
  return (await _getResponse(url, query, headers, body, method)).status;
}

describe('comcigan', () => {
  it('search', async () => {
    expect(
      await getResponse('/comcigan/search', {
        schoolName: '선린인터넷고',
      })
    ).toEqual([{ schoolName: '선린인터넷고', schoolCode: 41896, region: '서울' }]);
  });
});

describe('neis', () => {
  const url = '/neis/';
  it('search', async () => {
    const data: SchoolSearchResult[] = JSON.parse(await Bun.file('./tests/neis_data.json').text());
    const collection = db.openDB({ name: 'school', dupSort: true });
    const informationCollection = db.openDB({ name: 'schoolInformation' });
    for (const v of data) {
      await collection.put('서울', v.schoolName);
      await informationCollection.put(v.schoolName, v);
    }
    expect(
      await getResponse(url + 'search', {
        schoolName: '서울',
      })
    ).toEqual(data);
  });
  it('meal (only on cache)', async () => {
    const data: Cache[] = JSON.parse(await Bun.file('./tests/meal_data.json').text());
    await db.openDB({ name: 'meal' }).put(`B10_7010536_${data[0].date}`, data[0]);
    expect(
      await getResponse(url + 'meal', {
        schoolCode: '7010536',
        regionCode: 'B10',
        year: '2025',
        month: '03',
        day: '14',
        showAllergy: 'true',
        showOrigin: 'true',
        showNutrition: 'true',
      })
    ).toEqual(data);
  });
});

describe('notifications', () => {
  const url = '/notifications/';
  const notifications = [
    {
      title: 'test',
      content: 'test',
      date: '2025-03-08T05:52:06.583Z',
    },
    {
      title: 'test but first',
      content: 'test',
      date: '2025-03-08T05:52:06.582Z',
    },
  ];
  it('post without token', async () => {
    expect(await getResponseStatus(url, {}, {}, notifications[0])).toBe(422);
  });
  it('post with invalid token', async () => {
    expect(await getResponseStatus(url, {}, { Token: 'invalid' }, notifications[0])).toBe(403);
  });
  it('post', async () => {
    for (const notification of notifications) {
      expect(await getResponseStatus(url, {}, { Token: process.env.ADMIN_KEY ?? '' }, notification)).toBe(200);
    }
  });
  //it('get', async () => {
  //  expect(await getResponse(url)).toEqual(notifications)
  //})
});

describe('fcm-meal', async () => {
  const url = '/fcm/meal';
  const collection = db.openDB({ name: DB_COLLECTIONS.FCM_MEAL });
  await collection.put('test-meal', { token: 'test-meal', time: '01:00', schoolCode: '12345', regionCode: 'A1' });

  it('post invalid time', async () => {
    expect(await getResponseStatus(url, {}, {}, { token: 'test-meal-2', time: '25:00', schoolCode: '12345', regionCode: 'A1' })).toBe(400);
    expect(await getResponseStatus(url, {}, {}, { token: 'test-meal-2', time: '24:59', schoolCode: '12345', regionCode: 'A1' })).toBe(400);
  });

  it('post meal notification', async () => {
    expect(await getResponseStatus(url, {}, {}, { token: 'test-meal-new', time: '07:00', schoolCode: '12345', regionCode: 'B10' })).toBe(200);
    expect(await getResponseStatus(url, {}, {}, { token: 'test-meal-new', time: '07:00', schoolCode: '12345', regionCode: 'B10' })).toBe(409);
  });

  it('get meal notification', async () => {
    expect(await getResponse(url, { token: 'test-meal' })).toEqual({ token: 'test-meal', time: '01:00', schoolCode: '12345', regionCode: 'A1' });
    expect(await getResponseStatus(url, { token: 'notexist' }, {}, {}, 'GET')).toBe(404);
  });

  it('put meal notification', async () => {
    // Create a new token for PUT test to avoid affecting other tests
    await collection.put('test-meal-put', { token: 'test-meal-put', time: '07:00', schoolCode: '11111', regionCode: 'B1' });
    expect(await getResponseStatus(url, {}, {}, { token: 'test-meal-put', time: '08:00', schoolCode: '54321', regionCode: 'C10' }, 'PUT')).toBe(200);
    expect(await getResponse(url, { token: 'test-meal-put' })).toEqual({ token: 'test-meal-put', time: '08:00', schoolCode: '54321', regionCode: 'C10' });
  });

  it('delete meal notification', async () => {
    expect(await getResponseStatus(url, {}, {}, { token: 'notexist' }, 'DELETE')).toBe(404);
    expect(await getResponseStatus(url, {}, {}, { token: 'test-meal-new' }, 'DELETE')).toBe(200);
    expect(await getResponseStatus(url, { token: 'test-meal-new' }, {}, {}, 'GET')).toBe(404);
  });
});

describe('fcm-keyword', async () => {
  const url = '/fcm/keyword';
  const collection = db.openDB({ name: DB_COLLECTIONS.FCM_KEYWORD });
  await collection.put('test-keyword', { token: 'test-keyword', keywords: ['피자', '치킨'], time: '07:00', schoolCode: '12345', regionCode: 'B10' });

  it('post keyword notification with empty keywords', async () => {
    expect(await getResponseStatus(url, {}, {}, { token: 'test-kw-2', keywords: [], time: '07:00', schoolCode: 12345, regionCode: 'B10' })).toBe(422);
  });

  it('post keyword notification with invalid time', async () => {
    expect(await getResponseStatus(url, {}, {}, { token: 'test-kw-3', keywords: ['피자'], time: '25:00', schoolCode: 12345, regionCode: 'B10' })).toBe(400);
  });

  it('post keyword notification', async () => {
    expect(await getResponseStatus(url, {}, {}, { token: 'test-kw-new', keywords: ['햄버거', '콜라'], time: '08:00', schoolCode: 12345, regionCode: 'B10' })).toBe(200);
    expect(await getResponseStatus(url, {}, {}, { token: 'test-kw-new', keywords: ['햄버거'], time: '08:00', schoolCode: 12345, regionCode: 'B10' })).toBe(409);
  });

  it('get keyword notification', async () => {
    expect(await getResponse(url, { token: 'test-keyword' })).toEqual({ token: 'test-keyword', keywords: ['피자', '치킨'], time: '07:00', schoolCode: '12345', regionCode: 'B10' });
    expect(await getResponseStatus(url, { token: 'notexist' }, {}, {}, 'GET')).toBe(404);
  });

  it('put keyword notification', async () => {
    await collection.put('test-kw-put', { token: 'test-kw-put', keywords: ['김치'], time: '06:30', schoolCode: '11111', regionCode: 'C10' });
    expect(await getResponseStatus(url, {}, {}, { token: 'test-kw-put', keywords: ['불고기', '된장찌개'], time: '07:30', schoolCode: 54321, regionCode: 'J10' }, 'PUT')).toBe(200);
    expect(await getResponse(url, { token: 'test-kw-put' })).toEqual({ token: 'test-kw-put', keywords: ['불고기', '된장찌개'], time: '07:30', schoolCode: '54321', regionCode: 'J10' });
  });

  it('delete keyword notification', async () => {
    expect(await getResponseStatus(url, {}, {}, { token: 'notexist' }, 'DELETE')).toBe(404);
    expect(await getResponseStatus(url, {}, {}, { token: 'test-kw-new' }, 'DELETE')).toBe(200);
    expect(await getResponseStatus(url, { token: 'test-kw-new' }, {}, {}, 'GET')).toBe(404);
  });
});

describe('fcm-timetable', async () => {
  const url = '/fcm/timetable';
  const collection = db.openDB({ name: DB_COLLECTIONS.FCM_TIMETABLE });
  await collection.put('test-timetable', { token: 'test-timetable', time: '07:30', schoolCode: '41896', grade: '1', class: '1' });

  it('post invalid time', async () => {
    expect(await getResponseStatus(url, {}, {}, { token: 'test-tt-2', time: '25:00', schoolCode: 41896, grade: 1, class: 1 })).toBe(400);
    expect(await getResponseStatus(url, {}, {}, { token: 'test-tt-2', time: '24:59', schoolCode: 41896, grade: 1, class: 1 })).toBe(400);
  });

  it('post timetable notification', async () => {
    expect(await getResponseStatus(url, {}, {}, { token: 'test-tt-new', time: '08:00', schoolCode: 41896, grade: 2, class: 3 })).toBe(200);
    expect(await getResponseStatus(url, {}, {}, { token: 'test-tt-new', time: '08:00', schoolCode: 41896, grade: 2, class: 3 })).toBe(409);
  });

  it('get timetable notification', async () => {
    expect(await getResponse(url, { token: 'test-timetable' })).toEqual({ token: 'test-timetable', time: '07:30', schoolCode: '41896', grade: '1', class: '1' });
    expect(await getResponseStatus(url, { token: 'notexist' }, {}, {}, 'GET')).toBe(404);
  });

  it('put timetable notification', async () => {
    // Create a new token for PUT test to avoid affecting other tests
    await collection.put('test-tt-put', { token: 'test-tt-put', time: '07:00', schoolCode: '12345', grade: '2', class: '2' });
    expect(await getResponseStatus(url, {}, {}, { token: 'test-tt-put', time: '08:30', schoolCode: 41896, grade: 3, class: 5 }, 'PUT')).toBe(200);
    expect(await getResponse(url, { token: 'test-tt-put' })).toEqual({ token: 'test-tt-put', time: '08:30', schoolCode: '41896', grade: '3', class: '5' });
  });

  it('delete timetable notification', async () => {
    expect(await getResponseStatus(url, {}, {}, { token: 'notexist' }, 'DELETE')).toBe(404);
    expect(await getResponseStatus(url, {}, {}, { token: 'test-tt-new' }, 'DELETE')).toBe(200);
    expect(await getResponseStatus(url, { token: 'test-tt-new' }, {}, {}, 'GET')).toBe(404);
  });
});
