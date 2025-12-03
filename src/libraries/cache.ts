import cron, { Patterns } from '@elysiajs/cron';
import { db } from './db';
import { DB_COLLECTIONS } from '../constants';

// Cache collections
const collections = {
  [DB_COLLECTIONS.MEAL]: db.openDB({ name: DB_COLLECTIONS.MEAL }),
  [DB_COLLECTIONS.SCHOOL]: db.openDB({ name: DB_COLLECTIONS.SCHOOL, dupSort: true }),
  [DB_COLLECTIONS.SCHOOL_INFORMATION]: db.openDB({ name: DB_COLLECTIONS.SCHOOL_INFORMATION }),
  [DB_COLLECTIONS.SCHEDULE]: db.openDB({ name: DB_COLLECTIONS.SCHEDULE }),
};

export const CacheCollection = {
  MEAL: DB_COLLECTIONS.MEAL,
  SCHOOL: DB_COLLECTIONS.SCHOOL,
  SCHOOL_INFORMATION: DB_COLLECTIONS.SCHOOL_INFORMATION,
  SCHEDULE: DB_COLLECTIONS.SCHEDULE,
} as const;

export type CacheCollectionType = typeof CacheCollection[keyof typeof CacheCollection];

// Cache utility functions
export function getCache<T>(collection: CacheCollectionType, key: string): T | null {
  const col = collections[collection];
  const value = col.get(key) as T | undefined | null;
  return value ?? null;
}

export async function setCache<T>(
  collection: CacheCollectionType,
  key: string,
  value: T,
  allowDuplicate: boolean = false
): Promise<void> {
  const col = collections[collection];
  if (!allowDuplicate && col.doesExist(key)) return;
  await col.put(key, value);
}

export function* getCacheRange<T>(
  collection: CacheCollectionType,
  start: string,
  end: string
): Generator<{ key: string; value: T }> {
  const col = collections[collection];
  for (const { key, value } of col.getRange({ start, end })) {
    yield { key: key as string, value: value as T };
  }
}

export function getCacheValues<T>(collection: CacheCollectionType, key: string): T[] {
  const col = collections[collection];
  return Array.from(col.getValues(key)) as T[];
}

export function cacheExists(collection: CacheCollectionType, key: string): boolean {
  return collections[collection].doesExist(key);
}

export async function clearCache(collection: CacheCollectionType): Promise<void> {
  await collections[collection].clearAsync();
}

// Cron jobs for cache refresh
export const refreshCache = cron({
  name: 'refresh',
  pattern: Patterns.EVERY_DAY_AT_1AM,
  async run() {
    console.log('start refresh meal cache');
    await clearCache(CacheCollection.MEAL);
    console.log('refresh meal cache finished');
  },
});

export const refreshSchoolCache = cron({
  name: 'refreshSchool',
  pattern: Patterns.EVERY_WEEKEND,
  async run() {
    console.log('start refresh school cache');
    await clearCache(CacheCollection.SCHOOL);
    await clearCache(CacheCollection.SCHOOL_INFORMATION);
    console.log('refresh school cache finished');
  },
});

export const refreshScheduleCache = cron({
  name: 'refreshSchedule',
  pattern: Patterns.EVERY_DAY_AT_1AM,
  async run() {
    console.log('start refresh schedule cache');
    await clearCache(CacheCollection.SCHEDULE);
    console.log('refresh schedule cache finished');
  },
});
