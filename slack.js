/**
 * slack.js - Slack 通知相關函數
 * 
 * 此檔案包含所有與 Slack 通知相關的函數，包括:
 * - 郵件通知格式化與發送
 * - 每日統計報告發送
 * 
 * 依賴模組:
 * - env.js (GEMINI_MODEL)
 * - utils.js (sendToSlack, formatDate, truncateBody)
 */

/**
 * 發送郵件通知到 Slack
 * 
 * @param {String} subject - 郵件主旨
 * @param {String} from - 寄件者
 * @param {Date} date - 郵件日期
 * @param {String} fullBody - 完整郵件內容
 * @param {String} actualBody - 實際郵件內容(排除引用)
 * @param {String} link - Gmail 郵件鏈接
 * @param {Array<String>} foundKeywords - 發現的關鍵字列表
 * @param {Object|null} aiAnalysisResult - AI 分析結果
 * @param {GmailMessage} message - Gmail 郵件對象
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
    
    // 取得情緒類型
    const mainEmotion = aiAnalysisResult.primarySentiment || aiAnalysisResult.sentiment || "未知";
    let emotionIcon = "❓";
    if (mainEmotion === "positive") emotionIcon = "😊";
    else if (mainEmotion === "negative") emotionIcon = "😠";
    else if (mainEmotion === "neutral") emotionIcon = "😐";
    
    // 詳細情緒類型表情
    const detailedEmotionIcons = {
      "delighted": "😄", "grateful": "🙏", "impressed": "🤩", "satisfied": "😌", "hopeful": "🤞",
      "angry": "😡", "frustrated": "😤", "disappointed": "😞", "worried": "😟", "confused": "😕",
      "factual": "📝", "inquiring": "🔍", "informative": "ℹ️"
    };
    
    // 顯示詳細情緒類型
    let detailedEmotionText = "";
    if (aiAnalysisResult.detailedEmotion) {
      const detailedIcon = detailedEmotionIcons[aiAnalysisResult.detailedEmotion] || "❓";
      detailedEmotionText = `\n> *詳細情緒：* ${detailedIcon} ${aiAnalysisResult.detailedEmotion}`;
    }
    
    // 使用不同的樣式凸顯 AI 評估結果
    slackMessage.blocks.push({
      "type": "section",
      "text": {
        "type": "mrkdwn",
        "text": `*🤖 AI評估結果：*\n> *情緒：* ${emotionIcon} ${mainEmotion}${detailedEmotionText}\n> *問題檢測：* ${aiAnalysisResult.problemDetected ? "⚠️ 是" : "✅ 否"}\n> *摘要：* ${aiAnalysisResult.summary}`
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
  
  // 標記郵件為已通知到Slack和已處理
  addLabel(message, NOTIFIED_LABEL);
  addLabel(message, CHECKED_LABEL);
  
  Logger.log(`發送通知：「${subject}」包含關鍵字「${foundKeywords.join(', ')}」- 寄件者: ${from}`);
}

/**
 * 發送每日統計數據到 Slack
 * 
 * @param {Object} stats - 統計數據物件
 * @param {String} aiSummary - AI 生成的分析摘要
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
          "text": `📊 郵件監控統計報告 (${Utilities.formatDate(new Date(), Session.getScriptTimeZone(), "yyyy/MM/dd")})`,
          "emoji": true
        }
      },
      {
        "type": "section",
        "text": {
          "type": "mrkdwn",
          "text": `📧 *基本統計數據：* ${stats.dateRange === "今日" ? "" : `\n(資料範圍：${stats.dateRange})`}`
        }
      },
      {
        "type": "section",
        "text": {
          "type": "mrkdwn",
          "text": `• 檢查郵件總數: ${stats.totalEmails}\n• 觸發關鍵字的郵件數: ${stats.keywordTriggeredEmails}`
        }
      },
      {
        "type": "section",
        "text": {
          "type": "mrkdwn",
          "text": `*情緒分析分布:*\n• 正面情緒: ${stats.positiveEmotions} (${calculatePercentage(stats.positiveEmotions, stats.totalEmails)}%)\n  - 😄 欣喜: ${stats.delighted || 0}\n  - 🙏 感謝: ${stats.grateful || 0}\n  - 🤩 印象深刻: ${stats.impressed || 0}\n  - 😌 滿意: ${stats.satisfied || 0}\n  - 🤞 充滿希望: ${stats.hopeful || 0}`
        }
      },
      {
        "type": "section",
        "text": {
          "type": "mrkdwn",
          "text": `• 負面情緒: ${stats.negativeEmotions} (${calculatePercentage(stats.negativeEmotions, stats.totalEmails)}%)\n  - 😡 憤怒: ${stats.angry || 0}\n  - 😤 沮喪: ${stats.frustrated || 0}\n  - 😞 失望: ${stats.disappointed || 0}\n  - 😟 擔憂: ${stats.worried || 0}\n  - 😕 困惑: ${stats.confused || 0}`
        }
      },
      {
        "type": "section",
        "text": {
          "type": "mrkdwn",
          "text": `• 中性情緒: ${stats.neutralEmotions} (${calculatePercentage(stats.neutralEmotions, stats.totalEmails)}%)\n  - 📝 事實陳述: ${stats.factual || 0}\n  - 🔍 詢問: ${stats.inquiring || 0}\n  - ℹ️ 提供信息: ${stats.informative || 0}\n\n• 檢測到問題的郵件數: ${stats.problemDetected} (${calculatePercentage(stats.problemDetected, stats.totalEmails)}%)`
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
            "text": "🤖 *AI 生成的分析報告*\n(由 " + GEMINI_MODEL + " 模型生成)"
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
