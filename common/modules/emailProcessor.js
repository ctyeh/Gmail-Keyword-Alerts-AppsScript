/**
 * emailProcessor.js
 * 
 * 專責 Gmail 郵件討論串與郵件的處理流程
 * - 處理討論串
 * - 處理單封郵件
 * - 調用忽略規則、AI 分析、標籤、通知模組
 */

/**
 * 處理郵件討論串
 * 
 * @param {Array<GmailThread>} threads - Gmail 討論串陣列
 * @return {Object} 處理統計資訊
 */
function processThreads(threads) {
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

  // 檢查是否應該完全忽略此郵件
  if (shouldIgnore(message, subject, body)) {
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
  if (isForwarded) {
    Logger.log(`檢測到轉寄郵件: ${subject}`);
  }
  
  // 獲取郵件的實際內容（排除引用部分）
  const actualBody = extractActualContent(body);
  
  // 檢查郵件內容是否包含關鍵字
  const foundKeywords = checkKeywords(subject, actualBody, isForwarded);
  if (foundKeywords.length > 0) {
    Logger.log(`在郵件中發現關鍵字: ${foundKeywords.join(', ')} - 寄件者: ${from}, 主旨: ${subject}`);
  }
  
  // 創建郵件分析結果對象
  const emailAnalysis = {
    keywordsFound: foundKeywords,   // 實際找到的關鍵字
    aiDetected: false,              // AI 是否檢測到需注意內容
    aiAnalysisResult: null          // 完整的 AI 分析結果
  };
  
  // 使用 Gemini API 進行情緒分析
  if (USE_GEMINI_API) {
    Logger.log(`開始使用 Gemini 分析郵件 - 寄件者: ${from}, 主旨: ${subject}`);
    emailAnalysis.aiAnalysisResult = analyzeEmailWithGemini(subject, actualBody, from);
    
    // 將情緒分析結果存儲到 Properties 服務
    if (emailAnalysis.aiAnalysisResult) {
      storeEmotionAnalysisResult(message, emailAnalysis.aiAnalysisResult);
      
      // 統一判斷標準
      if (emailAnalysis.aiAnalysisResult.problemDetected && !emailAnalysis.aiAnalysisResult.shouldNotify) {
        Logger.log(`發現不一致判斷：problemDetected=true 但 shouldNotify=false，強制設置shouldNotify=true - 寄件者: ${from}, 主旨: ${subject}`);
        emailAnalysis.aiAnalysisResult.shouldNotify = true;
      }
      
      // 標記 AI 是否檢測到需注意的內容
      if (emailAnalysis.aiAnalysisResult.shouldNotify) {
        emailAnalysis.aiDetected = true;
        Logger.log(`Gemini AI 檢測到需注意內容 (嚴重程度: ${emailAnalysis.aiAnalysisResult.severity || '未知'}) - 寄件者: ${from}, 主旨: ${subject}`);
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
  
  // 檢查是否符合關鍵字，標記
  if (emailAnalysis.keywordsFound.length > 0) {
    addLabel(message, KEYWORD_LABEL);
    Logger.log(`郵件標記為關鍵字符合 - 寄件者: ${from}, 主旨: ${subject}`);
  }
  
  // 檢查 AI 是否檢測到需注意內容，標記
  if (emailAnalysis.aiDetected) {
    // 只有非排除網域的郵件才添加「AI 建議注意」標籤
    if (!isExcludedDomain) {
      addLabel(message, AI_ALERT_LABEL);
      Logger.log(`郵件標記為 AI 建議注意 - 寄件者: ${from}, 主旨: ${subject}`);
    } else {
      Logger.log(`郵件被 AI 檢測為需注意，但來自排除網域，不添加標籤 - 寄件者: ${from}, 主旨: ${subject}`);
    }
  }
  
  // 決定是否發送通知
  const shouldSendNotification = shouldNotify(emailAnalysis, message, subject, actualBody);
  
  // 發送通知
  if (shouldSendNotification) {
    try {
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
