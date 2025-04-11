/**
 * core/gemini.js - Google Gemini API 核心功能模組
 * 
 * 此檔案包含所有與 Gemini AI 分析相關的核心功能，包括:
 * - 郵件內容情緒分析
 * - 每日統計報告生成
 * - AI API 請求處理
 * 
 * 作為核心 API 模組，負責與外部 Gemini 服務的所有交互
 * 
 * 依賴模組:
 * - env.js (USE_GEMINI_API, GEMINI_API_KEY, GEMINI_MODEL)
 * - utils.js (truncateBody)
 */

// 新增 API 請求速率控制全局變數
const GEMINI_API_RATE_LIMIT = 3; // 每秒最大請求數
const GEMINI_REQUEST_QUEUE = []; // 請求時間戳記錄
const GEMINI_REQUEST_INTERVAL_MS = 1000 / GEMINI_API_RATE_LIMIT; // 請求間隔毫秒數

/**
 * 檢查 API 請求速率並進行必要的延遲
 * 
 * @return {Number} 延遲的毫秒數，如果無需延遲則為 0
 */
function checkAndApplyRateLimit() {
  const now = new Date().getTime();
  
  // 清理超過 1 秒的舊請求記錄
  while (GEMINI_REQUEST_QUEUE.length > 0 && now - GEMINI_REQUEST_QUEUE[0] > 1000) {
    GEMINI_REQUEST_QUEUE.shift();
  }
  
  // 如果最近 1 秒內的請求數已達到速率限制
  if (GEMINI_REQUEST_QUEUE.length >= GEMINI_API_RATE_LIMIT) {
    // 計算需要等待的時間
    const oldestTimestamp = GEMINI_REQUEST_QUEUE[0];
    const waitTime = 1000 - (now - oldestTimestamp);
    
    // 如果需要等待
    if (waitTime > 0) {
      Logger.log(`API 速率控制：等待 ${waitTime}ms 以符合速率限制（每秒 ${GEMINI_API_RATE_LIMIT} 次）`);
      Utilities.sleep(waitTime);
      
      // 更新當前時間
      const newNow = new Date().getTime();
      GEMINI_REQUEST_QUEUE.push(newNow);
      return waitTime;
    }
  }
  
  // 記錄這次請求的時間
  GEMINI_REQUEST_QUEUE.push(now);
  return 0;
}

/**
 * 使用 Gemini API 分析郵件內容
 * 
 * @param {String} subject - 郵件主旨
 * @param {String} body - 郵件內容
 * @param {String} from - 寄件者
 * @return {Object|null} - 分析結果物件或 null (失敗時)
 */
