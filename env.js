/**
 * env.js - 環境變數與常數設定
 * 
 * 此檔案包含所有系統使用的常數、API金鑰和設定。
 * 將所有配置項集中在一處，便於維護和更新。
 */

// 監控關鍵字設定
const SINGLE_KEYWORDS = [
  "大量寄送失敗", 
  "大量異常", 
  "大量失敗", 
  "大量退信"
]; //, "退信"單一關鍵字

const KEYWORD_COMBINATIONS = [
  ["詐騙", "異常"],
  // 可添加更多組合，如 ["網路", "中斷"]
]; // 兩個關鍵字的組合

// 排除寄件者設定
const EXCLUDED_DOMAINS = [
  "newsleopard.com", 
  "newsleopard.tw", 
  "softech.com.tw",
  "calendly.com",
  "gandi.net"
]; 

// Slack設定
function getSlackWebhookUrl() {
  // 可以從 Script Properties 獲取，或直接返回 URL
  // 例如：return PropertiesService.getScriptProperties().getProperty('SLACK_WEBHOOK_URL');
  // 或者為了安全起見，您可以設置一個提醒，提示用戶在部署時需要設置這個值
  return PropertiesService.getScriptProperties().getProperty('SLACK_WEBHOOK_URL') || 
         "YOUR_SLACK_WEBHOOK_URL";
}

// Gmail標籤設定
const CHECKED_LABEL = "監控-已檢查"; // 用於標記已處理的郵件
const KEYWORD_LABEL = "監控-關鍵字符合"; // 用於標記郵件內容有符合關鍵字
const AI_ALERT_LABEL = "監控-AI建議注意"; // 用於標記AI分析後認為需注意的郵件

// 不再使用的舊標籤（為了兼容性保留，新代碼不使用）
// const NOTIFIED_LABEL = "監控已Slack"; // 舊標籤：用於標記已發送到Slack的郵件
// const AI_NOTIFIED_LABEL = "AI-已通知"; // 舊標籤：用於標記由AI檢測觸發通知的郵件

// Gemini API 設定
function getGeminiApiKey() {
  // 可以從 Script Properties 獲取，或直接返回 API Key
  // 例如：return PropertiesService.getScriptProperties().getProperty('GEMINI_API_KEY');
  return PropertiesService.getScriptProperties().getProperty('GEMINI_API_KEY') || 
         "YOUR_GEMINI_API_KEY";
}

const USE_GEMINI_API = true; // 設置為 false 可暫時停用 Gemini API 功能
const GEMINI_MODEL = "gemini-2.5-pro-exp-03-25"; // 最新的模型名稱

// 導出環境設置以便其他模組使用
// 注意：在 Apps Script 中，變量和函數自動在全局範圍內共享
// 此處的導出只是為了明確標記哪些變量是由本模組提供的
