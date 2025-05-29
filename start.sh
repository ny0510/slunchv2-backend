#!/bin/bash

git pull
PORT=80 deno run src/index.ts
