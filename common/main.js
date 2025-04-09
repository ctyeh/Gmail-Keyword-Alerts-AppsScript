/**
 * main.js - 主要執行邏輯
 * 
 * 此檔案是專案的主要入口點，包含主要的執行邏輯和流程控制，負責:
 * - 入口點函數
 * - 高層次流程控制
 * - 整合各模組功能
 * 
 * 依賴模組:
 * - env.js (所有常數)
 * - core/gmail.js (Gmail API 核心功能)
 * - core/gemini.js (Gemini API 核心功能)
 * - core/slack.js (Slack API 核心功能)
 * - modules/emailProcessor.js (郵件處理邏輯)
 * - modules/emotionStorage.js (情緒分析儲存)
 * - modules/ignoreRules.js (忽略規則邏輯)
 * - modules/notificationRules.js (通知規則邏輯)
 * - modules/searchTools.js (郵件搜尋工具)
 * - modules/triggerSetup.js (觸發器設定)
 * - statistics.js (統計報告)
 * - utils.js (通用工具函數)
 */

/**
 * 主要功能：檢查 Gmail 並發送通知到 Slack
 * 此函數作為主要入口點，被觸發器定期調用
 */
function checkGmailAndNotifySlack() {
  Logger.log("開始執行郵件檢查與通知功能");
  
  // 使用搜尋工具模組中的功能建立查詢
  const generalQuery = searchTools.buildGeneralQuery();
  const allNewThreads = GmailApp.search(generalQuery, 0, 50);
  
  Logger.log(`找到 ${allNewThreads.length} 個討論串需要分析`);
  
  if (allNewThreads.length === 0) {
    Logger.log("沒有找到新討論串需要分析");
    Logger.log("執行完畢 - 無需處理任何郵件");
    return;
  }

  // 調用模組化的討論串處理函數
  const stats = emailProcessor.processThreads(allNewThreads);
  
  Logger.log(`執行完畢 - 統計資訊：總共掃描 ${stats.totalThreads} 個討論串，包含 ${stats.totalMessages} 封郵件，` +
             `其中 ${stats.alreadyProcessed} 封已處理（跳過），實際處理了 ${stats.newlyProcessed} 封新郵件，` +
             `發送了 ${stats.notificationsSent} 個通知`);
}

/**
 * 設定觸發器 (需要手動運行一次此函數來設定定時觸發)
 */
function setUpTrigger() {
  // 調用模組中的觸發器設定函數
  triggerSetup.setUpTrigger();
}

/**
 * 初始運行指南 
 * 此函數只是提供說明，不需要實際運行
 */
function howToUse() {
  Logger.log(`
=== Gmail 關鍵字監控與 Slack 通知系統使用指南 ===

1. 設定環境變數:
   - 在 Google Apps Script 的 Script Properties 中設定:
     - SLACK_WEBHOOK_URL: Slack 的 Webhook URL
     - GEMINI_API_KEY: Google Gemini API 金鑰

2. 執行 setUpTrigger() 函數以設定自動觸發:
   - 每 5 分鐘執行一次郵件檢查
   - 每天下午 5:30 執行統計報告
   - 每天凌晨清除前一天的情緒數據

3. 您也可以手動執行:
   - checkGmailAndNotifySlack(): 立即檢查郵件
   - dailyStatisticsReport(): 立即生成每日統計
   - reanalyzeAllTodayEmails(): 重新分析當天所有郵件（維護功能）
   
4. 調整設定:
   - 編輯 env.js 檔案中的常數來自定義:
     - 監控關鍵字
     - 排除網域
     - 標籤名稱
     - Gemini API 設定
   
5. 嚴重程度評估:
   - 系統現在會對 AI 判定為需注意的郵件進行嚴重程度評估
   - 可能的嚴重程度級別:
     - low: 低程度嚴重 (僅標記，不通知)
     - medium: 中度嚴重 (僅標記，不通知)
     - high: 高度嚴重 (標記並通知)
     - urgent: 緊急 (標記並通知)
   - 只有 high 和 urgent 級別的郵件會發送 Slack 通知
  `);
}
