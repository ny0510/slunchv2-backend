import cron, { Patterns } from '@elysiajs/cron';
import { db } from './db';
import admin from 'firebase-admin';
import { getMeal } from './cache';
import Comcigan, { Weekday } from '@imnyang/comcigan.ts';
import { appendFile } from 'node:fs/promises';
import { DB_COLLECTIONS } from '../constants';
import { getCurrentTimeFormatted, getCurrentDateFormatted } from '../utils/validation';
import type { MealSubscription, TimetableSubscription, KeywordSubscription, MealItem, TimetableItem } from '../types';

admin.initializeApp({
  credential: admin.credential.cert('serviceAccountKey.json'),
});

const mealCollection = db.openDB({ name: DB_COLLECTIONS.FCM_MEAL });
const timetableCollection = db.openDB({ name: DB_COLLECTIONS.FCM_TIMETABLE });
const keywordCollection = db.openDB({ name: DB_COLLECTIONS.FCM_KEYWORD });
const comcigan = new Comcigan();

export const sendFcm = cron({
  name: 'sendFcm',
  pattern: Patterns.EVERY_MINUTE,
  async run() {
    try {
      const currentTime = getCurrentTimeFormatted();
      const today = getCurrentDateFormatted();

      // Send meal notifications (regular time-based)
      await sendMealNotifications(currentTime, today);

      // Send keyword notifications (checks meal contents at meal notification time)
      await sendKeywordNotifications(today);

      // Send timetable notifications
      await sendTimetableNotifications(currentTime);
    } catch (error) {
      console.error('Error sending FCM:', error);
      await appendFile('./logs/fcm_errors.log', `${new Date().toISOString()} - Error sending FCM: ${JSON.stringify(error)}\n`);
    }
  },
});

async function sendMealNotifications(currentTime: string, today: string) {
  for (const v of mealCollection.getKeys()) {
    const subscription = mealCollection.get(v.toString()) as MealSubscription;
    const { token, time, schoolCode, regionCode } = subscription;

    if (time === currentTime) {
      try {
        const meals = await getMeal(schoolCode, regionCode, today);
        if (meals.length > 0) {
          const title = '🍴 오늘의 급식';
          const mealItems = meals[0].meal;
          const message =
            Array.isArray(mealItems) && typeof mealItems[0] === 'string'
              ? (mealItems as string[]).join(' / ').trim()
              : (mealItems as MealItem[])
                  .map((item) => item.food)
                  .join(' / ')
                  .trim();

          await sendNotification(token, title, message, 'meal').then(async () => {
            await appendFile('./logs/fcm_notifications.log', `${new Date().toISOString()} - Meal notification sent to ${token} - ${message} - ${schoolCode} - ${regionCode}\n`);
          });
        }
      } catch (error) {
        console.error(`Error sending meal notification to ${token}:`, error);
        await appendFile('./logs/fcm_errors.log', `${new Date().toISOString()} - Error sending meal notification to ${token}: ${JSON.stringify(error)}\n`);
      }
    }
  }
}

async function sendKeywordNotifications(today: string) {
  const currentTime = getCurrentTimeFormatted();

  // Get all keyword subscriptions
  for (const v of keywordCollection.getKeys()) {
    const subscription = keywordCollection.get(v.toString()) as KeywordSubscription;
    const { token, keywords, time, schoolCode, regionCode } = subscription;

    // Only send at the configured time
    if (time !== currentTime) {
      continue;
    }

    try {
      // Get today's meal
      const meals = await getMeal(schoolCode, regionCode, today);

      if (meals.length > 0) {
        const mealItems = meals[0].meal;
        const mealText = Array.isArray(mealItems) && typeof mealItems[0] === 'string' ? (mealItems as string[]).join(' ') : (mealItems as MealItem[]).map((item) => item.food).join(' ');

        // Check if any keyword matches
        const matchedKeywords = keywords.filter((keyword) => mealText.toLowerCase().includes(keyword.toLowerCase()));

        if (matchedKeywords.length > 0) {
          const title = `🔔 오늘 급식에 "${matchedKeywords.join(', ')}"이(가) 있어요`;
          const message =
            Array.isArray(mealItems) && typeof mealItems[0] === 'string'
              ? (mealItems as string[]).join(' / ').trim()
              : (mealItems as MealItem[])
                  .map((item) => item.food)
                  .join(' / ')
                  .trim();

          await sendNotification(token, title, message, 'keyword').then(async () => {
            await appendFile('./logs/fcm_notifications.log', `${new Date().toISOString()} - Keyword notification sent to ${token} - Keywords: ${matchedKeywords.join(', ')} - ${schoolCode} - ${regionCode}\n`);
          });
        }
      }
    } catch (error) {
      console.error(`Error sending keyword notification to ${token}:`, error);
      await appendFile('./logs/fcm_errors.log', `${new Date().toISOString()} - Error sending keyword notification to ${token}: ${JSON.stringify(error)}\n`);
    }
  }
}

