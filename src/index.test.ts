import { expect, describe, it } from 'bun:test';
import { app } from './index';
import { db } from './libraries/db';
import { Cache } from './libraries/cache';

const default_url = 'http://localhost:3000';

async function _getResponse(url: string, query: Record<string, string> = {}, headers: Record<string, string> = {}, body: Record<string, string> = {}, method: string = 'GET') {
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
  return await app
    .handle(
      new Request(final_url, {
        headers: headers,
        method: method,
        body: JSON.stringify(body),
      })
    )
    .then(async (res) => res);
}

async function getResponse(url: string, query: Record<string, string> = {}, headers: Record<string, string> = {}, body: Record<string, string> = {}, method: string = 'GET') {
  return await (await _getResponse(url, query, headers, body, method)).json();
}

async function getResponseStatus(url: string, query: Record<string, string> = {}, headers: Record<string, string> = {}, body: Record<string, string> = {}, method: string = 'POST') {
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
    expect(
      await getResponse(url + 'search', {
        schoolName: '선린인터넷고등학교',
      })
    ).toEqual([{ schoolName: '선린인터넷고등학교', schoolCode: '7010536', region: '서울특별시교육청', regionCode: 'B10' }]);
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
      title: 'title',
      content: 'description',
      date: '2025-03-08T05:52:06.583Z',
    },
    {
      title: 'title',
      content: 'description',
      date: '2025-03-08T05:52:06.583Z',
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
  it('get', async () => {
    expect(await getResponse(url)).toEqual(notifications);
  });
});
