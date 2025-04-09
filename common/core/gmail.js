/**
 * core/gmail.js - Gmail API 核心功能模組
 * 
 * 此檔案包含所有與 Gmail 相關的核心功能，包括:
 * - 郵件標籤操作
 * - 關鍵字檢查
 * - 內容提取
 * - 網域過濾
 * 
 * 作為核心 API 模組，負責與 Gmail 服務的所有交互
 * 
 * 依賴模組:
 * - env.js (EXCLUDED_DOMAINS, SINGLE_KEYWORDS, KEYWORD_COMBINATIONS)
 */

/**
 * 建立搜尋查詢字串
 * 
 * @param {Array<String>} keywords - 關鍵字列表
 * @return {String} - 完整的搜尋查詢字串
 */
function buildSearchQuery(keywords) {
  // 建立關鍵字搜尋查詢
  let query = "";
  for (let i = 0; i < keywords.length; i++) {
    if (i > 0) query += " OR ";
    query += `(${keywords[i]})`;
  }
  
  // 添加標籤過濾，只搜尋未處理且未通知的郵件
  query += ` -label:${CHECKED_LABEL} -label:${NOTIFIED_LABEL}`;
  
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
 * 檢查郵件是否已有特定標籤
 * 
 * @param {GmailMessage} message - Gmail 郵件對象
 * @param {String} labelName - 標籤名稱
 * @return {Boolean} - 是否有此標籤
 */
function hasLabel(message, labelName) {
  const labels = message.getThread().getLabels();
  for (const label of labels) {
    if (label.getName() === labelName) {
      return true;
    }
  }
  return false;
}

/**
 * 添加標籤到郵件
 * 
 * @param {GmailMessage} message - Gmail 郵件對象
 * @param {String} labelName - 要添加的標籤名稱
 */
function addLabel(message, labelName) {
  let label = GmailApp.getUserLabelByName(labelName);
  
  // 如果標籤不存在，則創建它
  if (!label) {
    label = GmailApp.createLabel(labelName);
  }
  
  // 將標籤添加到包含此郵件的討論串
  message.getThread().addLabel(label);
}

/**
 * 檢查寄件者是否來自排除的網域
 * 
 * @param {String} senderEmail - 寄件者郵件地址
 * @return {Boolean} - 是否來自排除網域
 */
function isFromExcludedDomain(senderEmail) {
  // 從寄件者中提取網域
  const domain = extractDomainFromSender(senderEmail);
  if (!domain) return false;
  
  // 檢查網域是否在排除列表中
  for (const excludedDomain of EXCLUDED_DOMAINS) {
    if (domain === excludedDomain.toLowerCase() || domain.endsWith('.' + excludedDomain.toLowerCase())) {
      return true;
    }
  }
  
  return false;
}

/**
 * 檢查郵件內容是否包含關鍵字
 * 
 * @param {String} subject - 郵件主旨
 * @param {String} body - 郵件內容
 * @param {Boolean} isForwarded - 是否為轉寄郵件
 * @return {Array<String>} - 找到的關鍵字列表
 */
function checkKeywords(subject, body, isForwarded) {
  const foundKeywords = [];
  
  // 如果是轉寄郵件，使用更嚴格的檢查（只檢查主旨和轉寄郵件的前100個字符）
  const contentToCheck = isForwarded 
    ? subject + " " + body.substring(0, 100) 
    : subject + " " + body;
  
  // 檢查單一關鍵字
  for (const keyword of SINGLE_KEYWORDS) {
    if (contentToCheck.includes(keyword)) {
      foundKeywords.push(keyword);
    }
  }
  
  // 檢查關鍵字組合
  for (const combination of KEYWORD_COMBINATIONS) {
    const [keyword1, keyword2] = combination;
    if (contentToCheck.includes(keyword1) && contentToCheck.includes(keyword2)) {
      foundKeywords.push(`${keyword1} + ${keyword2}`);
    }
  }
  
  return foundKeywords;
}

/**
 * 提取實際郵件內容，排除引用部分
 * 
 * @param {String} body - 郵件原始內容
 * @return {String} - 提取的實際內容
 */
function extractActualContent(body) {
  // 常見的郵件引用標記
  const quotePatterns = [
    /----+ ?Original Message ?----+/i,
    /On .+wrote:/i,
    /From:.*Sent:/i,
    /^>.*$/m,
    /forwarded message/i,
    /.*?\[mailto:.*?\]/i,
    /From:/i,
    /Subject:/i,
    /Date:/i,
    /To:/i,
    /轉寄:/i,
    /Forwarded:/i,
    /寄件者:/i,
    /收件者:/i,
    /日期:/i,
    /主旨:/i,
    /於\s+\d{4}年\d{1,2}月\d{1,2}日[\s\S]*?寫道[：:]/i, // 匹配中文郵件回覆格式，例如：「於 2025年3月27日 週四 下午2:52寫道：」
    /<[\w\.-]+@[\w\.-]+\.[a-zA-Z]{2,}>\s+於[\s\S]*?寫道[：:]/i // 匹配帶有電子郵件的中文回覆格式
  ];

  // 尋找第一個匹配的引用標記
  let quoteIndex = body.length;
  for (const pattern of quotePatterns) {
    const match = body.match(pattern);
    if (match && match.index < quoteIndex) {
      quoteIndex = match.index;
    }
  }

  // 如果找到引用標記，則返回引用標記之前的內容
  if (quoteIndex < body.length) {
    return body.substring(0, quoteIndex).trim();
  }

  // 轉寄郵件的檢測
  // 檢查是否有類似 "---------- Forwarded message ---------" 的文字
  const forwardedMatch = body.match(/[-]+\s*[Ff]orwarded\s+message\s*[-]+/);
  if (forwardedMatch) {
    return body.substring(0, forwardedMatch.index).trim();
  }
  
  // 中文轉寄郵件的檢測
  const chineseForwardedMatch = body.match(/[-]+\s*轉寄的郵件\s*[-]+/);
  if (chineseForwardedMatch) {
    return body.substring(0, chineseForwardedMatch.index).trim();
  }

  // 另一種方法：尋找連續的分隔線，通常表示引用開始
  const separatorMatch = body.match(/\n-{3,}\n/);
  if (separatorMatch) {
    return body.substring(0, separatorMatch.index).trim();
  }

  // 如果找不到任何引用標記，返回原始內容
  return body;
}

/**
 * 計算帶有特定標籤的郵件數量
 * 
 * @param {String} label - 標籤名稱
 * @param {String} dateQuery - 日期查詢條件，如 "after:2025/03/27"
 * @return {Number} - 郵件數量
 */
function countLabeledEmails(label, dateQuery) {
  const query = `label:${label} ${dateQuery}`;
  
  try {
    const threads = GmailApp.search(query);
    let messageCount = 0;
    
    // 計算所有討論串中的郵件數量
    for (const thread of threads) {
      messageCount += thread.getMessageCount();
    }
    
    return messageCount;
  } catch (error) {
    Logger.log(`計算標籤${label}的郵件時出錯：${error.toString()}`);
    return 0;
  }
}

/**
 * 判斷郵件是否為轉寄郵件
 * 
 * @param {String} subject - 郵件主旨
 * @return {Boolean} - 是否為轉寄郵件
 */
function isForwardedEmail(subject) {
  return subject.includes("Fwd:") || 
         subject.includes("轉寄:") || 
         subject.includes("FW:") ||
         subject.toLowerCase().includes("forwarded");
}
