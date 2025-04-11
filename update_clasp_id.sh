#!/bin/bash
# 用於快速更新 deploy/prod/.clasp.json 與 deploy/test/.clasp.json 的 scriptId

# 檢查 jq 是否安裝
if ! command -v jq &> /dev/null
then
    echo "請先安裝 jq 工具（Mac 可用 brew install jq，Ubuntu 可用 sudo apt install jq）"
    exit 1
fi

read -p "請輸入 prod scriptId: " prod_id
read -p "請輸入 test scriptId: " test_id

jq --arg id "$prod_id" '.scriptId = $id' deploy/prod/.clasp.json > deploy/prod/.clasp.json.tmp && mv deploy/prod/.clasp.json.tmp deploy/prod/.clasp.json
jq --arg id "$test_id" '.scriptId = $id' deploy/test/.clasp.json > deploy/test/.clasp.json.tmp && mv deploy/test/.clasp.json.tmp deploy/test/.clasp.json

echo "已成功更新 prod/test 的 scriptId！"
