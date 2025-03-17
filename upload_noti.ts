export {}

import { password, input } from "@inquirer/prompts"

fetch('https://slunch-v2.ny64.kr/notifications/', {
  method: 'POST',
  headers: {
    Token: await password({ message: 'token' }),
    'Content-Type': 'application/json'
  },
  body: JSON.stringify({
    title: await input({ message: 'title' }),
    content: await Bun.file("notification.txt").text(),
    date: (new Date()).toISOString()
  })
})
