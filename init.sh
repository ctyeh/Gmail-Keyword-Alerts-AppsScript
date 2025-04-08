#!/bin/bash

echo "=== 進入 common/ 安裝依賴 ==="
cd common
npm install
cd ..

echo "=== 安裝 clasp（如未安裝） ==="
if ! command -v clasp &> /dev/null
then
  npm install -g @google/clasp
else
  echo "clasp 已安裝"
fi

echo "=== 請在 prod/ 和 test/ 中分別登入不同 Google 帳號，並初始化專案 ==="
echo "例如："
echo "  cd prod"
echo "  clasp login"
echo "  clasp create --title 'Gmail Gemini Slack 正式' --type standalone"
echo ""
echo "  cd ../test"
echo "  clasp login"
echo "  clasp create --title 'Gmail Gemini Slack 測試' --type standalone"
echo ""
echo "=== 完成後，可用 ./deploy_all.sh 或 ./deploy_test.sh 進行部署 ==="
