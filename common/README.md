# Gmail Gemini Slack GAS 專案

## 專案結構

```
/common/        # 主要開發目錄，原始碼與打包
/prod/          # 正式帳號專案，含 .clasp.json
/test/          # 測試帳號專案，含 .clasp.json
sync_test.sh    # 只同步到測試帳號
sync_prod.sh    # 只同步到正式帳號
deploy_test.sh  # 同步並部署到測試帳號
deploy_all.sh   # 先測試後正式的完整部署
init.sh         # 初始化環境與帳號指引
```

---

## 初始化流程

1. 執行 `./init.sh`
   - 安裝 `common/` 依賴
   - 安裝 `clasp`
   - 指引你在 `prod/` 和 `test/` 中登入不同帳號並 `clasp create`

---

## 同步與部署流程

### 只測試

```bash
./deploy_test.sh
```
- 只同步並部署到測試帳號

### 正式上線

```bash
./deploy_all.sh
```
- 先同步並部署到測試帳號
- 測試無誤後，再同步並部署到正式帳號

---

## 各腳本用途

| 腳本名稱         | 功能說明                                         |
|------------------|--------------------------------------------------|
| `init.sh`        | 初始化 `common/`，並指引多帳號初始化             |
| `sync_test.sh`   | 只同步 `common/` 產物到測試帳號                  |
| `sync_prod.sh`   | 只同步 `common/` 產物到正式帳號                  |
| `deploy_test.sh` | 同步並部署到測試帳號                              |
| `deploy_all.sh`  | 先同步並部署測試帳號，再同步並部署正式帳號       |

---

## 開發流程建議

- **平常只在 `common/` 目錄開發與打包**
- 測試時，執行 `./deploy_test.sh`
- 測試通過後，執行 `./deploy_all.sh`，將程式碼同步並部署到正式帳號
