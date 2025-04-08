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
  // 這裡將來會重構為調用 ignoreRules, notificationRules, gemini, slack 等模組
  // 暫時保留原始邏輯，後續逐步拆分
  // ...
}
