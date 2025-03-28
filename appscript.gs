/**
 * Gmail 關鍵字監控與 Slack 通知系統
 * 
 * 功能：
 * - 監控Gmail中含有特定關鍵字的郵件
 * - 支援單關鍵字和關鍵字組合
 * - 排除特定寄件者網域
 * - 排除引用內容中的關鍵字
 * - 使用Google Gemini AI分析郵件內容情緒和問題
 * - 發送通知到Slack
 */

//========== 設定與常數區域 ==========//

// 監控關鍵字設定
const SINGLE_KEYWORDS = [
  "大量寄送失敗", 
  "大量異常", 
  "大量失敗", 
  "大量退信"
]; //, "退信"單一關鍵字

const KEYWORD_COMBINATIONS = [
  ["詐騙", "異常"],
  // 可添加更多組合，如 ["網路", "中斷"]
]; // 兩個關鍵字的組合

// 排除寄件者設定
const EXCLUDED_DOMAINS = [
  "newsleopard.com", 
  "newsleopard.tw", 
  "softech.com.tw",
  "calendly.com"
]; 

// Slack設定
const SLACK_WEBHOOK_URL = "https://hooks.slack.com/services/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";

// Gmail標籤設定
const CHECKED_LABEL = "監控已檢查"; // 用於標記已處理的郵件
const NOTIFIED_LABEL = "監控已Slack"; // 用於標記已發送到Slack的郵件

// Gemini API 設定
const GEMINI_API_KEY = ""; // 替換為您的 Gemini API 金鑰
const USE_GEMINI_API = true; // 設置為 false 可暫時停用 Gemini API 功能
const GEMINI_MODEL = "gemini-2.0-flash"; // 最新的模型名稱

//========== 主要功能函數 ==========//

/**
 * 主要功能：檢查 Gmail 並發送通知到 Slack
 */
function checkGmailAndNotifySlack() {
  // 收集所有需要搜尋的關鍵字
  let allKeywords = [...SINGLE_KEYWORDS];
  KEYWORD_COMBINATIONS.forEach(combo => {
    allKeywords = allKeywords.concat(combo);
  });
  // 移除重複的關鍵字
  allKeywords = [...new Set(allKeywords)];
  
  // 建立關鍵字搜尋查詢
  let query = buildSearchQuery(allKeywords);
  
  // 搜尋符合條件的郵件
  const threads = GmailApp.search(query, 0, 50);
  
  // 如果沒有找到符合條件的郵件，則結束
  if (threads.length === 0) {
    Logger.log("沒有找到包含關鍵字的新郵件");
    return;
  }

  // 處理每個符合條件的郵件討論串
  processThreads(threads);
}

/**
 * 建立搜尋查詢字串
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
 * 處理郵件討論串
 */
function processThreads(threads) {
  for (const thread of threads) {
    const messages = thread.getMessages();
    const subject = thread.getFirstMessageSubject();
    
    for (const message of messages) {
      // 檢查郵件是否已經有「已檢查」或「已通知到Slack」標籤
      if (!hasLabel(message, CHECKED_LABEL) && !hasLabel(message, NOTIFIED_LABEL)) {
        processMessage(message, subject);
      }
    }
  }
}

/**
 * 處理單個郵件
 */