function analyzeEmailWithGemini(subject, body, from) {
  try {
    // 獲取 API 金鑰
    const apiKey = getGeminiApiKey();
    
    // 如果沒有設置 API 金鑰，則返回 null
    if (!apiKey || apiKey === "YOUR_GEMINI_API_KEY") {
      Logger.log(`Gemini API 金鑰未設置，跳過 AI 分析 - 寄件者: ${from}, 主旨: ${subject}`);
      return null;
    }
    
    // 準備郵件內容以便分析
    const contentToAnalyze = truncateBody(subject + "\n\n" + body, 1000); // 限制長度以控制請求大小
    
    // 設定提示
    const prompt = `
你是一個專門分析郵件問題的AI專家。請分析以下電子郵件，並判斷情緒類型、是否需要通知管理員，以及是否為活動廣告。

詳細分析以下情緒類型：

正面情緒：
- delighted (欣喜): 用戶表達強烈喜悅或興奮
- grateful (感謝): 用戶表達感激或謝意
- impressed (印象深刻): 用戶對服務或產品表示讚賞
- satisfied (滿意): 用戶表達一般程度的滿意或認可
- hopeful (充滿希望): 用戶對未來結果表示樂觀

負面情緒：
- angry (憤怒): 用戶表達強烈不滿或憤怒
- frustrated (沮喪): 用戶表達挫折感或不便
- disappointed (失望): 用戶表達期望未被滿足
- worried (擔憂): 用戶對某事表示擔心或焦慮
- confused (困惑): 用戶表示不理解或混淆

中性情緒：
- factual (事實陳述): 用戶純粹傳達資訊或事實
- inquiring (詢問): 用戶主要是在詢問資訊
- informative (提供信息): 用戶在提供資訊或回饋

同時判斷是否滿足以下任一需通知條件：
1. 表達極度正面或負面的情緒（如強烈感謝、極大讚賞、強烈的不滿或憤怒）
2. 反映我們的服務可能有嚴重系統性問題，特別是需符合下列條件之一：
   - 提到大量郵件寄送失敗或退信
   - 提到系統大量異常或錯誤
   - 提到與詐騙相關的安全問題
   - 明確指出服務持續當機或無法使用
   - 影響大量用戶或客戶的系統性問題

並準確判斷郵件是否為活動廣告，具有下列特徵：
1. 促銷活動、限時折扣、特價優惠等商業行銷內容
2. 新產品發布、活動邀請、研討會通知等公告性質廣告
3. 電子報、電子郵件行銷活動、促銷通知
4. 非個人化的群發性商業訊息

注意：一般業務流程中的小問題、單一客戶的個別問題、或可通過一般客服流程解決的問題不應被歸類為需要通知的重大問題。

注意：若郵件內容符合上述第2點中任一項，則同時應設置「problemDetected=true」和「shouldNotify=true」，兩者必須一致。若只是極端情緒但無系統問題，則設置「shouldNotify=true」但「problemDetected=false」。

同時，請評估郵件的嚴重程度：
- "low": 一般性查詢、感謝、簡單資訊請求等
- "medium": 中等關注的問題，但不算緊急
- "high": 重大問題，需要馬上關注
- "urgent": 緊急事件，需要立即處理

電子郵件內容：
"""
${contentToAnalyze}
"""

請以JSON格式回答，包含以下欄位：
{
  "shouldNotify": true/false, // 是否需要通知（滿足任一條件則為true）
  "primarySentiment": "positive"/"negative"/"neutral", // 主要情緒傾向
  "detailedEmotion": "delighted"/"grateful"/"impressed"/"satisfied"/"hopeful"/"angry"/"frustrated"/"disappointed"/"worried"/"confused"/"factual"/"inquiring"/"informative", // 詳細情緒類型
  "problemDetected": true/false, // 是否檢測到嚴重服務問題
  "isPromotional": true/false, // 是否為活動廣告/促銷郵件
  "severity": "low"/"medium"/"high"/"urgent", // 郵件嚴重程度
  "summary": "簡短摘要說明分析結果與原因，最多50字"
}
`;

    // 應用 API 速率限制
    checkAndApplyRateLimit();
    
    // 呼叫 Gemini API - 使用最新的 API 版本和端點
    const apiEndpoint = `https://generativelanguage.googleapis.com/v1/models/${GEMINI_MODEL}:generateContent?key=${apiKey}`;
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
      notifyLlmErrorToSlack(`狀態碼: ${responseCode}`, responseText);
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
          
          // 確保與舊格式相容
          if (jsonResult.primarySentiment && !jsonResult.sentiment) {
            jsonResult.sentiment = jsonResult.primarySentiment;
          } else if (jsonResult.sentiment && !jsonResult.primarySentiment) {
            jsonResult.primarySentiment = jsonResult.sentiment;
          }

          // 確保嚴重程度已設置，預設為 medium
          if (!jsonResult.severity) {
            jsonResult.severity = "medium";
          }
          
          // 記錄詳細的分析結果
          Logger.log(`Gemini 分析結果 - shouldNotify: ${jsonResult.shouldNotify}, primarySentiment: ${jsonResult.primarySentiment}, detailedEmotion: ${jsonResult.detailedEmotion || "未指定"}, problemDetected: ${jsonResult.problemDetected}, isPromotional: ${jsonResult.isPromotional || false}, severity: ${jsonResult.severity} - 寄件者: ${from}, 主旨: ${subject}`);
          
          // 檢查判斷一致性
          if (jsonResult.problemDetected && !jsonResult.shouldNotify) {
            Logger.log(`⚠️ 警告：AI返回不一致判斷 - problemDetected=true 但 shouldNotify=false - 寄件者: ${from}, 主旨: ${subject}`);
          }
          
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
    notifyLlmErrorToSlack(error.toString(), "");
    return null;
  }
}

