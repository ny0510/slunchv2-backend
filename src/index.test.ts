import { expect, describe, it } from "bun:test"
import { app } from "./index"
import { MealSchema } from "./libraries/schema"

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
    const data = JSON.parse(await Bun.file("./tests/meal_data.json").text());
    data["school_code"] = 7010536;
    data["region_code"] = "B10";
    (new MealSchema(data)).save();
    delete data["school_code"]
    delete data["region_code"]
    expect(await getResponse(url + 'meal', {
      'schoolCode': '7010536',
      'regionCode': 'B10',
      'year': '2025',
      'month': '03',
      'day': '10',
      'showAllergy': 'true',
      'showOrigin': 'true',
      'showNutrition': 'true'
    })).toEqual([data])
  })
})

