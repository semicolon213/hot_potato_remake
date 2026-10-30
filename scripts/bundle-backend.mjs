import { readdir, readFile, writeFile } from 'node:fs/promises';
import { resolve } from 'node:path';

const sourceDir = resolve('appScript');
const entries = (await readdir(sourceDir)).filter(name => /\.(gs|html)$/.test(name)).sort();
const files = await Promise.all(entries.map(async name => ({
  name: name.replace(/\.(gs|html)$/, ''),
  type: name.endsWith('.html') ? 'HTML' : 'SERVER_JS',
  source: await readFile(resolve(sourceDir, name), 'utf8')
})));
files.unshift({
  name: 'appsscript',
  type: 'JSON',
  source: await readFile(resolve(sourceDir, 'appsscript.json'), 'utf8')
});

await writeFile(resolve('backend-bundle.json'), JSON.stringify({ files }, null, 2) + '\n');
console.log(`backend-bundle.json: ${files.length}개 파일`);
