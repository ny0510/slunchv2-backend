import cron, { Patterns } from '@elysiajs/cron';
import { db } from './db';
import admin from 'firebase-admin';
import { getMeal } from './cache';
import { appendFile } from 'node:fs/promises';
import { DB_COLLECTIONS } from '../constants';
import { getCurrentTimeFormatted, getCurrentDateFormatted } from '../utils/validation';
import type { FcmSubscription, MealItem } from '../types';

admin.initializeApp({
  credential: admin.credential.cert('serviceAccountKey.json'),
});

const collection = db.openDB({ name: DB_COLLECTIONS.FCM });

export const sendFcm = cron({
  name: 'sendFcm',
  pattern: Patterns.EVERY_MINUTE,
  async run() {
    try {
      const currentTime = getCurrentTimeFormatted();
      const today = getCurrentDateFormatted();

      for (const v of collection.getKeys()) {
        const subscription = collection.get(v.toString()) as FcmSubscription;
        const { token, time, schoolCode, regionCode } = subscription;

        if (time === currentTime) {
          const meals = await getMeal(schoolCode, regionCode, today);
          if (meals.length > 0) {
            const title = '🍴 오늘의 급식';
            const mealItems = meals[0].meal;
            const message = Array.isArray(mealItems) && typeof mealItems[0] === 'string'
              ? (mealItems as string[]).join(' / ').trim()
              : (mealItems as MealItem[]).map(item => item.food).join(' / ').trim();

            await sendNotification(token, title, message).then(async () => {
              await appendFile('./logs/fcm_notifications.log', `${new Date().toISOString()} - Notification sent to ${token} - ${message} - ${schoolCode} - ${regionCode}\n`);
            });
          }
        }
      }
    } catch (error) {
      console.error('Error sending FCM:', error);
      await appendFile('./logs/fcm_errors.log', `${new Date().toISOString()} - Error sending FCM: ${JSON.stringify(error)}\n`);
    }
  },
});

async function sendNotification(token: string, title: string, message: string) {
  const payload = {
    notification: {
      title,
      body: message,
    },
    token: token,
  };

  try {
    await admin.messaging().send(payload);
    console.log(`Notification sent to ${token} at ${new Date().toISOString()}`);
  } catch (error) {
    console.error(`Error sending notification to ${token}:`, error);
    await appendFile('./logs/fcm_errors.log', `${new Date().toISOString()} - Error sending notification to ${token}: ${JSON.stringify(error)}\n`);
  }
}