function processMessage(message, subject) {
  const from = message.getFrom();
  const date = message.getDate();
  const body = message.getPlainBody();
  const link = `https://mail.google.com/mail/u/0/#inbox/${message.getId()}`;
  
  // 記錄開始分析的郵件
  Logger.log(`開始分析郵件 - 寄件者: ${from}, 主旨: ${subject}`);
  
  // 檢查寄件者是否來自排除的網域，如果是則跳過
  if (isFromExcludedDomain(from)) {
    Logger.log(`跳過來自排除網域的郵件: ${from}, 主旨: ${subject}`);
    return; // 跳過這封郵件的處理
  }
  
  // 檢查是否為轉寄郵件
  const isForwarded = message.getSubject().includes("Fwd:") || 
                      message.getSubject().includes("轉寄:") || 
                      message.getSubject().includes("FW:") ||
                      message.getSubject().toLowerCase().includes("forwarded");
  
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
  if (USE_GEMINI_API) {
    Logger.log(`開始使用 Gemini 分析郵件 - 寄件者: ${from}, 主旨: ${subject}`);
    aiAnalysisResult = analyzeEmailWithGemini(subject, actualBody, from);
    
    // 將情緒分析結果存儲到 Properties 服務
    if (aiAnalysisResult) {
      // 使用日期和郵件ID作為唯一鍵
      const today = Utilities.formatDate(new Date(), Session.getScriptTimeZone(), "yyyy-MM-dd");
      const propKey = today + "_email_" + message.getId();
      
      try {
        // 存儲情緒分析結果
        PropertiesService.getScriptProperties().setProperty(propKey, JSON.stringify(aiAnalysisResult));
        Logger.log(`已將情緒分析結果存儲到 Properties 服務 - 郵件ID: ${message.getId()}`);
      } catch (error) {
        Logger.log(`存儲情緒分析結果時出錯：${error.toString()} - 郵件ID: ${message.getId()}`);
      }
    }
    
    // 如果 AI 分析發現值得通知的內容，也發送通知
    if (aiAnalysisResult && aiAnalysisResult.shouldNotify && foundKeywords.length === 0) {
      foundKeywords.push("AI 檢測到需注意內容");
      Logger.log(`Gemini AI 檢測到需注意內容 - 寄件者: ${from}, 主旨: ${subject}`);
    }
  }
  
  // 如果有發現關鍵字或 AI 檢測到問題，則發送通知
  if (foundKeywords.length > 0) {
    sendNotification(subject, from, date, body, actualBody, link, foundKeywords, aiAnalysisResult, message);
  } else {
    Logger.log(`郵件分析完成，未發現需通知的內容 - 寄件者: ${from}, 主旨: ${subject}`);
    // 為所有處理過但未發現關鍵字的郵件也添加「已檢查」標籤
    addLabel(message, CHECKED_LABEL);
  }
}

/**
 * 檢查關鍵字
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
 * 發送 Slack 通知
 */
function sendNotification(subject, from, date, fullBody, actualBody, link, foundKeywords, aiAnalysisResult, message) {
  // 建立 Slack 通知
  const slackMessage = {
    "blocks": [
      {
        "type": "header",
        "text": {
          "type": "plain_text",
          "text": "📨 Gmail 關鍵字通知",
          "emoji": true
        }
      },
      {
        "type": "section",
        "text": {
          "type": "mrkdwn",
          "text": `*發現關鍵字：* ${foundKeywords.join(', ')}`
        }
      },
      {
        "type": "section",
        "fields": [
          {
            "type": "mrkdwn",
            "text": `*主旨：*\n${subject}`
          },
          {
            "type": "mrkdwn",
            "text": `*寄件者：*\n${from}`
          },
          {
            "type": "mrkdwn",
            "text": `*時間：*\n${formatDate(date)}`
          }
        ]
      },
      {
        "type": "section",
        "text": {
          "type": "mrkdwn",
          "text": `*郵件摘要：*\n${truncateBody(actualBody, 300)}`
        }
      }
    ]
  };
  
  // 如果有 AI 分析結果，添加到通知中並凸顯
  if (aiAnalysisResult) {
    // 添加分隔線
    slackMessage.blocks.push({
      "type": "divider"
    });
    
    // 添加 AI 評估結果區塊，並顯示模型資訊
    slackMessage.blocks.push({
      "type": "context",
      "elements": [
        {
          "type": "mrkdwn",
          "text": `*使用模型：* ${GEMINI_MODEL}`
        }
      ]
    });
    
    // 使用不同的樣式凸顯 AI 評估結果
    slackMessage.blocks.push({
      "type": "section",
      "text": {
        "type": "mrkdwn",
        "text": `*🤖 AI評估結果：*\n> ${aiAnalysisResult.summary}`
      }
    });
  }
  
  // 添加按鈕操作
  slackMessage.blocks.push({
    "type": "actions",
    "elements": [
      {
        "type": "button",
        "text": {
          "type": "plain_text",
          "text": "查看完整郵件",
          "emoji": true
        },
        "url": link
      }
    ]
  });
  
  // 發送到 Slack
  sendToSlack(slackMessage);
  
  // 標記郵件為已通知到Slack
  addLabel(message, NOTIFIED_LABEL);
  
  // 同時標記為已處理，確保所有郵件都有標記
  addLabel(message, CHECKED_LABEL);
  
  Logger.log(`發送通知：「${subject}」包含關鍵字「${foundKeywords.join(', ')}」- 寄件者: ${from}`);
}