/**
 * 記錄郵件分析結果到日誌
 * 
 * @param {GmailMessage} message - Gmail 郵件對象
 * @param {String} subject - 郵件主旨
 * @param {String} from - 寄件者
 * @param {Array<String>} foundKeywords - 找到的關鍵字列表
 * @param {Object|null} aiAnalysisResult - AI 分析結果
 */
function logEmailAnalysisResult(message, subject, from, foundKeywords, aiAnalysisResult) {
  const messageId = message.getId();
  let logMessage = `[郵件分析] ID: ${messageId} | 寄件者: ${from} | 主旨: ${subject}`;
  
  // 記錄關鍵字信息
  logMessage += ` | 關鍵字: ${foundKeywords.length > 0 ? foundKeywords.join(',') : '無'}`;
  
  // 記錄情緒分析結果
  if (aiAnalysisResult) {
    const sentiment = aiAnalysisResult.primarySentiment || aiAnalysisResult.sentiment || "未知";
    logMessage += ` | 情緒: ${sentiment}`;
    
    // 如果有詳細情緒類型，則記錄
    if (aiAnalysisResult.detailedEmotion) {
      logMessage += ` | 詳細情緒: ${aiAnalysisResult.detailedEmotion}`;
    }
    
    // 記錄嚴重程度
    if (aiAnalysisResult.severity) {
      logMessage += ` | 嚴重程度: ${aiAnalysisResult.severity}`;
    }
    
    logMessage += ` | 需通知: ${aiAnalysisResult.shouldNotify}`;
    logMessage += ` | 問題檢測: ${aiAnalysisResult.problemDetected}`;
    logMessage += ` | 摘要: ${aiAnalysisResult.summary}`;
  } else {
    logMessage += " | 情緒分析: 無結果";
  }
  
  Logger.log(logMessage);
}

/**
 * 使用 Gemini API 生成每日統計摘要
 * 
 * @param {Object} stats - 統計數據物件
 * @return {String} - 生成的摘要文本
 */
function generateDailySummaryWithGemini(stats) {
  try {
    // 獲取 API 金鑰
    const apiKey = getGeminiApiKey();
    
    // 如果沒有設置 API 金鑰，則返回默認訊息
    if (!apiKey || apiKey === "YOUR_GEMINI_API_KEY") {
      Logger.log(`Gemini API 金鑰未設置，無法生成每日摘要`);
      return "AI 分析摘要功能暫時不可用（API 金鑰未設置）。";
    }
    
    // 準備提示詞
    const prompt = `
請為以下郵件監控數據生成一個簡短的每日摘要報告。注意：你的回答將在Slack消息中被明確標記為「AI生成內容」。

今日統計數據：
- 檢查郵件總數: ${stats.totalEmails}
- 觸發關鍵字郵件數: ${stats.keywordTriggeredEmails}

詳細情緒分布：
- 正面情緒(${stats.positive}封)：
  - 欣喜: ${stats.delighted}封
  - 感謝: ${stats.grateful}封
  - 印象深刻: ${stats.impressed}封
  - 滿意: ${stats.satisfied}封
  - 充滿希望: ${stats.hopeful}封
- 負面情緒(${stats.negative}封)：
  - 憤怒: ${stats.angry}封
  - 沮喪: ${stats.frustrated}封
  - 失望: ${stats.disappointed}封
  - 擔憂: ${stats.worried}封
  - 困惑: ${stats.confused}封
- 中性情緒(${stats.neutral}封)：
  - 事實陳述: ${stats.factual}封
  - 詢問: ${stats.inquiring}封
  - 提供信息: ${stats.informative}封

- 檢測到問題的郵件: ${stats.problemDetected}封

請提供簡短的分析和見解，重點關注任何異常或趨勢。整體保持在100字以內。回傳純文字，不要使用JSON格式。
`;
    
    // 應用 API 速率限制
    checkAndApplyRateLimit();
    
    // 呼叫 Gemini API
    const apiEndpoint = `https://generativelanguage.googleapis.com/v1/models/${GEMINI_MODEL}:generateContent?key=${apiKey}`;
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
      notifyLlmErrorToSlack(`狀態碼: ${responseCode}`, responseText);
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
    notifyLlmErrorToSlack(error.toString(), "");
    return "生成AI分析時發生錯誤。";
  }
}