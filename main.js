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
  Logger.log("開始執行郵件檢查與通知功能");
  
  const generalQuery = buildGeneralQuery();
  const allNewThreads = GmailApp.search(generalQuery, 0, 50);
  
  Logger.log(`找到 ${allNewThreads.length} 個討論串需要分析`);
  
  if (allNewThreads.length === 0) {
    Logger.log("沒有找到新討論串需要分析");
    Logger.log("執行完畢 - 無需處理任何郵件");
    return;
  }

  // 調用模組
  const stats = processThreads(allNewThreads);
  
  Logger.log(`執行完畢 - 統計資訊：總共掃描 ${stats.totalThreads} 個討論串，包含 ${stats.totalMessages} 封郵件，` +
             `其中 ${stats.alreadyProcessed} 封已處理（跳過），實際處理了 ${stats.newlyProcessed} 封新郵件，` +
             `發送了 ${stats.notificationsSent} 個通知`);
}

/**
 * 處理郵件討論串
 * 
 * @param {Array<GmailThread>} threads - Gmail 討論串陣列
 * @return {Object} 處理統計資訊
 */
function processThreads(threads) {
  // 統計資訊
  const stats = {
    totalThreads: threads.length,
    totalMessages: 0,
    alreadyProcessed: 0,
    newlyProcessed: 0,
    notificationsSent: 0
  };
  
  for (const thread of threads) {
    const messages = thread.getMessages();
    const subject = thread.getFirstMessageSubject();
    
    Logger.log(`處理討論串：${subject}，包含 ${messages.length} 封郵件`);
    stats.totalMessages += messages.length;
    
    let threadStats = {
      processed: 0,
      skipped: 0
    };
    
    for (const message of messages) {
      // 檢查郵件是否已經被處理過
      if (!hasLabel(message, CHECKED_LABEL)) {
        threadStats.processed++;
        stats.newlyProcessed++;
        const notificationSent = processMessage(message, subject);
        if (notificationSent) {
          stats.notificationsSent++;
        }
      } else {
        threadStats.skipped++;
        stats.alreadyProcessed++;
        //Logger.log(`跳過已處理郵件：寄件者 ${message.getFrom()}，主旨：${subject}`);
      }
    }
    
    Logger.log(`討論串處理完成：${subject}，處理了 ${threadStats.processed} 封新郵件，跳過了 ${threadStats.skipped} 封已處理郵件`);
  }
  
  return stats;
}

/**
 * 處理單個郵件
 * 
 * @param {GmailMessage} message - Gmail 郵件對象
 * @param {String} subject - 郵件主旨
 * @return {Boolean} 是否發送了通知
 */