//========== Gemini API 相關函數 ==========//

/**
 * 使用 Gemini API 分析郵件內容
 */
function analyzeEmailWithGemini(subject, body, from) {
  try {
    // 如果沒有設置 API 金鑰，則返回 null
    if (!GEMINI_API_KEY || GEMINI_API_KEY === "YOUR_GEMINI_API_KEY") {
      Logger.log(`Gemini API 金鑰未設置，跳過 AI 分析 - 寄件者: ${from}, 主旨: ${subject}`);
      return null;
    }
    
    // 準備郵件內容以便分析
    const contentToAnalyze = truncateBody(subject + "\n\n" + body, 1000); // 限制長度以控制請求大小
    
    // 設定提示
    const prompt = `
你是一個專門分析郵件問題的AI專家。請分析以下電子郵件，並判斷是否滿足以下任一條件：
1. 表達極度正面的情緒（如強烈感謝或極大讚賞）
2. 表達極度負面的情緒（如強烈的不滿或憤怒）
3. 反映我們的服務可能有嚴重系統性問題，特別是需符合下列條件之一：
   - 提到大量郵件寄送失敗或退信
   - 提到系統大量異常或錯誤
   - 提到與詐騙相關的安全問題
   - 明確指出服務持續當機或無法使用
   - 影響大量用戶或客戶的系統性問題

注意：一般業務流程中的小問題、單一客戶的個別問題、或可通過一般客服流程解決的問題不應被歸類為需要通知的重大問題。

電子郵件內容：
"""
${contentToAnalyze}
"""

請以JSON格式回答，包含以下欄位：
{
  "shouldNotify": true/false, // 是否需要通知（滿足任一條件則為true）
  "sentiment": "positive"/"negative"/"neutral", // 情緒類型
  "problemDetected": true/false, // 是否檢測到嚴重服務問題
  "summary": "簡短摘要說明分析結果與原因，最多50字"
}
`;

    // 呼叫 Gemini API - 使用最新的 API 版本和端點
    const apiEndpoint = `https://generativelanguage.googleapis.com/v1/models/${GEMINI_MODEL}:generateContent?key=${GEMINI_API_KEY}`;
    const payload = {
      "contents": [
        {
          "parts": [
            {
              "text": prompt
            }
          ]
        }
      ],
      "generationConfig": {
        "temperature": 0.2,
        "topP": 0.8,
        "topK": 40
      }
    };
    
    const options = {
      method: "post",
      contentType: "application/json",
      payload: JSON.stringify(payload),
      muteHttpExceptions: true  // 捕捉完整的錯誤響應
    };
    
    Logger.log(`向 Gemini API 發送請求 - 寄件者: ${from}, 主旨: ${subject}`);
    const response = UrlFetchApp.fetch(apiEndpoint, options);
    const responseCode = response.getResponseCode();
    const responseText = response.getContentText();
    
    // 檢查響應狀態
    if (responseCode !== 200) {
      Logger.log(`API返回錯誤狀態碼: ${responseCode}, 響應內容: ${responseText} - 寄件者: ${from}, 主旨: ${subject}`);
      return null;
    }
    
    const responseData = JSON.parse(responseText);
    
    // 解析回應中的 JSON
    if (responseData.candidates && responseData.candidates[0] && responseData.candidates[0].content) {
      const text = responseData.candidates[0].content.parts[0].text;
      // 從文本中提取 JSON
      const jsonMatch = text.match(/\{[\s\S]*\}/);
      if (jsonMatch) {
        try {
          const jsonResult = JSON.parse(jsonMatch[0]);
          Logger.log(`Gemini 分析結果 - shouldNotify: ${jsonResult.shouldNotify}, sentiment: ${jsonResult.sentiment}, problemDetected: ${jsonResult.problemDetected} - 寄件者: ${from}, 主旨: ${subject}`);
          return jsonResult;
        } catch (parseError) {
          Logger.log(`解析 JSON 時出錯: ${parseError.toString()}, 原始文本: ${text} - 寄件者: ${from}, 主旨: ${subject}`);
          return null;
        }
      }
    }
    
    Logger.log(`無法從 Gemini API 的回應中提取有效的 JSON - 寄件者: ${from}, 主旨: ${subject}`);
    return null;
    
  } catch (error) {
    Logger.log(`使用 Gemini API 分析郵件時出錯：${error.toString()} - 寄件者: ${from}, 主旨: ${subject}`);
    return null;
  }
}

