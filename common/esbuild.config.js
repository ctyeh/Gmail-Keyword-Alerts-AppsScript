const esbuild = require('esbuild');

esbuild.build({
  entryPoints: ['main.js'],  // 更改為直接使用根目錄 main.js 作為入口點
  bundle: true,
  outfile: 'dist/bundle.js',
  format: 'iife',
  banner: {
    js: 'var global = this;'
  },
  charset: 'utf8',
  // 移除 ES5 目標設定，使用預設的更現代的目標
  logLevel: 'info',
  treeShaking: false,
}).catch(() => process.exit(1));
