/**
 * emotionStorage.js
 * 
 * 專責情緒分析資料的儲存、讀取與清理
 * 
 * 依賴模組:
 * - env.js (時區設定)
 * - utils.js (格式化工具函數)
 */

/**
 * 儲存情緒分析結果
 * 
 * @param {GmailMessage} message
 * @param {Object} aiAnalysisResult
 */
function storeEmotionAnalysisResult(message, aiAnalysisResult) {
  if (!aiAnalysisResult) return;
  
  try {
    const today = Utilities.formatDate(new Date(), Session.getScriptTimeZone(), "yyyy-MM-dd");
    const propKey = today + "_email_" + message.getId();
    PropertiesService.getScriptProperties().setProperty(propKey, JSON.stringify(aiAnalysisResult));
    Logger.log(`已將情緒分析結果存儲 - 郵件ID: ${message.getId()}`);
  } catch (error) {
    Logger.log(`存儲情緒分析結果時出錯：${error.toString()} - 郵件ID: ${message.getId()}`);
  }
}

/**
 * 讀取情緒統計數據
 * 
 * @param {Date[]} [datesToInclude]
 * @return {Object}
 */
function getEmotionStatsFromProperties(datesToInclude) {
  const stats = {
    positive: 0, negative: 0, neutral: 0,
    delighted: 0, grateful: 0, impressed: 0, satisfied: 0, hopeful: 0,
    angry: 0, frustrated: 0, disappointed: 0, worried: 0, confused: 0,
    factual: 0, inquiring: 0, informative: 0,
    problemDetected: 0,
    includedDates: []
  };
  
  try {
    const dates = datesToInclude || [new Date()];
    const dateStrings = dates.map(date => Utilities.formatDate(date, Session.getScriptTimeZone(), "yyyy-MM-dd"));
    const props = PropertiesService.getScriptProperties().getProperties();
    
    for (const dateString of dateStrings) {
      stats.includedDates.push(dateString);
      for (const key in props) {
        if (key.startsWith(dateString + "_email_")) {
          try {
            const aiAnalysisResult = JSON.parse(props[key]);
            const sentiment = aiAnalysisResult.primarySentiment || aiAnalysisResult.sentiment;
            if (sentiment === "positive") stats.positive++;
            else if (sentiment === "negative") stats.negative++;
            else stats.neutral++;
            if (aiAnalysisResult.detailedEmotion && stats.hasOwnProperty(aiAnalysisResult.detailedEmotion)) {
              stats[aiAnalysisResult.detailedEmotion]++;
            }
            if (aiAnalysisResult.problemDetected) stats.problemDetected++;
          } catch (e) {
            Logger.log(`解析情緒數據錯誤: ${e.toString()}`);
          }
        }
      }
    }
    return stats;
  } catch (error) {
    Logger.log(`獲取情緒統計錯誤: ${error.toString()}`);
    return stats;
  }
}

/**
 * 清除舊的情緒數據
 */
function clearOldEmotionData() {
  try {
    const today = new Date();
    const dayOfWeek = today.getDay();
    let daysToKeep = 1;
    if (dayOfWeek === 0 || dayOfWeek === 1) daysToKeep = 3;
    else if (dayOfWeek === 6) daysToKeep = 2;
    const earliestDate = new Date(today);
    earliestDate.setDate(today.getDate() - (daysToKeep - 1));
    const earliestDateString = Utilities.formatDate(earliestDate, Session.getScriptTimeZone(), "yyyy-MM-dd");
    const props = PropertiesService.getScriptProperties().getProperties();
    let clearedCount = 0;
    for (const key in props) {
      if (key.indexOf("_email_") > -1) {
        const match = key.match(/^(\d{4}-\d{2}-\d{2})_/);
        if (match) {
          const propDate = match[1];
          if (propDate < earliestDateString) {
            PropertiesService.getScriptProperties().deleteProperty(key);
            clearedCount++;
          }
        }
      }
    }
    Logger.log(`已清除 ${clearedCount} 個舊的情緒數據`);
  } catch (error) {
    Logger.log(`清除舊情緒數據錯誤: ${error.toString()}`);
  }
}

/**
 * 清除當天的情緒分析數據
 * 用於重新分析前，確保數據是最新的
 */
function clearTodayEmotionData() {
  try {
    const today = new Date();
    const todayString = Utilities.formatDate(today, Session.getScriptTimeZone(), "yyyy-MM-dd");
    const props = PropertiesService.getScriptProperties().getProperties();
    let clearedCount = 0;
    
    // 遍歷刪除今天的數據
    for (const key in props) {
      if (key.startsWith(todayString + "_email_")) {
        PropertiesService.getScriptProperties().deleteProperty(key);
        clearedCount++;
      }
    }
    
    Logger.log(`已清除 ${clearedCount} 個今日情緒數據項目`);
  } catch (error) {
    Logger.log(`清除今日情緒數據時出錯：${error.toString()}`);
  }
}