//========== 郵件處理輔助函數 ==========//

/**
 * 檢查郵件是否已有特定標籤
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
 */
function isFromExcludedDomain(senderEmail) {
  // 從寄件者中提取網域
  // 寄件者通常是格式為 "Name <email@domain.com>" 或直接是 "email@domain.com"
  const emailMatch = senderEmail.match(/[a-zA-Z0-9._%+-]+@([a-zA-Z0-9.-]+\.[a-zA-Z]{2,})/);
  if (!emailMatch) return false;
  
  const domain = emailMatch[1].toLowerCase();
  
  // 檢查網域是否在排除列表中
  for (const excludedDomain of EXCLUDED_DOMAINS) {
    if (domain === excludedDomain.toLowerCase() || domain.endsWith('.' + excludedDomain.toLowerCase())) {
      return true;
    }
  }
  
  return false;
}

/**
 * 提取實際郵件內容，排除引用部分
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

//========== 通用工具函數 ==========//

/**
 * 發送消息到 Slack
 */
function sendToSlack(message) {
  const options = {
    "method": "post",
    "contentType": "application/json",
    "payload": JSON.stringify(message),
    "muteHttpExceptions": true
  };
  
  try {
    const response = UrlFetchApp.fetch(SLACK_WEBHOOK_URL, options);
    const responseCode = response.getResponseCode();
    
    if (responseCode !== 200) {
      Logger.log(`Slack 返回錯誤: 狀態碼 ${responseCode}, 內容: ${response.getContentText()}`);
      return null;
    }
    
    return response.getContentText();
  } catch (error) {
    Logger.log(`發送到 Slack 時出錯：${error.toString()}`);
    return null;
  }
}

/**
 * 格式化日期
 */
function formatDate(date) {
  return Utilities.formatDate(date, Session.getScriptTimeZone(), "yyyy/MM/dd HH:mm:ss");
}

/**
 * 截斷過長的郵件內容
 */
function truncateBody(text, maxLength) {
  if (text.length <= maxLength) {
    return text;
  }
  return text.substring(0, maxLength) + "...";
}

//========== 每日統計功能 ==========//

/**
 * 每日郵件統計與關鍵字報告
 * 搭配 Properties 服務存儲當日郵件情緒分析結果
 */
function dailyStatisticsReport() {
  // 獲取今天的日期
  const today = Utilities.formatDate(new Date(), Session.getScriptTimeZone(), "yyyy-MM-dd");
  Logger.log(`開始生成 ${today} 日統計報告`);
  
  // 統計基本數據
  const stats = {
    totalEmails: countCheckedEmails(),
    keywordTriggeredEmails: countKeywordTriggeredEmails(),
    positiveEmotions: 0,
    negativeEmotions: 0,
    neutralEmotions: 0,
    problemDetected: 0
  };
  
  // 從 Properties 服務獲取情緒分析數據
  const emotionStats = getEmotionStatsFromProperties();
  stats.positiveEmotions = emotionStats.positive;
  stats.negativeEmotions = emotionStats.negative;
  stats.neutralEmotions = emotionStats.neutral;
  stats.problemDetected = emotionStats.problemDetected;
  
  // 使用 Gemini API 生成分析摘要
  let aiSummary = "AI 未能生成分析摘要。";
  if (USE_GEMINI_API) {
    aiSummary = generateDailySummaryWithGemini(stats);
  }
  
  // 發送統計數據到 Slack
  sendDailyStatisticsToSlack(stats, aiSummary);
  
  Logger.log(`${today} 日統計報告已完成並發送到 Slack`);
}

/**
 * 統計檢查過的郵件數量
 */
function countCheckedEmails() {
  // 獲取帶有「已檢查」標籤且日期是今天的郵件
  const today = new Date();
  const formattedDate = Utilities.formatDate(today, Session.getScriptTimeZone(), "yyyy/MM/dd");
  const query = `label:${CHECKED_LABEL} after:${formattedDate}`;
  
  try {
    const threads = GmailApp.search(query);
    let messageCount = 0;
    
    // 計算所有討論串中的郵件數量
    for (const thread of threads) {
      messageCount += thread.getMessageCount();
    }
    
    Logger.log(`找到 ${messageCount} 封今天檢查過的郵件`);
    return messageCount;
  } catch (error) {
    Logger.log(`計算檢查郵件時出錯：${error.toString()}`);
    return 0;
  }
}

