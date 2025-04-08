const esbuild = require('esbuild');

esbuild.build({
  entryPoints: ['lib/main.js'],
  bundle: true,
  outfile: 'dist/bundle.js',
  format: 'iife',
  banner: {
    js: 'var global = this;'
  },
  charset: 'utf8',
  target: ['es5'],
  logLevel: 'info',
  treeShaking: false,
}).catch(() => process.exit(1));
