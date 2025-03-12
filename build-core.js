require('esbuild').build({
  entryPoints: ['node_modules/@tiptap/core/src/index.ts'],
  bundle: true,
  format: 'iife',
  globalName: 'Tiptap',
  outfile: '../tiptap/core.js',
  platform: 'browser',
  sourcemap: true,
  logLevel: 'info'
}).catch((error) => {
  console.error('Core build failed:', error);
  process.exit(1);
});