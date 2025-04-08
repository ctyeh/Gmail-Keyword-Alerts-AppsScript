#!/bin/bash
set -e

# 只同步到測試環境
./sync_test.sh

# 部署到測試帳號
cd test
clasp push
cd ..

echo "測試環境部署完成"
