/**
 * statistics.js - 統計報告相關函數
 * 
 * 此檔案包含所有與統計報告相關的函數，包括:
 * - 每日統計報告生成
 * - 郵件計數統計
 * 
 * 依賴模組:
 * - env.js (CHECKED_LABEL, KEYWORD_LABEL, AI_ALERT_LABEL, USE_GEMINI_API)
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
  
  // 檢查是否為週一（需要包含週末數據）
  const isMonday = dayOfWeek === 1;
  
  // 如果是週一，獲取週六和週日的日期
  let datesToInclude = [today]; // 默認只包含今天
  let dateRange = "今日";
  
  if (isMonday) {
    // 獲取前兩天的日期（週六和週日）
    const saturday = new Date(today);
    saturday.setDate(today.getDate() - 2); // 週一往前兩天是週六
    
    const sunday = new Date(today);
    sunday.setDate(today.getDate() - 1); // 週一往前一天是週日
    
    datesToInclude = [saturday, sunday, today]; // 週六、週日和今天（週一）
    dateRange = "週六至今日";
    
    Logger.log(`今天是週一，將包含週六(${Utilities.formatDate(saturday, Session.getScriptTimeZone(), "yyyy-MM-dd")})和週日(${Utilities.formatDate(sunday, Session.getScriptTimeZone(), "yyyy-MM-dd")})的數據`);
  }
  
  // 統計基本數據
  const stats = {
    totalEmails: countCheckedEmails(isMonday),
    keywordTriggeredEmails: countKeywordTriggeredEmails(isMonday),
    aiTriggeredEmails: countAITriggeredEmails(isMonday), // 新增 AI 觸發郵件統計
    positive: 0,      // 正面情緒總數
    negative: 0,      // 負面情緒總數
    neutral: 0,       // 中性情緒總數
    problemDetected: 0,
    dateRange: dateRange, // 記錄數據日期範圍，用於報表顯示
    
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
  const emotionStats = getEmotionStatsFromProperties(datesToInclude);
  
  // 複製所有情緒統計數據
  Object.keys(emotionStats).forEach(key => {
    if (stats.hasOwnProperty(key)) {
      stats[key] = emotionStats[key];
    }
  });
  
  // 驗證詳細情緒類型的總和等於對應的大類總數
  // 計算正面情緒總和
  const positiveSum = stats.delighted + stats.grateful + stats.impressed + stats.satisfied + stats.hopeful;
  // 計算負面情緒總和
  const negativeSum = stats.angry + stats.frustrated + stats.disappointed + stats.worried + stats.confused;
  // 計算中性情緒總和
  const neutralSum = stats.factual + stats.inquiring + stats.informative;
  
  // 如果總和與對應的大類數字不符，則使用計算的總和
  if (stats.positive !== positiveSum) {
    Logger.log(`修正正面情緒總數: ${stats.positive} → ${positiveSum}`);
    stats.positive = positiveSum;
  }
  if (stats.negative !== negativeSum) {
    Logger.log(`修正負面情緒總數: ${stats.negative} → ${negativeSum}`);
    stats.negative = negativeSum;
  }
  if (stats.neutral !== neutralSum) {
    Logger.log(`修正中性情緒總數: ${stats.neutral} → ${neutralSum}`);
    stats.neutral = neutralSum;
  }
  
  // 為向後兼容，保留舊的總數屬性名稱
  stats.positiveEmotions = stats.positive;
  stats.negativeEmotions = stats.negative;
  stats.neutralEmotions = stats.neutral;
  
  Logger.log(`詳細情緒統計：正面(${stats.positive}=${positiveSum})：欣喜=${stats.delighted}, 感謝=${stats.grateful}, 印象深刻=${stats.impressed}, 滿意=${stats.satisfied}, 充滿希望=${stats.hopeful}`);
  Logger.log(`負面(${stats.negative}=${negativeSum})：憤怒=${stats.angry}, 沮喪=${stats.frustrated}, 失望=${stats.disappointed}, 擔憂=${stats.worried}, 困惑=${stats.confused}`);
  Logger.log(`中性(${stats.neutral}=${neutralSum})：事實陳述=${stats.factual}, 詢問=${stats.inquiring}, 提供信息=${stats.informative}`);
  
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
 * @param {Boolean} [includeWeekend=false] - 是否包含週末數據（週一報表使用）
 * @return {Number} - 郵件數量
 */
function countCheckedEmails(includeWeekend = false) {
  const today = new Date();
  
  if (includeWeekend) {
    // 週一報表：獲取從週六開始的數據
    const saturday = new Date(today);
    saturday.setDate(today.getDate() - 2);
    const formattedDate = Utilities.formatDate(saturday, Session.getScriptTimeZone(), "yyyy/MM/dd");
    
    Logger.log(`統計從 ${formattedDate} 起的檢查郵件`);
    return countLabeledEmails(CHECKED_LABEL, `after:${formattedDate}`);
  } else {
    // 一般報表：只獲取今天的數據
    const formattedDate = Utilities.formatDate(today, Session.getScriptTimeZone(), "yyyy/MM/dd");
    return countLabeledEmails(CHECKED_LABEL, `after:${formattedDate}`);
  }
}

/**
 * 統計觸發關鍵字的郵件數量
 * 
 * @param {Boolean} [includeWeekend=false] - 是否包含週末數據（週一報表使用）
 * @return {Number} - 郵件數量
 */
function countKeywordTriggeredEmails(includeWeekend = false) {
  const today = new Date();
  
  if (includeWeekend) {
    // 週一報表：獲取從週六開始的數據
    const saturday = new Date(today);
    saturday.setDate(today.getDate() - 2);
    const formattedDate = Utilities.formatDate(saturday, Session.getScriptTimeZone(), "yyyy/MM/dd");
    
    Logger.log(`統計從 ${formattedDate} 起的關鍵字觸發郵件`);
    return countLabeledEmails(KEYWORD_LABEL, `after:${formattedDate}`);
  } else {
    // 一般報表：只獲取今天的數據
    const formattedDate = Utilities.formatDate(today, Session.getScriptTimeZone(), "yyyy/MM/dd");
    return countLabeledEmails(KEYWORD_LABEL, `after:${formattedDate}`);
  }
}

/**
 * 統計 AI 檢測觸發的郵件數量
 * 
 * @param {Boolean} [includeWeekend=false] - 是否包含週末數據（週一報表使用）
 * @return {Number} - 郵件數量
 */
function countAITriggeredEmails(includeWeekend = false) {
  const today = new Date();
  
  if (includeWeekend) {
    // 週一報表：獲取從週六開始的數據
    const saturday = new Date(today);
    saturday.setDate(today.getDate() - 2);
    const formattedDate = Utilities.formatDate(saturday, Session.getScriptTimeZone(), "yyyy/MM/dd");
    
    Logger.log(`統計從 ${formattedDate} 起的 AI 檢測觸發郵件`);
    return countLabeledEmails(AI_ALERT_LABEL, `after:${formattedDate}`);
  } else {
    // 一般報表：只獲取今天的數據
    const formattedDate = Utilities.formatDate(today, Session.getScriptTimeZone(), "yyyy/MM/dd");
    return countLabeledEmails(AI_ALERT_LABEL, `after:${formattedDate}`);
  }
}
