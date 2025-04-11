/**
 * modules/searchTools.js - Gmail 搜尋工具模組
 * 
 * 此檔案包含所有與 Gmail 搜尋相關的功能，包括:
 * - 建立不同類型的搜尋查詢
 * - 搜尋郵件的批次操作
 * 
 * 依賴模組:
 * - env.js (CHECKED_LABEL, KEYWORD_LABEL, AI_ALERT_LABEL, NOTIFIED_LABEL, AI_NOTIFIED_LABEL)
 * - modules/emotionStorage.js (clearTodayEmotionData)
 * - modules/emailProcessor.js (processMessage)
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
  emotionStorage.clearTodayEmotionData();
  
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
      emailProcessor.processMessage(message, subject);
      processedCount++;
    }
  }
  
  Logger.log(`重新分析完成：處理了 ${processedCount} 封郵件，共 ${messageCount} 封當天郵件`);
}