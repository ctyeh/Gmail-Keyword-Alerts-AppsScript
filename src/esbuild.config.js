const fs = require('fs');
const path = require('path');
const glob = require('glob');

// 定義一個函數來讀取和處理文件內容
function readFileContent(filePath) {
  try {
    // 讀取檔案內容
    const content = fs.readFileSync(filePath, 'utf8');
    // 返回不帶有模組系統的純JavaScript代碼
    return content;
  } catch (error) {
    console.error(`Error reading file ${filePath}:`, error);
    return ''; // 返回空字符串以在發生錯誤時繼續
  }
}

console.log('開始打包 Google Apps Script 文件...');
const outputFile = path.join(__dirname, 'build', 'bundle', 'bundle.js');

// 確保輸出目錄存在
const outputDir = path.join(__dirname, 'build', 'bundle');
if (!fs.existsSync(outputDir)) {
  fs.mkdirSync(outputDir, { recursive: true });
}

// 預先聲明，以便後續正確引用
let finalCode = '// 在全局範圍定義 global 變數\nvar global = this;\n\n';

// 按照特定順序添加文件，確保依賴性正確
// 1. 環境變數和常數
finalCode += '// 環境變數和常數\n' + readFileContent(path.join(__dirname, 'source', 'env.js')) + '\n\n';

// 2. 模組命名空間管理
finalCode += '// 模組命名空間管理\n' + readFileContent(path.join(__dirname, 'source', 'modules.js')) + '\n\n';

// 3. 通用工具函數
finalCode += '// 通用工具函數\n' + readFileContent(path.join(__dirname, 'source', 'utils.js')) + '\n\n';

// 4. 核心API函數
const coreFiles = glob.sync(path.join(__dirname, 'source', 'core', '*.js'));
for (const file of coreFiles) {
  finalCode += `// ${path.basename(file)}\n` + readFileContent(file) + '\n\n';
}

// 5. 模組函數
const moduleFiles = glob.sync(path.join(__dirname, 'source', 'modules', '*.js'));
for (const file of moduleFiles) {
  finalCode += `// ${path.basename(file)}\n` + readFileContent(file) + '\n\n';
}

// 6. 統計相關函數
finalCode += '// 統計相關函數\n' + readFileContent(path.join(__dirname, 'source', 'statistics.js')) + '\n\n';

// 7. 主要入口函數
finalCode += '// 主要入口函數\n' + readFileContent(path.join(__dirname, 'source', 'main.js')) + '\n\n';

// 8. 添加全局函數導出
finalCode += `
// 顯式導出主要函數到全局作用域
// 主要入口函數
this.checkGmailAndNotifySlack = checkGmailAndNotifySlack;
this.setUpTrigger = setUpTrigger;
this.howToUse = howToUse;

// 統計報告函數
this.dailyStatisticsReport = dailyStatisticsReport;

// 重新分析郵件函數
this.reanalyzeAllTodayEmails = this.searchTools.reanalyzeAllTodayEmails;

// 模組重置函數
this.reinitializeModules = reinitializeModules;

// 記錄初始化完成
if (typeof Logger !== 'undefined') {
  Logger.log('Google Apps Script 初始化完成，所有函數已導出');
}
`;

// 寫入最終代碼到輸出文件
try {
  fs.writeFileSync(outputFile, finalCode);
  console.log(`成功生成打包文件: ${outputFile}`);
  console.log(`文件大小: ${(finalCode.length / 1024).toFixed(2)} KB`);
} catch (error) {
  console.error('生成打包文件時出錯:', error);
  process.exit(1);
}