/**
 * 統計觸發關鍵字的郵件數量
 */
function countKeywordTriggeredEmails() {
  // 獲取帶有「已通知到Slack」標籤且日期是今天的郵件
  const today = new Date();
  const formattedDate = Utilities.formatDate(today, Session.getScriptTimeZone(), "yyyy/MM/dd");
  const query = `label:${NOTIFIED_LABEL} after:${formattedDate}`;
  
  try {
    const threads = GmailApp.search(query);
    let messageCount = 0;
    
    // 計算所有討論串中的郵件數量
    for (const thread of threads) {
      messageCount += thread.getMessageCount();
    }
    
    Logger.log(`找到 ${messageCount} 封今天觸發關鍵字的郵件`);
    return messageCount;
  } catch (error) {
    Logger.log(`計算關鍵字郵件時出錯：${error.toString()}`);
    return 0;
  }
}

/**
 * 從 Properties 服務獲取情緒統計數據
 */
function getEmotionStatsFromProperties() {
  const stats = {
    positive: 0,
    negative: 0,
    neutral: 0,
    problemDetected: 0
  };
  
  try {
    // 獲取所有帶有今天日期前綴的屬性
    const today = Utilities.formatDate(new Date(), Session.getScriptTimeZone(), "yyyy-MM-dd");
    const props = PropertiesService.getScriptProperties().getProperties();
    
    // 遍歷屬性並統計情緒數據
    for (const key in props) {
      if (key.startsWith(today + "_email_")) {
        try {
          const aiAnalysisResult = JSON.parse(props[key]);
          
          // 統計情緒類型
          if (aiAnalysisResult.sentiment === "positive") {
            stats.positive++;
          } else if (aiAnalysisResult.sentiment === "negative") {
            stats.negative++;
          } else {
            stats.neutral++;
          }
          
          // 統計檢測到問題的數量
          if (aiAnalysisResult.problemDetected) {
            stats.problemDetected++;
          }
        } catch (parseError) {
          Logger.log(`解析情緒數據時出錯：${parseError.toString()}`);
        }
      }
    }
    
    Logger.log(`情緒統計結果：正面=${stats.positive}, 負面=${stats.negative}, 中性=${stats.neutral}, 問題=${stats.problemDetected}`);
    return stats;
  } catch (error) {
    Logger.log(`獲取情緒統計時出錯：${error.toString()}`);
    return stats;
  }
}

/**
 * 使用 Gemini API 生成每日統計摘要
 */
function generateDailySummaryWithGemini(stats) {
  try {
    // 如果沒有設置 API 金鑰，則返回默認訊息
    if (!GEMINI_API_KEY || GEMINI_API_KEY === "YOUR_GEMINI_API_KEY") {
      Logger.log(`Gemini API 金鑰未設置，無法生成每日摘要`);
      return "AI 分析摘要功能暫時不可用（API 金鑰未設置）。";
    }
    
    // 準備提示詞
    const prompt = `
請為以下郵件監控數據生成一個簡短的每日摘要報告。注意：你的回答將在Slack消息中被明確標記為「AI生成內容」。

今日統計數據：
- 檢查郵件總數: ${stats.totalEmails}
- 觸發關鍵字郵件數: ${stats.keywordTriggeredEmails}
- 情緒分布：正面(${stats.positiveEmotions}), 負面(${stats.negativeEmotions}), 中性(${stats.neutralEmotions})
- 檢測到問題的郵件: ${stats.problemDetected}

請提供簡短的分析和見解，重點關注任何異常或趨勢。整體保持在100字以內。回傳純文字，不要使用JSON格式。
`;
    
    // 呼叫 Gemini API
    const apiEndpoint = `https://generativelanguage.googleapis.com/v1/models/${GEMINI_MODEL}:generateContent?key=${GEMINI_API_KEY}`;
    const payload = {
      "contents": [
        {
          "parts": [
            {
              "text": prompt
            }
          ]
        }
      ],
      "generationConfig": {
        "temperature": 0.2,
        "topP": 0.8,
        "topK": 40
      }
    };
    
    const options = {
      method: "post",
      contentType: "application/json",
      payload: JSON.stringify(payload),
      muteHttpExceptions: true
    };
    
    Logger.log(`向 Gemini API 發送每日統計摘要請求`);
    const response = UrlFetchApp.fetch(apiEndpoint, options);
    const responseCode = response.getResponseCode();
    const responseText = response.getContentText();
    
    // 檢查響應狀態
    if (responseCode !== 200) {
      Logger.log(`API返回錯誤狀態碼: ${responseCode}, 響應內容: ${responseText}`);
      return "AI 無法生成分析（API 錯誤）。";
    }
    
    const responseData = JSON.parse(responseText);
    
    // 提取文本內容
    if (responseData.candidates && responseData.candidates[0] && responseData.candidates[0].content) {
      const summaryText = responseData.candidates[0].content.parts[0].text;
      Logger.log(`成功生成每日統計摘要`);
      return summaryText;
    }
    
    Logger.log(`無法從 Gemini API 的回應中提取有效內容`);
    return "AI 無法生成有效的分析摘要。";
    
  } catch (error) {
    Logger.log(`生成每日統計摘要時出錯：${error.toString()}`);
    return "生成AI分析時發生錯誤。";
  }
}

