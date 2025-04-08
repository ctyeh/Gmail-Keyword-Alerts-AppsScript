/**
 * notificationRules.js
 * 
 * 集中管理所有通知條件
 * - 判斷是否應發送通知
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

  // 有關鍵字或 AI 判定需通知
  return (emailAnalysis.keywordsFound && emailAnalysis.keywordsFound.length > 0 || emailAnalysis.aiDetected) && !isPromotional;
}
