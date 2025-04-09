/**
 * modules.js - 模組命名空間管理
 * 
 * 此檔案為各個模組建立命名空間，確保模組間的函數引用正確。
 * 在 Google Apps Script 中，所有模組默認都是全局範圍，
 * 此檔案通過創建命名空間對象來確保模組化引用。
 */

// 核心 API 模組命名空間
var gmail = {}; // 核心 Gmail API 功能
var gemini = {}; // 核心 Gemini AI API 功能
var slack = {}; // 核心 Slack API 功能

// 業務邏輯模組命名空間
var emailProcessor = {}; // 郵件處理邏輯
var emotionStorage = {}; // 情緒分析儲存
var ignoreRules = {}; // 忽略規則邏輯
var notificationRules = {}; // 通知規則邏輯
var searchTools = {}; // 郵件搜尋工具
var triggerSetup = {}; // 觸發器設定

// 使用匿名立即調用函數來初始化命名空間
(function() {
  // 當所有腳本文件加載完成後，將全局函數分配給對應的命名空間
  function initializeNamespaces() {
    // 核心 API 模組函數映射
    mapFunctionsToNamespace('buildSearchQuery', gmail);
    mapFunctionsToNamespace('hasLabel', gmail);
    mapFunctionsToNamespace('addLabel', gmail);
    mapFunctionsToNamespace('isFromExcludedDomain', gmail);
    mapFunctionsToNamespace('checkKeywords', gmail);
    mapFunctionsToNamespace('extractActualContent', gmail);
    mapFunctionsToNamespace('countLabeledEmails', gmail);
    mapFunctionsToNamespace('isForwardedEmail', gmail);
    
    mapFunctionsToNamespace('analyzeEmailWithGemini', gemini);
    mapFunctionsToNamespace('logEmailAnalysisResult', gemini);
    mapFunctionsToNamespace('generateDailySummaryWithGemini', gemini);
    
    mapFunctionsToNamespace('sendNotification', slack);
    mapFunctionsToNamespace('sendDailyStatisticsToSlack', slack);
    
    // 業務邏輯模組函數映射
    mapFunctionsToNamespace('processThreads', emailProcessor);
    mapFunctionsToNamespace('processMessage', emailProcessor);
    
    mapFunctionsToNamespace('storeEmotionAnalysisResult', emotionStorage);
    mapFunctionsToNamespace('getEmotionStatsFromProperties', emotionStorage);
    mapFunctionsToNamespace('clearOldEmotionData', emotionStorage);
    mapFunctionsToNamespace('clearTodayEmotionData', emotionStorage);
    
    mapFunctionsToNamespace('shouldIgnore', ignoreRules);
    
    mapFunctionsToNamespace('shouldNotify', notificationRules);
    
    mapFunctionsToNamespace('buildGeneralQuery', searchTools);
    mapFunctionsToNamespace('buildTodayOnlyQuery', searchTools);
    mapFunctionsToNamespace('reanalyzeAllTodayEmails', searchTools);
    
    mapFunctionsToNamespace('setUpTrigger', triggerSetup);
    
    Logger.log('模組命名空間初始化完成');
  }
  
  // 輔助函數：將全局函數映射到指定的命名空間
  function mapFunctionsToNamespace(funcName, namespace) {
    if (typeof this[funcName] === 'function') {
      namespace[funcName] = this[funcName];
    }
  }
  
  // 在腳本加載完成後初始化命名空間
  PropertiesService.getScriptProperties().setProperty('NAMESPACE_INITIALIZED', 'false');
  
  // 由於 Google Apps Script 沒有生命週期事件，所以我們需要在主入口點函數中調用此初始化
  // 這會在 checkGmailAndNotifySlack 函數開始時自動調用
  if (PropertiesService.getScriptProperties().getProperty('NAMESPACE_INITIALIZED') !== 'true') {
    initializeNamespaces();
    PropertiesService.getScriptProperties().setProperty('NAMESPACE_INITIALIZED', 'true');
    Logger.log('首次運行，已初始化模組命名空間');
  }
})();

/**
 * 重新初始化所有模組命名空間
 * 用於必要時手動強制刷新模組函數映射
 */
function reinitializeModules() {
  PropertiesService.getScriptProperties().setProperty('NAMESPACE_INITIALIZED', 'false');
  Logger.log('已重置命名空間初始化狀態，下次運行時將重新初始化');
}