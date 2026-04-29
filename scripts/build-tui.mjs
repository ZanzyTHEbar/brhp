import solidPlugin from '@opentui/solid/bun-plugin';

const result = await Bun.build({
  entrypoints: ['./src/tui/index.tsx'],
  outdir: './dist/tui',
  target: 'bun',
  format: 'esm',
  splitting: false,
  packages: 'external',
  plugins: [solidPlugin],
});

if (!result.success) {
  for (const log of result.logs) {
    console.error(log);
  }

  process.exit(1);
}
