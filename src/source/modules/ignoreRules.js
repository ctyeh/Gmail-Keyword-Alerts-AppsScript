/**
 * ignoreRules.js
 * 
 * 集中管理所有忽略條件
 * - 判斷是否應忽略郵件
 * 
 * 依賴模組:
 * - env.js (常數設定)
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

  // 忽略所有來自 newsleopard.tw 網域的郵件
  if (from.includes('@newsleopard.tw')) {
    Logger.log(`完全忽略來自 newsleopard.tw 網域的郵件 - 寄件者: ${from}, 主旨: ${subject}`);
    return true;
  }

  const isMailgunVerification = 
    from.includes('support@mailgun.net') &&
    subject.startsWith('Good news -') &&
    subject.endsWith('is now verified');

  const containsIdentityVerification = body.includes("申請寄件者身份驗證");
  const containsSmsKeywords = body.includes("簡訊網域申請") || body.includes("簡訊白名單申請");
  
  // 判斷是否為電子豹客服回信 - 放寬條件
  const isNewsLeopardCustomerService = 
    (from.includes('service@newsleopard.com') || from.includes('service@newsleopard.tw')) &&
    (subject.includes('電子豹') || subject.includes('NewsLeopard'));

  return isMailgunVerification || containsIdentityVerification || containsSmsKeywords || isNewsLeopardCustomerService;
}
