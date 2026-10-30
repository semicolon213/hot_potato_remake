import { readdir, readFile, writeFile } from 'node:fs/promises';
import { resolve } from 'node:path';

const sourceDir = resolve('appScript');
const entries = (await readdir(sourceDir)).filter(name => /\.(gs|html)$/.test(name)).sort();
const files = await Promise.all(entries.map(async name => ({
  name: name.replace(/\.(gs|html)$/, ''),
  type: name.endsWith('.html') ? 'HTML' : 'SERVER_JS',
  source: await readFile(resolve(sourceDir, name), 'utf8')
})));
// Admin SDK(admin)·Groups Settings 고급 서비스는 Workspace 전용이라 개인 Gmail 계정에서 "Service not found: admin v1"로 업로드가 실패한다.
// GroupManagement.gs는 이 서비스가 없으면 관리자 알림으로 넘어가므로 설치용 묶음에서는 뺀다.
const manifest = JSON.parse(await readFile(resolve(sourceDir, 'appsscript.json'), 'utf8'));
const advanced = manifest.dependencies?.enabledAdvancedServices;
if (Array.isArray(advanced)) {
  manifest.dependencies.enabledAdvancedServices = advanced.filter(service => !['admin', 'groupssettings'].includes(service.serviceId));
}
files.unshift({
  name: 'appsscript',
  type: 'JSON',
  source: JSON.stringify(manifest, null, 2)
});

await writeFile(resolve('backend-bundle.json'), JSON.stringify({ files }, null, 2) + '\n');
console.log(`backend-bundle.json: ${files.length}개 파일`);
