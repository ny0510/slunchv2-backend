import cron, { Patterns } from '@elysiajs/cron';
import { db } from './db';
import admin from 'firebase-admin';
import { getMeal } from './cache';

admin.initializeApp({
  credential: admin.credential.cert('serviceAccountKey.json'),
});

const collection = db.openDB({ name: 'fcm' });

export const sendFcm = cron({
  name: 'sendFcm',
  pattern: Patterns.EVERY_SECOND,
  async run() {
    try {
      const now = new Date();
      const currentTime = `${String(now.getHours()).padStart(2, '0')}:${String(now.getMinutes()).padStart(2, '0')}`;

      for (const v of collection.getKeys()) {
        const { token, time, schoolCode, regionCode } = collection.get(v.toString());
        const meal = await getMeal(schoolCode, regionCode, `${now.getFullYear()}${String(now.getMonth() + 1).padStart(2, '0')}${String(now.getDate()).padStart(2, '0')}`);
        if (time === currentTime) {
          await sendNotification(token, '🍴 오늘의 급식', meal[0].meal.join(' / ').trim());
        }
      }
    } catch (error) {
      console.error('Error sending FCM:', error);
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
  }
}