function processMessage(message, subject) {
  let notificationSent = false;
  const from = message.getFrom();
  const date = message.getDate();
  const body = message.getPlainBody();
  const link = `https://mail.google.com/mail/u/0/#inbox/${message.getId()}`;

  // 預先宣告忽略條件變數
  let isMailgunVerification = 
    from.includes('support@mailgun.net') &&
    subject.startsWith('Good news -') &&
    subject.endsWith('is now verified');
  let containsIdentityVerification = body.includes("申請寄件者身份驗證");
  let containsSmsKeywords = body.includes("簡訊網域申請") || body.includes("簡訊白名單申請");

  // === 完全忽略三類信件，避免標籤、通知、統計、AI分析 ===
  if (isMailgunVerification || containsIdentityVerification || containsSmsKeywords) {
    Logger.log(`完全忽略信件（不標籤、不通知、不統計）- 寄件者: ${from}, 主旨: ${subject}`);
    return false;
  }
  
  // 記錄開始分析的郵件
  Logger.log(`開始分析郵件 - 寄件者: ${from}, 主旨: ${subject}`);
  
  // 檢查寄件者是否來自排除的網域
  const isExcludedDomain = isFromExcludedDomain(from);
  if (isExcludedDomain) {
    Logger.log(`郵件來自排除網域: ${from}, 主旨: ${subject}`);
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
  
  // 創建郵件分析結果對象，清晰區分不同檢測類型
  const emailAnalysis = {
    keywordsFound: foundKeywords,   // 實際找到的關鍵字
    aiDetected: false,              // AI 是否檢測到需注意內容
    aiAnalysisResult: null          // 完整的 AI 分析結果
  };
  
  if (USE_GEMINI_API) {
    Logger.log(`開始使用 Gemini 分析郵件 - 寄件者: ${from}, 主旨: ${subject}`);
    emailAnalysis.aiAnalysisResult = analyzeEmailWithGemini(subject, actualBody, from);
    
    // 將情緒分析結果存儲到 Properties 服務
    if (emailAnalysis.aiAnalysisResult) {
      storeEmotionAnalysisResult(message, emailAnalysis.aiAnalysisResult);
      
      // 統一判斷標準：若problemDetected為true，則shouldNotify也應為true
      if (emailAnalysis.aiAnalysisResult.problemDetected && !emailAnalysis.aiAnalysisResult.shouldNotify) {
        Logger.log(`發現不一致判斷：problemDetected=true 但 shouldNotify=false，強制設置shouldNotify=true - 寄件者: ${from}, 主旨: ${subject}`);
        emailAnalysis.aiAnalysisResult.shouldNotify = true;
      }
      
      // 標記 AI 是否檢測到需注意的內容
      if (emailAnalysis.aiAnalysisResult.shouldNotify) {
        emailAnalysis.aiDetected = true;
        Logger.log(`Gemini AI 檢測到需注意內容 - 寄件者: ${from}, 主旨: ${subject}`);
      }
    } else {
      Logger.log(`AI分析未返回結果，郵件將不被標記為AI建議注意 - 寄件者: ${from}, 主旨: ${subject}`);
    }
  } else {
    Logger.log(`USE_GEMINI_API設置為false，跳過AI分析 - 寄件者: ${from}, 主旨: ${subject}`);
  }
  
  // 記錄郵件分析結果到日誌
  logEmailAnalysisResult(message, subject, from, foundKeywords, emailAnalysis.aiAnalysisResult);
  
  // 處理標籤和通知
  
  // 標記為已檢查（所有經過分析的郵件都會被標記）
  addLabel(message, CHECKED_LABEL);
  
  // 檢查是否符合關鍵字，標記並嘗試發送通知
  if (emailAnalysis.keywordsFound.length > 0) {
    // 標記為「關鍵字符合」
    addLabel(message, KEYWORD_LABEL);
    Logger.log(`郵件標記為關鍵字符合 - 寄件者: ${from}, 主旨: ${subject}`);
    
    // 檢查是否為活動廣告或包含「申請寄件者身份驗證」關鍵字，如果是則不發送通知
    const containsIdentityVerification = emailAnalysis.keywordsFound.includes("申請寄件者身份驗證");
    const isPromotional = emailAnalysis.aiAnalysisResult && emailAnalysis.aiAnalysisResult.isPromotional === true;
    
    if (isMailgunVerification) {
      Logger.log(`忽略 Mailgun 域名驗證成功通知 - 寄件者: ${from}, 主旨: ${subject}`);
      return false; // 跳過通知發送
    }

    if (containsIdentityVerification) {
      Logger.log(`郵件包含「申請寄件者身份驗證」關鍵字，排除發送通知 - 寄件者: ${from}, 主旨: ${subject}`);
      return false; // 跳過通知發送
    }
    
    if (isPromotional) {
      Logger.log(`郵件被 AI 判定為活動廣告，排除發送通知 - 寄件者: ${from}, 主旨: ${subject}`);
      return false; // 跳過通知發送
    }
  }
  
  // 檢查 AI 是否檢測到需注意內容，標記
  if (emailAnalysis.aiDetected) {
    // 只有非排除網域的郵件才添加「AI 建議注意」標籤
    if (!isExcludedDomain) {
      // 標記為「AI 建議注意」
      addLabel(message, AI_ALERT_LABEL);
      Logger.log(`郵件標記為 AI 建議注意 - 寄件者: ${from}, 主旨: ${subject}`);
    } else {
      Logger.log(`郵件被 AI 檢測為需注意，但來自排除網域，不添加標籤 - 寄件者: ${from}, 主旨: ${subject}`);
    }
    
    // 檢查是否為活動廣告或包含關鍵字，如果是則不發送通知
    const containsIdentityVerification = emailAnalysis.keywordsFound.includes("申請寄件者身份驗證");
    const isPromotional = emailAnalysis.aiAnalysisResult && emailAnalysis.aiAnalysisResult.isPromotional === true;
    
    // 檢查是否包含「簡訊網域申請」或「簡訊白名單申請」關鍵字
    const containsSmsKeywords = actualBody.includes("簡訊網域申請") || actualBody.includes("簡訊白名單申請");
    
    if (containsIdentityVerification) {
      Logger.log(`郵件包含「申請寄件者身份驗證」關鍵字，排除發送通知 - 寄件者: ${from}, 主旨: ${subject}`);
      return false; // 跳過通知發送
    }
    
    if (containsSmsKeywords) {
      Logger.log(`郵件包含「簡訊網域申請」或「簡訊白名單申請」關鍵字，排除發送通知 - 寄件者: ${from}, 主旨: ${subject}`);
      return false; // 跳過通知發送
    }
    
    if (isPromotional) {
      Logger.log(`郵件被 AI 判定為活動廣告，排除發送通知 - 寄件者: ${from}, 主旨: ${subject}`);
      return false; // 跳過通知發送
    }
  }
  
  // 決定是否發送通知（有關鍵字或AI檢測）
  let shouldNotify = emailAnalysis.keywordsFound.length > 0 || emailAnalysis.aiDetected;

  // 強制忽略身份驗證、白名單、Mailgun 驗證信，即使 AI 判定有問題也不通知
    isMailgunVerification = 
      from.includes('support@mailgun.net') &&
      subject.startsWith('Good news -') &&
      subject.endsWith('is now verified');
    containsIdentityVerification = emailAnalysis.keywordsFound.includes("申請寄件者身份驗證");
    containsSmsKeywords = actualBody.includes("簡訊網域申請") || actualBody.includes("簡訊白名單申請");

    const shouldForceIgnore = isMailgunVerification || containsIdentityVerification || containsSmsKeywords;

    if (shouldForceIgnore) {
      Logger.log(`忽略信件（即使 AI 判定有問題）- 寄件者: ${from}, 主旨: ${subject}`);
      return false;
    }
  
  // 發送通知
  if (shouldNotify) {
    try {
      // 發送完整的分析結果對象，而不是修改關鍵字陣列
      sendNotification(subject, from, date, body, actualBody, link, emailAnalysis, message);
      Logger.log(`已發送通知到 Slack - 寄件者: ${from}, 主旨: ${subject}`);
      notificationSent = true;
    } catch (error) {
      Logger.log(`發送通知到 Slack 失敗 - 寄件者: ${from}, 主旨: ${subject}, 錯誤: ${error.toString()}`);
    }
  } else {
    Logger.log(`郵件分析完成，未發現需通知的內容 - 寄件者: ${from}, 主旨: ${subject}`);
  }
  
  // 記錄郵件處理決策的摘要
  Logger.log(`處理摘要 - 郵件ID: ${message.getId()}, 寄件者: ${from}, 主旨: ${subject}` + 
             `, 關鍵字匹配: ${emailAnalysis.keywordsFound.length > 0}` +
             `, AI檢測: ${emailAnalysis.aiDetected}` + 
             `, 發送通知: ${notificationSent}` +
             `, 排除網域: ${isExcludedDomain}` +
             `, 轉寄郵件: ${isForwarded}`);
             
  return notificationSent;
}

/**
 * 設定觸發器 (需要手動運行一次此函數來設定定時觸發)
 */
function setUpTrigger() {
  // 調用模組
  setUpTrigger();
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
