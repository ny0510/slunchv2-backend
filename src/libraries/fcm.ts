import cron, { Patterns } from '@elysiajs/cron';
import { db } from './db';
import admin from 'firebase-admin';

admin.initializeApp({
  credential: admin.credential.cert('serviceAccountKey.json'),
});

const collection = db.openDB({ name: 'fcm' });

export const sendFcm = cron({
  name: 'sendFcm',
  pattern: Patterns.EVERY_MINUTE,
  async run() {
    const currentTime = new Date().toISOString().slice(11, 16);
    const tokens = collection
      .getKeys()
      .map((token) => collection.get(token))
      .filter((token) => token.time === currentTime);

    for (const token of tokens) {
      await sendNotification(token.value, 'title', 'body');
    }
  },
});

async function sendNotification(token: string, title: string, message: string) {
  const payload = {
    notification: {
      title,
      body: message,
    },
    token,
  };

  try {
    await admin.messaging().send(payload);
    console.log(`Notification sent to ${token} at ${new Date().toISOString()}`);
  } catch (error) {
    console.error(`Error sending notification to ${token}:`, error);
  }
}
