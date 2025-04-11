#!/bin/bash
set -e

# 進入 common，編譯並產生 Code.js
cd common
npm run build
npm run copy
cd ..

# 確保 test 的 src 目錄存在
mkdir -p test/src

# 複製產物
cp common/src/Code.js test/src/Code.js

echo "同步到測試環境完成"
