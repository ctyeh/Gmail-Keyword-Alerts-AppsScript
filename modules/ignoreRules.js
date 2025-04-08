/**
 * ignoreRules.js
 * 
 * 集中管理所有忽略條件
 * - 判斷是否應忽略郵件
 */

/**
 * 判斷是否應忽略此郵件
 * 
 * @param {GmailMessage} message - 郵件物件
 * @param {String} subject - 郵件主旨
 * @param {String} body - 郵件內容
 * @return {Boolean} 是否應忽略
 */
function shouldIgnore(message, subject, body) {
  const from = message.getFrom();

  const isMailgunVerification = 
    from.includes('support@mailgun.net') &&
    subject.startsWith('Good news -') &&
    subject.endsWith('is now verified');

  const containsIdentityVerification = body.includes("申請寄件者身份驗證");
  const containsSmsKeywords = body.includes("簡訊網域申請") || body.includes("簡訊白名單申請");

  return isMailgunVerification || containsIdentityVerification || containsSmsKeywords;
}
