/**
 * triggerSetup.js
 * 
 * 專責自動觸發器的設定與管理
 * 
 * 依賴模組:
 * - env.js (常數設定)
 */

/**
 * 設定自動觸發器
 */
function setUpTrigger() {
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
