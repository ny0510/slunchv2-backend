import { assertEquals } from "@std/assert"
import { app } from './index.ts';
import { db } from './libraries/db.ts';
import { Cache } from './libraries/cache.ts';

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
  return await app.handle(
    new Request(final_url, {
      headers: headers,
      method: method,
      body: JSON.stringify(body),
    })
  );
}

async function getResponse(url: string, query: Record<string, string> = {}, headers: Record<string, string> = {}, body: Record<string, string> = {}, method: string = 'GET') {
  return await (await _getResponse(url, query, headers, body, method)).json();
}

async function getResponseStatus(url: string, query: Record<string, string> = {}, headers: Record<string, string> = {}, body: Record<string, string> = {}, method: string = 'POST') {
  return (await _getResponse(url, query, headers, body, method)).status;
}

Deno.test('comcigan', (t) => {
  t.step('search', async () => {
    assertEquals(
      await getResponse('/comcigan/search', {
        schoolName: '선린인터넷고',
      }), [{ schoolName: '선린인터넷고', schoolCode: 41896, region: '서울' }]
    );
  });
});

Deno.test('neis', (t) => {
  const url = '/neis/';
  t.step('search', async () => {
    assertEquals(
      await getResponse(url + 'search', {
        schoolName: '선린인터넷고등학교',
      }),
      [{ schoolName: '선린인터넷고등학교', schoolCode: '7010536', region: '서울특별시교육청', regionCode: 'B10' }]
    );
  });
  t.step('meal (only on cache)', async () => {
    const data: Cache[] = JSON.parse(await Deno.readTextFile('./tests/meal_data.json'));
    await db.openDB({ name: 'meal' }).put(`B10_7010536_${data[0].date}`, data[0]);
    assertEquals(
      await getResponse(url + 'meal', {
        schoolCode: '7010536',
        regionCode: 'B10',
        year: '2025',
        month: '03',
        day: '14',
        showAllergy: 'true',
        showOrigin: 'true',
        showNutrition: 'true',
      }), data
    );
  });
});

Deno.test('notifications', (t) => {
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
  t.step('post without token', async () => {
    assertEquals(await getResponseStatus(url, {}, {}, notifications[0]), 422);
  });
  t.step('post with invalid token', async () => {
    assertEquals(await getResponseStatus(url, {}, { Token: 'invalid' }, notifications[0]), 403);
  });
  t.step('post', async () => {
    for (const notification of notifications) {
      assertEquals(await getResponseStatus(url, {}, { Token: Deno.env.get("ADMIN_KEY") ?? '' }, notification), 200);
    }
  });
  t.step('get', async () => {
    assertEquals(await getResponse(url), notifications)
  })
});

Deno.test('fcm', async (t) => {
  const url = '/fcm';
  const collection = db.openDB({ name: 'fcm' });
  await collection.put('test', { token: 'test', time: '01:00', schoolCode: '12345', regionCode: 'A1' });
  t.step('post invalid token', async () => {
    assertEquals(await getResponseStatus(url, {}, {}, { token: 'test', time: '25:00', schoolCode: '12345', regionCode: 'A1' }), 422);
    assertEquals(await getResponseStatus(url, {}, {}, { token: 'test', time: '24:59', schoolCode: '12345', regionCode: 'A1' }), 422);
  });
  t.step('post fcm', async () => {
    assertEquals(await getResponseStatus(url, {}, {}, { token: 'test', time: '01:00', schoolCode: '12345', regionCode: 'A1' }), 200);
    assertEquals(await getResponseStatus(url, {}, {}, { token: 'test', time: '01:00', schoolCode: '12345', regionCode: 'A1' }), 409);
  });
  t.step('get fcm', async () => {
    assertEquals(
      await getResponse(url, { token: 'test' }),
      {token: 'test', time: '01:00', schoolCode: '12345', regionCode: 'A1'}
    );
    assertEquals(await getResponseStatus(url, { token: 'notexist' }, {}, {}, 'GET'), 404);
  });
  t.step('delete fcm', async () => {
    assertEquals(await getResponseStatus(url, {}, {}, { token: 'notexist' }, 'DELETE'), 404);
    assertEquals(await getResponseStatus(url, {}, {}, { token: 'test' }, 'DELETE'), 200);
    assertEquals(await getResponseStatus(url, { token: 'test' }, {}, {}, 'GET'), 404);
  });
});

