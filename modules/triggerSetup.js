/**
 * triggerSetup.js
 * 
 * 專責 Google Apps Script 觸發器的設定與管理
 */

/**
 * 設定所有觸發器
 */
function setUpTrigger() {
  const triggers = ScriptApp.getProjectTriggers();
  for (const trigger of triggers) {
    if (
      trigger.getHandlerFunction() === "checkGmailAndNotifySlack" ||
      trigger.getHandlerFunction() === "dailyStatisticsReport" ||
      trigger.getHandlerFunction() === "clearOldEmotionData"
    ) {
      ScriptApp.deleteTrigger(trigger);
    }
  }

  ScriptApp.newTrigger("checkGmailAndNotifySlack")
    .timeBased()
    .everyMinutes(5)
    .create();

  ScriptApp.newTrigger("dailyStatisticsReport")
    .timeBased()
    .atHour(17)
    .nearMinute(30)
    .everyDays(1)
    .create();

  ScriptApp.newTrigger("clearOldEmotionData")
    .timeBased()
    .atHour(0)
    .nearMinute(30)
    .everyDays(1)
    .create();

  Logger.log("已設定所有觸發器");
}