/**
 * 發送每日統計數據到 Slack
 */
function sendDailyStatisticsToSlack(stats, aiSummary) {
  // 計算百分比的輔助函數
  function calculatePercentage(part, total) {
    if (total === 0) return 0;
    return Math.round((part / total) * 100);
  }
  
  // 創建 Slack 消息結構
  const slackMessage = {
    "blocks": [
      {
        "type": "header",
        "text": {
          "type": "plain_text",
          "text": `📊 每日郵件監控統計報告 (${Utilities.formatDate(new Date(), Session.getScriptTimeZone(), "yyyy/MM/dd")})`,
          "emoji": true
        }
      },
      {
        "type": "section",
        "text": {
          "type": "mrkdwn",
          "text": "📧 *基本統計數據：*"
        }
      },
      {
        "type": "section",
        "text": {
          "type": "mrkdwn",
          "text": `• 今日檢查郵件總數: ${stats.totalEmails}\n• 觸發關鍵字的郵件數: ${stats.keywordTriggeredEmails}\n• 情緒分析分布:\n  - 正面情緒: ${stats.positiveEmotions} (${calculatePercentage(stats.positiveEmotions, stats.totalEmails)}%)\n  - 負面情緒: ${stats.negativeEmotions} (${calculatePercentage(stats.negativeEmotions, stats.totalEmails)}%)\n  - 中性情緒: ${stats.neutralEmotions} (${calculatePercentage(stats.neutralEmotions, stats.totalEmails)}%)\n• 檢測到問題的郵件數: ${stats.problemDetected} (${calculatePercentage(stats.problemDetected, stats.totalEmails)}%)`
        }
      },
      {
        "type": "divider"
      },
      {
        "type": "context",
        "elements": [
          {
            "type": "mrkdwn",
            "text": "🤖 *AI 生成的分析報告*\n(由 Google Gemini " + GEMINI_MODEL + " 模型生成)"
          }
        ]
      },
      {
        "type": "section",
        "text": {
          "type": "mrkdwn",
          "text": `${aiSummary}`
        }
      }
    ]
  };
  
  // 發送到 Slack
  sendToSlack(slackMessage);
  Logger.log(`每日統計報告已發送到 Slack`);
}

/**
 * 清除舊的情緒數據
 */
function clearOldEmotionData() {
  try {
    const today = Utilities.formatDate(new Date(), Session.getScriptTimeZone(), "yyyy-MM-dd");
    const props = PropertiesService.getScriptProperties().getProperties();
    let clearedCount = 0;
    
    for (const key in props) {
      if (key.indexOf("_email_") > -1 && !key.startsWith(today)) {
        PropertiesService.getScriptProperties().deleteProperty(key);
        clearedCount++;
      }
    }
    
    Logger.log(`已清除 ${clearedCount} 個舊的情緒數據項目`);
  } catch (error) {
    Logger.log(`清除舊情緒數據時出錯：${error.toString()}`);
  }
}

//========== 設定與觸發器 ==========//

/**
 * 設定觸發器 (需要手動運行一次此函數來設定定時觸發)
 */
function setUpTrigger() {
  // 刪除現有的觸發器，以避免重複
  const triggers = ScriptApp.getProjectTriggers();
  for (const trigger of triggers) {
    if (trigger.getHandlerFunction() === "checkGmailAndNotifySlack" || 
        trigger.getHandlerFunction() === "dailyStatisticsReport") {
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
