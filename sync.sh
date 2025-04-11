#!/bin/bash
set -e

# 進入 common，編譯並產生 Code.js
cd common
npm run build
npm run copy
cd ..

# 確保 distEnvProd/distEnvTest 的 src 目錄存在
mkdir -p distEnvProd/src distEnvTest/src

# 複製產物
cp common/src/Code.js distEnvProd/src/Code.js
cp common/src/Code.js distEnvTest/src/Code.js

echo "同步完成"
