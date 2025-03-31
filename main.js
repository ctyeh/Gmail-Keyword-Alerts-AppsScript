/**
 * main.js - 主要執行邏輯
 * 
 * 此檔案包含主要的執行邏輯和流程控制，包括:
 * - 入口點函數
 * - 郵件處理流程
 * - 觸發器設定
 * 
 * 依賴模組:
 * - env.js (所有常數)
 * - gmail.js (hasLabel, addLabel, isFromExcludedDomain, checkKeywords, extractActualContent, isForwardedEmail)
 * - gemini.js (analyzeEmailWithGemini, logEmailAnalysisResult, storeEmotionAnalysisResult)
 * - slack.js (sendNotification)
 * - statistics.js (dailyStatisticsReport)
 * - utils.js (通用工具函數)
 */

/**
 * 建立通用搜尋查詢（不包含關鍵字條件）
 * 
 * @return {String} - 通用搜尋查詢字串
 */
function buildGeneralQuery() {
  // 添加標籤過濾，只搜尋未處理的郵件
  let query = `-label:${CHECKED_LABEL}`;
  
  // 專門排除寄件備份中的郵件，只搜尋收件匣
  query += " in:inbox -in:sent";
  
  // 添加時間範圍限制（例如只搜尋最近 24 小時內的郵件）
  const oneDayAgo = new Date();
  oneDayAgo.setDate(oneDayAgo.getDate() - 1);
  const formattedDate = Utilities.formatDate(oneDayAgo, Session.getScriptTimeZone(), "yyyy/MM/dd");
  query += ` after:${formattedDate}`;
  
  return query;
}

/**
 * 主要功能：檢查 Gmail 並發送通知到 Slack
 * 此函數作為主要入口點，被觸發器定期調用
 */
function checkGmailAndNotifySlack() {
  // 獲取所有新郵件（不受關鍵字限制）
  const generalQuery = buildGeneralQuery();
  const allNewThreads = GmailApp.search(generalQuery, 0, 50);
  
  Logger.log(`找到 ${allNewThreads.length} 封新郵件需要分析`);
  
  // 如果沒有找到新郵件，則結束
  if (allNewThreads.length === 0) {
    Logger.log("沒有找到新郵件需要分析");
    return;
  }

  // 處理每個新郵件討論串
  processThreads(allNewThreads);
}

/**
 * 處理郵件討論串
 * 
 * @param {Array<GmailThread>} threads - Gmail 討論串陣列
 */
function processThreads(threads) {
  for (const thread of threads) {
    const messages = thread.getMessages();
    const subject = thread.getFirstMessageSubject();
    
    for (const message of messages) {
      // 只檢查郵件是否已經被處理過
      if (!hasLabel(message, CHECKED_LABEL)) {
        processMessage(message, subject);
      }
    }
  }
}

/**
 * 處理單個郵件
 * 
 * @param {GmailMessage} message - Gmail 郵件對象
 * @param {String} subject - 郵件主旨
 */
