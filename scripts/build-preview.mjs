import { build } from 'esbuild';
import { compile } from 'svelte/compiler';
import { readFileSync, writeFileSync, existsSync } from 'node:fs';
import { resolve, dirname } from 'node:path';
const base = resolve('src/native-preview');
const alias = {
  '$lib/modules/anilist': `${base}/adapters/anilist.js`, '$lib/modules/auth': `${base}/adapters/context.js`,
  '$lib/modules/settings': `${base}/adapters/settings.js`, '$lib/modules/navigate': `${base}/adapters/navigate.js`,
  '$lib/modules/settings/supports': `${base}/adapters/settings.js`, '$lib/modules/anizip': `${base}/adapters/anizip.js`,
  '$lib/utils': `${base}/adapters/utils.js`, '$lib/utils.js': `${base}/adapters/utils.js`,
  '$lib/components/ui/button': `${base}/vendor/button/index.ts`, '$lib/components/icons/animated': `${base}/adapters/icons.js`,
  '$lib/components/icons/Volume2.svelte': `${base}/vendor/icons/Volume2.svelte`
};
// utilities.css is the checked-in Tailwind 3 snapshot matching Hayase's utility
// semantics. Do not regenerate it with Tailwind 4: the upstream layout is v3.
const componentStyles = new Map();
const result = await build({
  entryPoints: [`${base}/entry.js`], outfile: 'plugin/native-preview.js', bundle: true, format: 'iife', globalName: 'HayaseNativePreview', minify: true,
  conditions: ['svelte', 'browser'], mainFields: ['svelte', 'browser', 'module', 'main'], loader: { '.css': 'text' }, metafile: true,
  plugins: [{ name: 'native-svelte', setup(builder) {
    builder.onResolve({ filter: /.*/ }, args => {
      if (alias[args.path]) return { path: alias[args.path] };
      if (args.importer.endsWith('/vendor/cards/preview.svelte')) {
        if (args.path === '../button/extra') return { path: `${base}/adapters/actions.js` };
        if (args.path === '../img') return { path: `${base}/adapters/images.js` };
        if (args.path === '../img/load.svelte') return { path: `${base}/vendor/img/load.svelte` };
        if (args.path === './videoframe.svelte') return { path: `${base}/adapters/Videoframe.svelte` };
      }
      if (args.path === '../player/mediahandler.svelte') return { path: `${base}/adapters/context.js` };
      if (args.path === 'lucide-svelte/dist/Icon.svelte') return { path: resolve('node_modules/lucide-svelte/dist/Icon.svelte') };
    });
    builder.onLoad({ filter: /\.svelte$/ }, args => {
      const { js, css } = compile(readFileSync(args.path, 'utf8'), { filename: args.path, generate: 'client', css: 'external', dev: false });
      if (css?.code) componentStyles.set(args.path, css.code);
      return { contents: js.code, resolveDir: dirname(args.path), loader: 'js' };
    });
  } }]
});
// Install component CSS explicitly in the preview shadow root. Runtime style
// injection can resolve the wrong root in Electron's extension isolated world.
const bundle = readFileSync('plugin/native-preview.js', 'utf8');
writeFileSync('plugin/native-preview.js', `globalThis.__hayasePreviewComponentCSS=${JSON.stringify([...componentStyles.values()].join('\n'))};\n${bundle}`);
const licenses = new Map();
for (const input of Object.keys(result.metafile.inputs).filter(path => path.startsWith('node_modules/'))) {
  let directory = dirname(resolve(input));
  while (directory !== dirname(directory) && !existsSync(`${directory}/package.json`)) directory = dirname(directory);
  if (!existsSync(`${directory}/package.json`) || licenses.has(directory)) continue;
  const info = JSON.parse(readFileSync(`${directory}/package.json`, 'utf8'));
  const file = ['LICENSE', 'LICENSE.md', 'LICENSE.txt', 'license', 'license.md'].find(name => existsSync(`${directory}/${name}`));
  licenses.set(directory, `${info.name} ${info.version} (${info.license || 'see upstream'})\n${file ? readFileSync(`${directory}/${file}`, 'utf8') : `License: ${info.license}; see ${info.homepage || info.repository?.url || info.name}`}\n`);
}
writeFileSync('plugin/OSS-LICENSES.txt', [...licenses.values()].sort().join('\n--------------------\n\n'));
