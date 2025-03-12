require('esbuild').build({
  entryPoints: ['node_modules/@tiptap/starter-kit/src/index.ts'],
  bundle: true,
  format: 'iife',
  globalName: 'TiptapStarterKit',
  outfile: '../tiptap/starter-kit.js',
  platform: 'browser',
  sourcemap: true,
  logLevel: 'info',
  define: { 'process.env.NODE_ENV': '"production"' },
  minify: true
}).catch((error) => {
  console.error('StarterKit build failed:', error);
  process.exit(1);
});