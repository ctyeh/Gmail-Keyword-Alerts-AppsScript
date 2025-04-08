#!/bin/bash
set -e

# 進入 common，編譯並產生 Code.js
cd common
npm run build
npm run copy
cd ..

# 確保 prod 的 src 目錄存在
mkdir -p prod/src

# 複製產物
cp common/src/Code.js prod/src/Code.js

echo "同步到正式環境完成"
