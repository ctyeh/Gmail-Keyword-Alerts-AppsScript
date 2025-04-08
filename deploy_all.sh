#!/bin/bash
set -e

# 同步並部署到測試帳號
./sync_test.sh
cd test
clasp push
cd ..

# 同步並部署到正式帳號
./sync_prod.sh
cd prod
clasp push
cd ..

echo "全部部署完成"
