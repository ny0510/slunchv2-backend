#!/usr/bin/env bun
/**
 * FCM 구독 마이그레이션 스크립트
 * 기존 FCM 컬렉션의 모든 구독을 FCM_MEAL 컬렉션으로 이동
 *
 * 사용법: bun run scripts/migrate-fcm.ts
 */

import { db } from '../src/libraries/db';
import { DB_COLLECTIONS } from '../src/constants';
import type { FcmSubscription, MealSubscription } from '../src/types';

async function migrate() {
  console.log('🚀 FCM 구독 마이그레이션 시작...\n');

  // Open collections
  const oldCollection = db.openDB({ name: DB_COLLECTIONS.FCM });
  const mealCollection = db.openDB({ name: DB_COLLECTIONS.FCM_MEAL });

  // Count existing subscriptions
  const keys = Array.from(oldCollection.getKeys());
  const totalSubscriptions = keys.length;

  if (totalSubscriptions === 0) {
    console.log('✅ 마이그레이션할 구독이 없습니다.');
    return;
  }

  console.log(`📊 총 ${totalSubscriptions}개의 구독을 마이그레이션합니다.\n`);

  let successCount = 0;
  let skipCount = 0;
  let errorCount = 0;

  // Migrate each subscription
  for (const key of keys) {
    const token = key.toString();

    try {
      // Get old subscription
      const oldSubscription = oldCollection.get(token) as FcmSubscription;

      if (!oldSubscription) {
        console.log(`⚠️  건너뜀: ${token} - 데이터 없음`);
        skipCount++;
        continue;
      }

      // Check if already exists in new collection
      if (mealCollection.doesExist(token)) {
        console.log(`⚠️  건너뜀: ${token} - 이미 마이그레이션됨`);
        skipCount++;
        continue;
      }

      // Create new meal subscription
      const mealSubscription: MealSubscription = {
        token: oldSubscription.token,
        time: oldSubscription.time,
        schoolCode: oldSubscription.schoolCode,
        regionCode: oldSubscription.regionCode
      };

      // Save to new collection
      await mealCollection.put(token, mealSubscription);

      console.log(`✅ 성공: ${token} - ${oldSubscription.time} ${oldSubscription.schoolCode}`);
      successCount++;

    } catch (error) {
      console.error(`❌ 실패: ${token} - ${error}`);
      errorCount++;
    }
  }

  console.log('\n' + '='.repeat(50));
  console.log('📊 마이그레이션 결과:');
  console.log(`✅ 성공: ${successCount}개`);
  console.log(`⚠️  건너뜀: ${skipCount}개`);
  console.log(`❌ 실패: ${errorCount}개`);
  console.log(`📝 총계: ${totalSubscriptions}개`);
  console.log('='.repeat(50));

  if (successCount === totalSubscriptions - skipCount) {
    console.log('\n✨ 마이그레이션이 성공적으로 완료되었습니다!');
    console.log('💡 다음 단계:');
    console.log('1. 프로덕션 환경에서 이 스크립트를 실행하세요');
    console.log('2. 새 API 엔드포인트를 배포하세요');
    console.log('3. 클라이언트 앱을 업데이트하세요');
    console.log('4. 기존 FCM 컬렉션은 모든 사용자가 업데이트 후 제거 가능합니다');
  } else if (errorCount > 0) {
    console.log('\n⚠️  일부 구독 마이그레이션에 실패했습니다.');
    console.log('로그를 확인하고 필요시 재실행하세요.');
  }

  // Optionally show sample of migrated data
  if (successCount > 0) {
    console.log('\n📋 마이그레이션된 데이터 샘플 (최대 3개):');
    let sampleCount = 0;
    for (const key of mealCollection.getKeys()) {
      if (sampleCount >= 3) break;
      const subscription = mealCollection.get(key.toString()) as MealSubscription;
      console.log(`  - Token: ${subscription.token.substring(0, 20)}...`);
      console.log(`    Time: ${subscription.time}, School: ${subscription.schoolCode}, Region: ${subscription.regionCode}`);
      sampleCount++;
    }
  }

  process.exit(errorCount > 0 ? 1 : 0);
}

// Run migration
migrate().catch(error => {
  console.error('❌ 마이그레이션 중 치명적 오류 발생:', error);
  process.exit(1);
});