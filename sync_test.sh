#!/bin/bash
set -e

# 進入 common，編譯並產生 Code.js
cd common
npm run build
npm run copy
cd ..

# 直接複製產物到 test 目錄
cp common/src/Code.js test/Code.js

echo "測試環境的程式打包完成"
