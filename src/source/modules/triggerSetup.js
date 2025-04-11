/**
 * triggerSetup.js
 * 
 * 專責自動觸發器的設定與管理
 * 
 * 依賴模組:
 * - env.js (常數設定)
 */

/**
 * 內部使用的觸發器設定函數，用於避免遞迴呼叫問題
 * 此函數將被映射到 triggerSetup.setUpTrigger
 */
function _INTERNAL_MODULE_SETUP_TRIGGER() {
  // 清除所有現有的觸發器
  const triggers = ScriptApp.getProjectTriggers();
  for (let i = 0; i < triggers.length; i++) {
    ScriptApp.deleteTrigger(triggers[i]);
  }
  Logger.log('已刪除所有現有觸發器');
  
  // 設定每5分鐘檢查一次郵件
  ScriptApp.newTrigger('checkGmailAndNotifySlack')
    .timeBased()
    .everyMinutes(5)
    .create();
  Logger.log('已設定每5分鐘檢查一次郵件的觸發器');
  
  // 設定每天下午5:30執行統計報告
  ScriptApp.newTrigger('dailyStatisticsReport')
    .timeBased()
    .atHour(17)
    .nearMinute(30)
    .everyDays(1)
    .create();
  Logger.log('已設定每天下午5:30執行統計報告的觸發器');
  
  // 設定每天凌晨0:15清除前一天的情緒數據
  ScriptApp.newTrigger('clearOldEmotionData')
    .timeBased()
    .atHour(0)
    .nearMinute(15)
    .everyDays(1)
    .create();
  Logger.log('已設定每天凌晨0:15清除前一天情緒數據的觸發器');
  
  Logger.log('所有觸發器設定完成');
}

/**
 * 保持原有的 setUpTrigger 函數，但裡面的內容被移到了 _INTERNAL_MODULE_SETUP_TRIGGER
 * 這麼做是為了保持與既有程式碼的兼容性
 */
function setUpTrigger() {
  _INTERNAL_MODULE_SETUP_TRIGGER();
}
