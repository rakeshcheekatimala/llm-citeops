import { defineConfig } from 'tsup';

export default defineConfig({
  entry: ['src/cli/index.ts'],
  format: ['cjs'],
  dts: true,
  clean: true,
  outDir: 'dist',
  noExternal: [
    'chalk',
    'cheerio',
    'commander',
    'compromise',
    'fast-xml-parser',
    'handlebars',
    'marked',
    'node-fetch',
    'ora',
    'robots-parser',
    'tldts',
  ],
});
