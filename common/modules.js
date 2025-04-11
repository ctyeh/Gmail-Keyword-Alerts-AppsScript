/**
 * modules.js - 模組命名空間管理
 * 
 * 此檔案為各個模組建立命名空間，確保模組間的函數引用正確。
 * 在 Google Apps Script 中，所有模組默認都是全局範圍，
 * 此檔案通過創建命名空間對象來確保模組化引用。
 */

// 直接在全局作用域定義命名空間對象，避免編譯器重命名
// 核心 API 模組命名空間
this.gmail = {}; // 核心 Gmail API 功能
this.gemini = {}; // 核心 Gemini AI API 功能
this.slack = {}; // 核心 Slack API 功能

// 業務邏輯模組命名空間
this.emailProcessor = {}; // 郵件處理邏輯
this.emotionStorage = {}; // 情緒分析儲存
this.ignoreRules = {}; // 忽略規則邏輯
this.notificationRules = {}; // 通知規則邏輯
this.searchTools = {}; // 郵件搜尋工具
this.triggerSetup = {}; // 觸發器設定

// 使用匿名立即調用函數來初始化命名空間
(function() {
  // 初始化命名空間，直接在腳本加載時執行
  function initializeNamespaces() {
    // 核心 API 模組函數映射
    mapFunctionsToNamespace('buildSearchQuery', this.gmail);
    mapFunctionsToNamespace('hasLabel', this.gmail);
    mapFunctionsToNamespace('addLabel', this.gmail);
    mapFunctionsToNamespace('isFromExcludedDomain', this.gmail);
    mapFunctionsToNamespace('checkKeywords', this.gmail);
    mapFunctionsToNamespace('extractActualContent', this.gmail);
    mapFunctionsToNamespace('countLabeledEmails', this.gmail);
    mapFunctionsToNamespace('isForwardedEmail', this.gmail);
    
    mapFunctionsToNamespace('analyzeEmailWithGemini', this.gemini);
    mapFunctionsToNamespace('logEmailAnalysisResult', this.gemini);
    mapFunctionsToNamespace('generateDailySummaryWithGemini', this.gemini);
    
    mapFunctionsToNamespace('sendNotification', this.slack);
    mapFunctionsToNamespace('sendDailyStatisticsToSlack', this.slack);
    
    // 業務邏輯模組函數映射
    mapFunctionsToNamespace('processThreads', this.emailProcessor);
    mapFunctionsToNamespace('processMessage', this.emailProcessor);
    
    mapFunctionsToNamespace('storeEmotionAnalysisResult', this.emotionStorage);
    mapFunctionsToNamespace('getEmotionStatsFromProperties', this.emotionStorage);
    mapFunctionsToNamespace('clearOldEmotionData', this.emotionStorage);
    mapFunctionsToNamespace('clearTodayEmotionData', this.emotionStorage);
    
    mapFunctionsToNamespace('shouldIgnore', this.ignoreRules);
    
    mapFunctionsToNamespace('shouldNotify', this.notificationRules);
    
    mapFunctionsToNamespace('buildGeneralQuery', this.searchTools);
    mapFunctionsToNamespace('buildTodayOnlyQuery', this.searchTools);
    mapFunctionsToNamespace('reanalyzeAllTodayEmails', this.searchTools);
    
    mapFunctionsToNamespace('setUpTrigger', this.triggerSetup);
    
    if (typeof Logger !== 'undefined') {
      Logger.log('模組命名空間初始化完成');
    }
  }
  
  // 輔助函數：將全局函數映射到指定的命名空間
  function mapFunctionsToNamespace(funcName, namespace) {
    if (typeof this[funcName] === 'function') {
      namespace[funcName] = this[funcName];
    }
  }
  
  // 直接初始化，不依賴 PropertiesService
  initializeNamespaces.call(this);
  
}).call(this);

/**
 * 重新初始化所有模組命名空間
 * 用於必要時手動強制刷新模組函數映射
 */
function reinitializeModules() {
  // 使用同樣的初始化邏輯，但以函數形式提供
  (function() {
    function initializeNamespaces() {
      mapFunctionsToNamespace('buildSearchQuery', this.gmail);
      mapFunctionsToNamespace('hasLabel', this.gmail);
      mapFunctionsToNamespace('addLabel', this.gmail);
      mapFunctionsToNamespace('isFromExcludedDomain', this.gmail);
      mapFunctionsToNamespace('checkKeywords', this.gmail);
      mapFunctionsToNamespace('extractActualContent', this.gmail);
      mapFunctionsToNamespace('countLabeledEmails', this.gmail);
      mapFunctionsToNamespace('isForwardedEmail', this.gmail);
      
      mapFunctionsToNamespace('analyzeEmailWithGemini', this.gemini);
      mapFunctionsToNamespace('logEmailAnalysisResult', this.gemini);
      mapFunctionsToNamespace('generateDailySummaryWithGemini', this.gemini);
      
      mapFunctionsToNamespace('sendNotification', this.slack);
      mapFunctionsToNamespace('sendDailyStatisticsToSlack', this.slack);
      
      mapFunctionsToNamespace('processThreads', this.emailProcessor);
      mapFunctionsToNamespace('processMessage', this.emailProcessor);
      
      mapFunctionsToNamespace('storeEmotionAnalysisResult', this.emotionStorage);
      mapFunctionsToNamespace('getEmotionStatsFromProperties', this.emotionStorage);
      mapFunctionsToNamespace('clearOldEmotionData', this.emotionStorage);
      mapFunctionsToNamespace('clearTodayEmotionData', this.emotionStorage);
      
      mapFunctionsToNamespace('shouldIgnore', this.ignoreRules);
      
      mapFunctionsToNamespace('shouldNotify', this.notificationRules);
      
      mapFunctionsToNamespace('buildGeneralQuery', this.searchTools);
      mapFunctionsToNamespace('buildTodayOnlyQuery', this.searchTools);
      mapFunctionsToNamespace('reanalyzeAllTodayEmails', this.searchTools);
      
      mapFunctionsToNamespace('setUpTrigger', this.triggerSetup);
    }
    
    function mapFunctionsToNamespace(funcName, namespace) {
      if (typeof this[funcName] === 'function') {
        namespace[funcName] = this[funcName];
      }
    }
    
    initializeNamespaces.call(this);
    if (typeof Logger !== 'undefined') {
      Logger.log('已重新初始化模組命名空間');
    }
  }).call(this);
}