function processMessage(message, subject) {
  const from = message.getFrom();
  const date = message.getDate();
  const body = message.getPlainBody();
  const link = `https://mail.google.com/mail/u/0/#inbox/${message.getId()}`;
  
  // 記錄開始分析的郵件
  Logger.log(`開始分析郵件 - 寄件者: ${from}, 主旨: ${subject}`);
  
  // 檢查寄件者是否來自排除的網域，如果是則標記為已檢查並跳過
  if (isFromExcludedDomain(from)) {
    Logger.log(`跳過來自排除網域的郵件: ${from}, 主旨: ${subject}`);
    // 為排除網域的郵件也添加「已檢查」標籤，避免重複處理
    addLabel(message, CHECKED_LABEL);
    return; // 跳過這封郵件的處理
  }
  
  // 檢查是否為轉寄郵件
  const isForwarded = isForwardedEmail(subject);
  
  // 如果是轉寄郵件，加強過濾
  if (isForwarded) {
    Logger.log(`檢測到轉寄郵件: ${subject}`);
    // 如果決定跳過轉寄郵件，取消下面的注釋
    // return;
  }
  
  // 獲取郵件的實際內容（排除引用部分）
  const actualBody = extractActualContent(body);
  
  // 檢查郵件內容是否包含關鍵字
  const foundKeywords = checkKeywords(subject, actualBody, isForwarded);
  if (foundKeywords.length > 0) {
    Logger.log(`在郵件中發現關鍵字: ${foundKeywords.join(', ')} - 寄件者: ${from}, 主旨: ${subject}`);
  }
  
  // 使用 Gemini API 分析郵件內容
  let aiAnalysisResult = null;
  let aiDetected = false;
  if (USE_GEMINI_API) {
    Logger.log(`開始使用 Gemini 分析郵件 - 寄件者: ${from}, 主旨: ${subject}`);
    aiAnalysisResult = analyzeEmailWithGemini(subject, actualBody, from);
    
    // 將情緒分析結果存儲到 Properties 服務
    if (aiAnalysisResult) {
      storeEmotionAnalysisResult(message, aiAnalysisResult);
    }
    
    // 標記 AI 是否檢測到需注意的內容
    if (aiAnalysisResult && aiAnalysisResult.shouldNotify) {
      aiDetected = true;
      Logger.log(`Gemini AI 檢測到需注意內容 - 寄件者: ${from}, 主旨: ${subject}`);
    }
  }
  
  // 記錄郵件分析結果到日誌
  logEmailAnalysisResult(message, subject, from, foundKeywords, aiAnalysisResult);
  
  // 處理標籤和通知
  
  // 標記為已檢查（所有經過分析的郵件都會被標記）
  addLabel(message, CHECKED_LABEL);
  
  // 檢查是否符合關鍵字，標記並嘗試發送通知
  if (foundKeywords.length > 0) {
    // 標記為「關鍵字符合」
    addLabel(message, KEYWORD_LABEL);
    Logger.log(`郵件標記為關鍵字符合 - 寄件者: ${from}, 主旨: ${subject}`);
    
    // 準備通知內容
    const notifyKeywords = [...foundKeywords];
    if (aiDetected) {
      notifyKeywords.push("AI 也檢測到需注意內容");
    }
    
    // 嘗試發送 Slack 通知
    try {
      sendNotification(subject, from, date, body, actualBody, link, notifyKeywords, aiAnalysisResult, message);
      Logger.log(`已發送關鍵字通知到 Slack - 寄件者: ${from}, 主旨: ${subject}`);
    } catch (error) {
      Logger.log(`發送關鍵字通知到 Slack 失敗 - 寄件者: ${from}, 主旨: ${subject}, 錯誤: ${error.toString()}`);
    }
  }
  
  // 檢查 AI 是否檢測到需注意內容，標記並嘗試發送通知
  if (aiDetected) {
    // 標記為「AI 建議注意」
    addLabel(message, AI_ALERT_LABEL);
    Logger.log(`郵件標記為 AI 建議注意 - 寄件者: ${from}, 主旨: ${subject}`);
    
    // 如果沒有關鍵字觸發，則單獨發送 AI 檢測通知
    if (foundKeywords.length === 0) {
      try {
        sendNotification(subject, from, date, body, actualBody, link, ["AI 檢測到需注意內容"], aiAnalysisResult, message);
        Logger.log(`已發送 AI 檢測通知到 Slack - 寄件者: ${from}, 主旨: ${subject}`);
      } catch (error) {
        Logger.log(`發送 AI 檢測通知到 Slack 失敗 - 寄件者: ${from}, 主旨: ${subject}, 錯誤: ${error.toString()}`);
      }
    }
  }
  
  // 如果既無關鍵字也無 AI 檢測，則只標記為已檢查
  if (foundKeywords.length === 0 && !aiDetected) {
    Logger.log(`郵件分析完成，未發現需通知的內容 - 寄件者: ${from}, 主旨: ${subject}`);
  }
}

/**
 * 設定觸發器 (需要手動運行一次此函數來設定定時觸發)
 */
function setUpTrigger() {
  // 刪除現有的觸發器，以避免重複
  const triggers = ScriptApp.getProjectTriggers();
  for (const trigger of triggers) {
    if (trigger.getHandlerFunction() === "checkGmailAndNotifySlack" || 
        trigger.getHandlerFunction() === "dailyStatisticsReport" ||
        trigger.getHandlerFunction() === "clearOldEmotionData") {
      ScriptApp.deleteTrigger(trigger);
    }
  }
  
  // 設定每 5 分鐘執行一次郵件檢查
  ScriptApp.newTrigger("checkGmailAndNotifySlack")
    .timeBased()
    .everyMinutes(5)
    .create();
  
  // 設定每天下午 5:30 執行統計報告
  ScriptApp.newTrigger("dailyStatisticsReport")
    .timeBased()
    .atHour(17)
    .nearMinute(30)
    .everyDays(1)
    .create();
  
  // 設定每天凌晨清除前一天的情緒數據
  ScriptApp.newTrigger("clearOldEmotionData")
    .timeBased()
    .atHour(0)
    .nearMinute(30)
    .everyDays(1)
    .create();
  
  Logger.log("已設定所有觸發器");
}

