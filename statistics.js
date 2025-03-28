/**
 * statistics.js - 統計報告相關函數
 * 
 * 此檔案包含所有與統計報告相關的函數，包括:
 * - 每日統計報告生成
 * - 郵件計數統計
 * 
 * 依賴模組:
 * - env.js (CHECKED_LABEL, NOTIFIED_LABEL, USE_GEMINI_API)
 * - gmail.js (countLabeledEmails)
 * - gemini.js (getEmotionStatsFromProperties, generateDailySummaryWithGemini)
 * - slack.js (sendDailyStatisticsToSlack)
 */

/**
 * 每日郵件統計與關鍵字報告
 * 搭配 Properties 服務存儲當日郵件情緒分析結果
 */
function dailyStatisticsReport() {
  // 獲取今天的日期
  const today = new Date();
  const dayOfWeek = today.getDay(); // 0 是星期日，6 是星期六
  
  // 如果是週末（星期六或星期日），則不執行報告
  if (dayOfWeek === 0 || dayOfWeek === 6) {
    Logger.log(`今天是週末 (${dayOfWeek === 0 ? '星期日' : '星期六'})，不發送每日統計報告`);
    return;
  }
  
  // 格式化今天的日期
  const todayFormatted = Utilities.formatDate(today, Session.getScriptTimeZone(), "yyyy-MM-dd");
  Logger.log(`開始生成 ${todayFormatted} 日統計報告`);
  
  // 統計基本數據
  const stats = {
    totalEmails: countCheckedEmails(),
    keywordTriggeredEmails: countKeywordTriggeredEmails(),
    positiveEmotions: 0,
    negativeEmotions: 0,
    neutralEmotions: 0,
    problemDetected: 0
  };
  
  // 從 Properties 服務獲取情緒分析數據
  const emotionStats = getEmotionStatsFromProperties();
  stats.positiveEmotions = emotionStats.positive;
  stats.negativeEmotions = emotionStats.negative;
  stats.neutralEmotions = emotionStats.neutral;
  stats.problemDetected = emotionStats.problemDetected;
  
  // 使用 Gemini API 生成分析摘要
  let aiSummary = "AI 未能生成分析摘要。";
  if (USE_GEMINI_API) {
    aiSummary = generateDailySummaryWithGemini(stats);
  }
  
  // 發送統計數據到 Slack
  sendDailyStatisticsToSlack(stats, aiSummary);
  
  Logger.log(`${todayFormatted} 日統計報告已完成並發送到 Slack`);
}

/**
 * 統計檢查過的郵件數量
 * 
 * @return {Number} - 郵件數量
 */
function countCheckedEmails() {
  // 獲取帶有「已檢查」標籤且日期是今天的郵件
  const today = new Date();
  const formattedDate = Utilities.formatDate(today, Session.getScriptTimeZone(), "yyyy/MM/dd");
  
  return countLabeledEmails(CHECKED_LABEL, `after:${formattedDate}`);
}

/**
 * 統計觸發關鍵字的郵件數量
 * 
 * @return {Number} - 郵件數量
 */
function countKeywordTriggeredEmails() {
  // 獲取帶有「已通知到Slack」標籤且日期是今天的郵件
  const today = new Date();
  const formattedDate = Utilities.formatDate(today, Session.getScriptTimeZone(), "yyyy/MM/dd");
  
  return countLabeledEmails(NOTIFIED_LABEL, `after:${formattedDate}`);
}
