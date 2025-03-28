/**
 * index.js - Gmail 關鍵字監控與 Slack 通知系統
 * 
 * 此檔案是專案的主入口點，負責組織各模組的載入順序。
 * 在 Google Apps Script 中，所有文件都會被編譯到同一個全局作用域，
 * 但順序很重要，必須確保依賴項在被使用前已定義。
 * 
 * 模組載入順序:
 * 1. env.js - 環境變數與常數設定
 * 2. utils.js - 通用工具函數
 * 3. gmail.js - Gmail 郵件操作相關函數
 * 4. gemini.js - Google Gemini API 相關函數
 * 5. slack.js - Slack 通知相關函數
 * 6. statistics.js - 統計報告相關函數
 * 7. main.js - 主要執行邏輯
 * 
 * 功能：
 * - 監控Gmail中含有特定關鍵字的郵件
 * - 支援單關鍵字和關鍵字組合
 * - 排除特定寄件者網域
 * - 排除引用內容中的關鍵字
 * - 使用Google Gemini AI分析郵件內容情緒和問題
 * - 發送通知到Slack
 * - 生成每日統計報告
 */

// 此檔案不包含實際代碼，只是作為專案結構的說明文檔
// 所有功能實現在對應模組中
// 主要入口點函數 checkGmailAndNotifySlack() 在 main.js 中定義

/**
 * Google Apps Script 入口函數
 * 此函數可在 Apps Script 界面中手動執行，以啟動郵件檢查流程
 */
function main() {
  // 調用主入口函數
  checkGmailAndNotifySlack();
}
