/**
 * notificationRules.js
 * 
 * 集中管理所有通知條件
 * - 判斷是否應發送通知
 * 
 * 依賴模組:
 * - env.js (常數設定)
 */

/**
 * 判斷是否應發送通知
 * 
 * @param {Object} emailAnalysis - 郵件分析結果
 * @param {GmailMessage} message - 郵件物件
 * @param {String} subject - 郵件主旨
 * @param {String} body - 郵件內容
 * @return {Boolean} 是否應通知
 */
function shouldNotify(emailAnalysis, message, subject, body) {
  const from = message.getFrom();

  const containsIdentityVerification = emailAnalysis.keywordsFound && emailAnalysis.keywordsFound.includes("申請寄件者身份驗證");
  const isPromotional = emailAnalysis.aiAnalysisResult && emailAnalysis.aiAnalysisResult.isPromotional === true;
  const containsSmsKeywords = body.includes("簡訊網域申請") || body.includes("簡訊白名單申請");

  // 強制忽略條件優先
  const isMailgunVerification = 
    from.includes('support@mailgun.net') &&
    subject.startsWith('Good news -') &&
    subject.endsWith('is now verified');

  if (isMailgunVerification || containsIdentityVerification || containsSmsKeywords) {
    return false;
  }

  // ===== 新增嚴重程度評估 =====
  // 對於關鍵字匹配的郵件，通常較為重要，直接通知
  if (emailAnalysis.keywordsFound && emailAnalysis.keywordsFound.length > 0 && !isPromotional) {
    return true; // 關鍵字匹配郵件優先級較高，直接通知
  }

  // 對於只有 AI 判定的郵件，根據嚴重程度決定是否通知
  if (emailAnalysis.aiDetected && emailAnalysis.aiAnalysisResult) {
    // 獲取嚴重程度，若未定義則視為中度嚴重
    const severity = emailAnalysis.aiAnalysisResult.severity || "medium";
    
    // 只有高度嚴重(high)或緊急(urgent)的郵件才發送到Slack
    if (severity === "high" || severity === "urgent") {
      return true;
    } else {
      // 記錄低嚴重程度的郵件被過濾
      Logger.log(`郵件嚴重程度為 ${severity}，不符合Slack通知條件 - 寄件者: ${from}, 主旨: ${subject}`);
      return false;
    }
  }

  // 其他情況：有關鍵字或 AI 判定需通知且非促銷
  return (emailAnalysis.keywordsFound && emailAnalysis.keywordsFound.length > 0 || emailAnalysis.aiDetected) && !isPromotional;
}
