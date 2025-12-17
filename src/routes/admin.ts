import { Elysia, t } from 'elysia';
import { clearCache, CacheCollection } from '../libraries/cache';
import { ERROR_MESSAGES } from '../constants';
import logger from '../libraries/logger';

const ADMIN_KEY = process.env.ADMIN_KEY;

const verifyAdminKey = (key?: string): void => {
  if (!key || key !== ADMIN_KEY) {
    throw new Error(ERROR_MESSAGES.UNAUTHORIZED);
  }
};

const app = new Elysia({ prefix: '/admin', tags: ['관리자'] })
  .post(
    '/cache/clear',
    async ({ query, body }) => {
      const timer = logger.startTimer('ADMIN-CACHE', '/cache/clear');
      
      try {
        verifyAdminKey(query.key);

        const { collections: targetCollections } = body;
        const validCollections = ['meal', 'school', 'schoolInformation', 'schedule'];
        
        // 유효한 컬렉션만 필터링
        const collectionsToClean = targetCollections.filter((col: string) => validCollections.includes(col));
        
        if (collectionsToClean.length === 0) {
          return { 
            success: false, 
            message: '정소할 컬렉션을 지정해주세요.',
            validCollections 
          };
        }

        const results: { collection: string; success: boolean; error?: string }[] = [];

        for (const collection of collectionsToClean) {
          try {
            const collectionKey = collection === 'meal' 
              ? CacheCollection.MEAL 
              : collection === 'school'
              ? CacheCollection.SCHOOL
              : collection === 'schoolInformation'
              ? CacheCollection.SCHOOL_INFORMATION
              : CacheCollection.SCHEDULE;

            await clearCache(collectionKey);
            results.push({ collection, success: true });
            logger.info('ADMIN-CACHE', `Cleared ${collection} cache`);
          } catch (error) {
            results.push({ 
              collection, 
              success: false, 
              error: (error as Error).message 
            });
            logger.error('ADMIN-CACHE', `Failed to clear ${collection} cache`, { error });
          }
        }

        timer.end('Cache clear completed', { results });
        return { success: true, message: '캐시 삭제 완료', results };
      } catch (error) {
        timer.end('Cache clear failed', { error: (error as Error).message });
        return { success: false, message: (error as Error).message };
      }
    },
    {
      query: t.Object({
        key: t.String({ description: 'Admin API Key' }),
      }),
      body: t.Object({
        collections: t.Array(
          t.String({ description: '컬렉션 이름' }),
          { description: '삭제할 캐시 컬렉션 목록' }
        ),
      }),
      response: {
        200: t.Object({
          success: t.Boolean(),
          message: t.String(),
          results: t.Optional(
            t.Array(
              t.Object({
                collection: t.String(),
                success: t.Boolean(),
                error: t.Optional(t.String()),
              })
            )
          ),
          validCollections: t.Optional(t.Array(t.String())),
        }),
      },
      detail: { summary: '캐시 삭제' },
    }
  )
  .post(
    '/cache/clear-all',
    async ({ query }) => {
      const timer = logger.startTimer('ADMIN-CACHE', '/cache/clear-all');
      
      try {
        verifyAdminKey(query.key);

        const allCollections = [
          CacheCollection.MEAL,
          CacheCollection.SCHOOL,
          CacheCollection.SCHOOL_INFORMATION,
          CacheCollection.SCHEDULE,
        ];

        const results: { collection: string; success: boolean; error?: string }[] = [];

        for (const collection of allCollections) {
          try {
            await clearCache(collection);
            results.push({ collection, success: true });
            logger.info('ADMIN-CACHE', `Cleared ${collection} cache`);
          } catch (error) {
            results.push({ 
              collection, 
              success: false, 
              error: (error as Error).message 
            });
            logger.error('ADMIN-CACHE', `Failed to clear ${collection} cache`, { error });
          }
        }

        timer.end('All cache clear completed', { results });
        return { success: true, message: '모든 캐시 삭제 완료', results };
      } catch (error) {
        timer.end('All cache clear failed', { error: (error as Error).message });
        return { success: false, message: (error as Error).message };
      }
    },
    {
      query: t.Object({
        key: t.String({ description: 'Admin API Key' }),
      }),
      response: {
        200: t.Object({
          success: t.Boolean(),
          message: t.String(),
          results: t.Optional(
            t.Array(
              t.Object({
                collection: t.String(),
                success: t.Boolean(),
                error: t.Optional(t.String()),
              })
            )
          ),
        }),
      },
      detail: { summary: '전체 캐시 삭제' },
    }
  );

export default app;
