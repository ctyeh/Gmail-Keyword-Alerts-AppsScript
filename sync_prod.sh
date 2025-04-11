#!/bin/bash
set -e

# 進入 common，編譯並產生 Code.js
cd common
npm run build
npm run copy
cd ..

# 直接複製產物到 prod 目錄
cp common/src/Code.js prod/Code.js

echo "正式環境的程式打包完成"