/**
 * 建立當天搜尋查詢（不包含標籤過濾，僅限當天）
 * 
 * @return {String} - 當天郵件搜尋查詢字串
 */
function buildTodayOnlyQuery() {
  // 僅搜尋收件匣中的郵件（排除寄件備份）
  let query = "in:inbox -in:sent";
  
  // 取得當天日期
  const today = new Date();
  
  // 計算明天日期
  const tomorrow = new Date(today);
  tomorrow.setDate(tomorrow.getDate() + 1);
  
  // 格式化為 yyyy/mm/dd
  const todayFormatted = Utilities.formatDate(today, Session.getScriptTimeZone(), "yyyy/MM/dd");
  const tomorrowFormatted = Utilities.formatDate(tomorrow, Session.getScriptTimeZone(), "yyyy/MM/dd");
  
  // 構建明確的日期範圍查詢
  query += ` after:${todayFormatted} before:${tomorrowFormatted}`;
  
  // 增加日誌記錄，方便調試
  Logger.log(`搜尋查詢：${query}`);
  
  return query;
}

/**
 * 重新分析當天所有郵件（不管是否曾檢查過）
 * 此函數為手動維護功能，可在需要時執行
 */
function reanalyzeAllTodayEmails() {
  Logger.log("開始重新分析當天所有郵件...");
  
  // 清除當天已存儲的情緒數據
  clearTodayEmotionData();
  
  // 獲取當天所有郵件（使用分頁方式）
  const todayQuery = buildTodayOnlyQuery();
  
  // 實作分頁獲取所有郵件討論串
  let allThreads = [];
  let page = 0;
  let pageSize = 100;
  let currentThreads;
  
  do {
    currentThreads = GmailApp.search(todayQuery, page * pageSize, pageSize);
    if (currentThreads.length > 0) {
      allThreads = allThreads.concat(currentThreads);
      Logger.log(`已獲取第 ${page + 1} 頁郵件討論串，本頁有 ${currentThreads.length} 個`);
    }
    page++;
  } while (currentThreads.length === pageSize); // 當獲取的郵件數等於頁面大小時，表示可能還有下一頁
  
  Logger.log(`總共找到 ${allThreads.length} 個討論串需要重新分析`);
  
  // 如果沒有找到郵件，則結束
  if (allThreads.length === 0) {
    Logger.log("當天沒有郵件需要分析");
    return;
  }
  
  // 計數器
  let messageCount = 0;
  let processedCount = 0;
  
  // 處理每個郵件討論串
  for (const thread of allThreads) {
    const messages = thread.getMessages();
    const subject = thread.getFirstMessageSubject();
    
    // 移除所有處理標籤以強制重新處理
    if (GmailApp.getUserLabelByName(CHECKED_LABEL)) {
      thread.removeLabel(GmailApp.getUserLabelByName(CHECKED_LABEL));
    }
    if (GmailApp.getUserLabelByName(KEYWORD_LABEL)) {
      thread.removeLabel(GmailApp.getUserLabelByName(KEYWORD_LABEL));
    }
    if (GmailApp.getUserLabelByName(AI_ALERT_LABEL)) {
      thread.removeLabel(GmailApp.getUserLabelByName(AI_ALERT_LABEL));
    }
    
    // 舊標籤兼容性處理（如果存在）
    try {
      if (GmailApp.getUserLabelByName(NOTIFIED_LABEL)) {
        thread.removeLabel(GmailApp.getUserLabelByName(NOTIFIED_LABEL));
      }
      if (GmailApp.getUserLabelByName(AI_NOTIFIED_LABEL)) {
        thread.removeLabel(GmailApp.getUserLabelByName(AI_NOTIFIED_LABEL));
      }
    } catch (error) {
      // 忽略錯誤：舊標籤可能已經被刪除
      Logger.log(`舊標籤處理時出現警告（可忽略）: ${error.toString()}`);
    }
    
    for (const message of messages) {
      // Gmail 搜尋已經限制了日期範圍，不需要再次檢查日期
      // 直接處理所有訊息
      messageCount++;
      
      // 處理郵件（不管是否已經處理過）
      processMessage(message, subject);
      processedCount++;
    }
  }
  
  Logger.log(`重新分析完成：處理了 ${processedCount} 封郵件，共 ${messageCount} 封當天郵件`);
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
  `);
}
