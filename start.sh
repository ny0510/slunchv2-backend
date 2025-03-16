#!/bin/bash

git pull
PORT=80 bun run src/index.ts
