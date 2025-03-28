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
    problemDetected: 0,
    
    // 詳細情緒統計
    // 正面情緒
    delighted: 0,
    grateful: 0,
    impressed: 0,
    satisfied: 0,
    hopeful: 0,
    
    // 負面情緒
    angry: 0,
    frustrated: 0,
    disappointed: 0,
    worried: 0,
    confused: 0,
    
    // 中性情緒
    factual: 0,
    inquiring: 0,
    informative: 0
  };
  
  // 從 Properties 服務獲取情緒分析數據
  const emotionStats = getEmotionStatsFromProperties();
  
  // 複製所有情緒統計數據
  Object.keys(emotionStats).forEach(key => {
    if (stats.hasOwnProperty(key)) {
      stats[key] = emotionStats[key];
    }
  });
  
  // 為向後兼容，保留舊的總數屬性名稱
  stats.positiveEmotions = emotionStats.positive;
  stats.negativeEmotions = emotionStats.negative;
  stats.neutralEmotions = emotionStats.neutral;
  stats.problemDetected = emotionStats.problemDetected;
  
  Logger.log(`詳細情緒統計：正面(${stats.positive})：欣喜=${stats.delighted}, 感謝=${stats.grateful}, 印象深刻=${stats.impressed}, 滿意=${stats.satisfied}, 充滿希望=${stats.hopeful}`);
  Logger.log(`負面(${stats.negative})：憤怒=${stats.angry}, 沮喪=${stats.frustrated}, 失望=${stats.disappointed}, 擔憂=${stats.worried}, 困惑=${stats.confused}`);
  Logger.log(`中性(${stats.neutral})：事實陳述=${stats.factual}, 詢問=${stats.inquiring}, 提供信息=${stats.informative}`);
  
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
