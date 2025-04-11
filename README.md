# Gmail 關鍵字監控與 Slack 通知系統

---

## 專案背景與目標

- **自動過濾 Gmail 郵件**，根據關鍵字篩選及分類
- **使用 Gemini AI** 進行郵件內容理解與情緒分析
- **將重要通知發送到 Slack**，方便團隊即時回應
- **支援多帳號多環境**，確保測試與正式分離，安全部署
- **提供自動化數據統計**，產生每日郵件處理報告

---

## 重構後專案目錄結構

```plaintext
/src/                # 專案源碼與構建設定
  /source/           # 原始程式碼
    /core/           # 核心 API 模組
    /modules/        # 業務邏輯模組
    env.js
    main.js
    modules.js
    utils.js
    statistics.js
  /build/            # 構建產物
    /babel/          # Babel 編譯產物
    /bundle/         # 打包產物（bundle.js）
    /output/         # 最終輸出（Code.js）
  esbuild.config.js  # 打包配置
  package.json       # 依賴與指令定義

/deploy/             # 部署環境
  /test/             # 測試環境部署檔案
    .clasp.json
    appsscript.json
    Code.js
  /prod/             # 正式環境部署檔案
    .clasp.json
    appsscript.json
    Code.js

/backup/             # 舊結構備份

# 部署腳本
sync_test.sh         # 同步到測試環境
sync_prod.sh         # 同步到正式環境
deploy_test.sh       # 部署到測試環境
deploy_all.sh        # 部署到兩個環境
```

---

## 打包與構建流程

- 進入 `src/` 目錄，使用下列指令：
  - `npm run build`：Babel 轉譯並打包所有原始碼，產生 `build/babel/`、`build/bundle/bundle.js`
  - `npm run copy`：將 bundle.js 複製為 `build/output/Code.js`
- 所有打包路徑、來源、產物皆已於 `esbuild.config.js`、`package.json` scripts 修正

---

## 部署流程

- **同步到測試環境**：`./sync_test.sh`
  - 會自動 build 並將 Code.js 複製到 `deploy/test/`
- **同步到正式環境**：`./sync_prod.sh`
  - 會自動 build 並將 Code.js 複製到 `deploy/prod/`
- **部署到測試環境**：`./deploy_test.sh`
  - 會同步並於 `deploy/test/` 執行 `clasp push`
- **部署到兩個環境**：`./deploy_all.sh`
  - 依互動指示，分別部署 test/prod，並處理憑證切換

---

## 主要功能說明

### 核心功能

1. **郵件自動篩選**：依據關鍵字、標題、內文、網域自動分類
2. **AI 內容分析**：Gemini AI 分析郵件情緒、緊急度、分類
3. **Slack 通知**：即時發送重要郵件摘要與 AI 結果到 Slack
4. **自動標籤管理**：自動標記已檢查、關鍵字、AI 建議等標籤
5. **數據統計與報告**：每日自動產生郵件處理統計報告

---

## 模組化架構

### 核心 API 模組 (`src/source/core/`)

- `gmail.js`：Gmail API 操作
- `gemini.js`：Gemini AI API 操作
- `slack.js`：Slack API 操作

### 業務邏輯模組 (`src/source/modules/`)

- `emailProcessor.js`：郵件處理流程
- `emotionStorage.js`：情緒分析儲存
- `ignoreRules.js`：忽略規則
- `notificationRules.js`：通知規則
- `searchTools.js`：搜尋工具
- `triggerSetup.js`：觸發器設定

### 其他整合與工具

- `main.js`：主程式邏輯與入口
- `modules.js`：模組命名空間管理
- `env.js`：環境變數與設定
- `statistics.js`：統計報告
- `utils.js`：通用工具

---

## 開發與部署操作流程

### 1. 開發與打包

```bash
cd src
npm install
npm run build
npm run copy
```

### 2. 同步與部署

- 同步到測試環境：`./sync_test.sh`
- 同步到正式環境：`./sync_prod.sh`
- 部署到測試環境：`./deploy_test.sh`
- 部署到兩個環境：`./deploy_all.sh`

### 3. 初始化與帳號設定

- 於 `deploy/test/`、`deploy/prod/` 目錄下分別執行 `clasp login` 與 `clasp create` 設定專案
- 使用 `update_clasp_id.sh` 快速更新 scriptId

---

## 目錄與腳本說明

- `/src/source/`：所有開發原始碼
- `/src/build/babel/`：Babel 轉譯產物
- `/src/build/bundle/`：esbuild 打包產物
- `/src/build/output/Code.js`：最終部署用單檔
- `/deploy/test/`、`/deploy/prod/`：各環境部署目錄
- `/backup/`：重構前舊目錄備份
- `sync_test.sh`、`sync_prod.sh`：同步產物到對應環境
- `deploy_test.sh`、`deploy_all.sh`：自動化部署腳本

---

## 注意事項

- **所有開發、打包、部署請以新結構為主，舊目錄已移至 /backup/**
- **.gitignore 已更新，會自動忽略所有新結構下的產物與部署檔案**
- **如需新增模組，請於 `/src/source/core/` 或 `/src/source/modules/` 下建立**
- **如需調整打包流程，請修改 `/src/esbuild.config.js` 與 `/src/package.json`**
- **如需調整部署流程，請修改對應的 shell 腳本**
- **如有 import 路徑錯誤，請依新結構修正**

---

## FAQ

- **Q: 測試時會不會影響正式環境？**
  - **A:** 不會，`deploy/test/` 與 `deploy/prod/` 完全隔離

- **Q: 如何增加新帳號？**
  - **A:** 複製一份 deploy 目錄，執行 `clasp login` + `clasp create`，並更新 scriptId

- **Q: 如何添加新模組？**
  - **A:** 建立新檔案於 core/ 或 modules/，並於 modules.js 註冊

- **Q: 如何快速更新 scriptId？**
  - **A:** 執行 `./update_clasp_id.sh` 並依提示輸入

---

## 授權資訊

Copyright (c) 2025 CT, YEH - Newsleopard Inc.

本專案授權任何人免費使用於個人、教育或非商業目的。
商業用途需獲得作者明確的書面許可。

請聯繫 ct@newsleopard.tw 獲取商業授權資訊。

---

## 作者與貢獻

CT, YEH (ct@newsleopard.tw)  
[https://newsleopard.tw](https://newsleopard.tw)

---

*此文件最後更新於 2025年4月11日*
