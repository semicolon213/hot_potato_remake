import { copyFile, mkdir, readFile, writeFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { loadEnv } from 'vite';

const distDir = resolve('dist');
const installDir = resolve(distDir, 'install');
const sourceConfig = resolve('public', 'install', 'config.js');
const env = loadEnv(process.env.NODE_ENV || 'production', process.cwd(), 'VITE_');
const clientId = String(process.env.VITE_INSTALL_CLIENT_ID || env.VITE_INSTALL_CLIENT_ID || '').trim();

await mkdir(installDir, { recursive: true });
await copyFile(resolve('backend-bundle.json'), resolve(distDir, 'backend-bundle.json'));

let config = await readFile(sourceConfig, 'utf8');
if (clientId) {
  config = config.replace(/googleClientId:\s*(['"])(.*?)\1/, `googleClientId: ${JSON.stringify(clientId)}`);
}
await writeFile(resolve(installDir, 'config.js'), config);

const builtIndex = await readFile(resolve(installDir, 'index.html'), 'utf8');
if (!builtIndex.includes('HP ERP 설치 마법사')) throw new Error('설치 페이지가 빌드 결과에 없습니다.');
console.log(`install wizard: ${clientId ? 'VITE_INSTALL_CLIENT_ID 적용' : 'config.js 기본값 사용'}`);
