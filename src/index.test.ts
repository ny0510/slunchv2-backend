import { expect, describe, it } from "bun:test"
import { app } from "./index"
import { db } from "./libraries/db"
import { Cache } from "./libraries/cache"
import { randomUUIDv7 } from "bun"

const default_url = 'http://localhost:3000'

async function getResponse(url: string, query: Record<string, string> = {}, headers: Record<string, string> = {}) {
  let first = true
  let final_url = default_url + url
  for (const v of Object.keys(query)) {
    if (first) {
      final_url += '?';
      first = false;
    } else {
      final_url += '&';
    }
    final_url += `${encodeURI(v)}=${encodeURI(query[v])}`;
  }
  return await app.handle(new Request(final_url, {
    headers: headers
  })).then(async (res) => {
    const data = await res.text();
    return JSON.parse(data);
  })
}

describe('comcigan', () => {
  it('search', async () => {
    expect(await getResponse('/comcigan/search', {
      'schoolName': '선린인터넷고'
    })).toEqual([{"schoolName": "선린인터넷고","schoolCode": 41896,"region": "서울"}])
  })
})

describe('neis', () => {
  const url = '/neis/'
  it('search', async () => {
    expect(await getResponse(url + 'search', {
      'schoolName': '선린인터넷고등학교'
    })).toEqual([{"schoolName": "선린인터넷고등학교","schoolCode": "7010536","region": "서울특별시교육청","regionCode": "B10"}])
  })
  it('meal (only on cache)', async () => {
    const data: Cache[] = JSON.parse(await Bun.file("./tests/meal_data.json").text());
    await db.openDB({name: 'meal'}).put(`B10_7010536_${data[0].date}`, data[0])
    expect(await getResponse(url + 'meal', {
      'schoolCode': '7010536',
      'regionCode': 'B10',
      'year': '2025',
      'month': '03',
      'day': '14',
      'showAllergy': 'true',
      'showOrigin': 'true',
      'showNutrition': 'true'
    })).toEqual(data)
  })
})

describe('notifications', () => {
  const url = '/notifications/';
  it('get', async () => {
    const notifications = [
      {
        title: 'test',
        description: 'test',
        content: 'test',
        date: '2025-03-08T05:52:06.583Z'
      }, {
        title: 'test but first',
        description: 'test',
        content: 'test',
        date: '2025-03-08T05:52:06.582Z'
      }
    ]
    await db.openDB({name: 'notifications'}).put(randomUUIDv7(), notifications[0])
    await db.openDB({name: 'notifications'}).put(randomUUIDv7(), notifications[1])
    expect(await getResponse(url)).toEqual(notifications)
  })
})

