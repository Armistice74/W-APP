require('esbuild').build({
  entryPoints: ['tiptap-entry.js'], // Single entry point combining core and starter-kit
  bundle: true,
  format: 'iife',
  globalName: 'TiptapBundle',
  outfile: '../tiptap/tiptap-bundle.js', // Single output file
  platform: 'browser',
  sourcemap: true,
  logLevel: 'info',
  define: { 'process.env.NODE_ENV': '"production"' },
  minify: true
}).catch((error) => {
  console.error('TipTap build failed:', error);
  process.exit(1);
});