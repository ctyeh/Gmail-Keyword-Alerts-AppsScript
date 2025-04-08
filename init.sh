#!/bin/bash

echo "=== 安裝專案依賴 ==="
npm install

echo "=== 安裝 clasp（如未安裝） ==="
if ! command -v clasp &> /dev/null
then
  npm install -g @google/clasp
else
  echo "clasp 已安裝"
fi

echo "=== 請在瀏覽器中登入 Google 帳號，授權 clasp ==="
clasp login

echo "=== 請選擇以下其中一個操作："
echo "1. 新建一個 GAS 專案：clasp create --title 'Gmail Gemini Slack' --type standalone"
echo "2. 或連接既有專案：clasp clone YOUR_SCRIPT_ID"
echo ""
echo "完成後，請執行："
echo "    ./deploy.sh"
echo ""
echo "即可完成打包與上傳"
