import { mkdirSync, readFileSync, readdirSync } from 'node:fs';
import { execFileSync } from 'node:child_process';
const packageInfo = JSON.parse(readFileSync('package.json', 'utf8'));
const manifest = JSON.parse(readFileSync('plugin/manifest.json', 'utf8'));
if (manifest.version !== packageInfo.version) throw new Error('package.json and plugin/manifest.json versions must match.');
mkdirSync('dist', { recursive: true });
const files = readdirSync('plugin').filter(file => /\.(json|js|mjs|txt)$/.test(file)).sort();
execFileSync('python3', ['-c', 'import sys,zipfile; z=zipfile.ZipFile(sys.argv[1],"w",zipfile.ZIP_DEFLATED); [z.write("plugin/"+f,f) for f in sys.argv[2:]]', 'dist/hayase-recent-episodes.zip', ...files]);
console.log('Created dist/hayase-recent-episodes.zip');
