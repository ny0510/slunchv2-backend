import { password, input, editor } from '@inquirer/prompts';

async function uploadNotification() {
  const response = await fetch('https://slunch-v2.ny64.kr/notifications/', {
    method: 'POST',
    headers: {
      Token: await password({ message: 'token' }),
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      title: await input({ message: 'title' }),
      content: (await editor({ message: 'content' })).trim(),
      date: new Date().toISOString(),
    }),
  });

  if (response.status !== 200) {
    console.error(await response.json());
  } else {
    console.log('Success');
  }
}

uploadNotification();
