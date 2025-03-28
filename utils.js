/**
 * utils.js - 通用工具函數
 * 
 * 此檔案包含各種通用輔助函數，可被其他模組重複使用。
 * 
 * 依賴模組:
 * - env.js (SLACK_WEBHOOK_URL)
 */

/**
 * 發送消息到 Slack
 * 
 * @param {Object} message - Slack訊息物件
 * @return {String|null} - 回傳響應文字或null（失敗時）
 */
function sendToSlack(message) {
  const options = {
    "method": "post",
    "contentType": "application/json",
    "payload": JSON.stringify(message),
    "muteHttpExceptions": true
  };
  
  try {
    const response = UrlFetchApp.fetch(getSlackWebhookUrl(), options);
    const responseCode = response.getResponseCode();
    
    if (responseCode !== 200) {
      Logger.log(`Slack 返回錯誤: 狀態碼 ${responseCode}, 內容: ${response.getContentText()}`);
      return null;
    }
    
    return response.getContentText();
  } catch (error) {
    Logger.log(`發送到 Slack 時出錯：${error.toString()}`);
    return null;
  }
}

/**
 * 格式化日期
 * 
 * @param {Date} date - 日期物件
 * @return {String} - 格式化後的日期字串
 */
function formatDate(date) {
  return Utilities.formatDate(date, Session.getScriptTimeZone(), "yyyy/MM/dd HH:mm:ss");
}

/**
 * 截斷過長的郵件內容
 * 
 * @param {String} text - 原始文本
 * @param {Number} maxLength - 最大長度
 * @return {String} - 截斷後的文本
 */
function truncateBody(text, maxLength) {
  if (text.length <= maxLength) {
    return text;
  }
  return text.substring(0, maxLength) + "...";
}

/**
 * 從寄件者郵件地址中提取網域名稱
 * 
 * @param {String} senderEmail - 寄件者郵件地址(可能包含姓名)
 * @return {String|null} - 提取的網域名稱或null（解析失敗時）
 */
function extractDomainFromSender(senderEmail) {
  const emailMatch = senderEmail.match(/[a-zA-Z0-9._%+-]+@([a-zA-Z0-9.-]+\.[a-zA-Z]{2,})/);
  if (!emailMatch) return null;
  
  return emailMatch[1].toLowerCase();
}
