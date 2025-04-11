#!/bin/bash
set -e

# 進入 src，編譯並產生 Code.js
cd src
npm run build
npm run copy
cd ..

# 複製產物到 deploy/test 目錄
cp src/build/output/Code.js deploy/test/Code.js

echo "測試環境的程式打包完成"