async function sendTimetableNotifications(currentTime: string) {
  // Get current day of week (0=Sunday, 1=Monday, ..., 6=Saturday)
  const dayOfWeek = new Date().getDay();

  // Skip weekends (Saturday=6, Sunday=0)
  if (dayOfWeek === 0 || dayOfWeek === 6) {
    console.log('Skipping timetable notifications on weekend');
    return;
  }

  // dayOfWeek is now 1-5 (Monday to Friday), which matches Comcigan's Weekday type

  for (const v of timetableCollection.getKeys()) {
    const subscription = timetableCollection.get(v.toString()) as TimetableSubscription;
    const { token, time, schoolCode, grade, class: classNum } = subscription;

    if (time === currentTime) {
      try {
        // Get timetable from Comcigan API (dayOfWeek is 1-5 for Monday-Friday)
        const timetable = (await comcigan.getTimetable(Number(schoolCode), Number(grade), Number(classNum), dayOfWeek as Weekday)) as TimetableItem[];

        if (timetable && timetable.length > 0) {
          // Filter out empty subjects and '없음' (no class)
          const validSubjects = timetable
            .filter((item) => item.subject && item.subject !== '' && item.subject !== '없음')
            .map((item) => item.subject);

          // Only send notification if there are actual subjects (not all '없음')
          if (validSubjects.length > 0) {
            const title = `📚 오늘은 ${validSubjects.length}교시에요`;
            const subjects = validSubjects.join(' / ');

            await sendNotification(token, title, subjects, 'timetable').then(async () => {
              await appendFile('./logs/fcm_notifications.log', `${new Date().toISOString()} - Timetable notification sent to ${token} - ${subjects} - ${schoolCode} - ${grade}-${classNum}\n`);
            });
          } else {
            console.log(`Skipping timetable notification for ${token}: All classes are empty or '없음'`);
          }
        }
      } catch (error) {
        console.error(`Error sending timetable notification to ${token}:`, error);
        await appendFile('./logs/fcm_errors.log', `${new Date().toISOString()} - Error sending timetable notification to ${token}: ${JSON.stringify(error)}\n`);
      }
    }
  }
}

async function sendNotification(token: string, title: string, message: string, type: 'meal' | 'timetable' | 'keyword') {
  const payload = {
    notification: {
      title,
      body: message,
    },
    data: {
      type, // Add type field for client to distinguish notification types
    },
    token: token,
  };

  try {
    await admin.messaging().send(payload);
    console.log(`${type} notification sent to ${token} at ${new Date().toISOString()}`);
  } catch (error) {
    console.error(`Error sending ${type} notification to ${token}:`, error);
    await appendFile('./logs/fcm_errors.log', `${new Date().toISOString()} - Error sending ${type} notification to ${token}: ${JSON.stringify(error)}\n`);

    // If token is invalid, remove it from collection
    if ((error as any)?.code === 'messaging/invalid-registration-token' || (error as any)?.code === 'messaging/registration-token-not-registered') {
      try {
        if (type === 'meal') {
          await mealCollection.remove(token);
        } else if (type === 'timetable') {
          await timetableCollection.remove(token);
        } else if (type === 'keyword') {
          await keywordCollection.remove(token);
        }
        console.log(`Removed invalid token: ${token}`);
      } catch (removeError) {
        console.error(`Error removing invalid token ${token}:`, removeError);
      }
    }
  }
}
