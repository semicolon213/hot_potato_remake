import { copyFile, mkdir, readFile, writeFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { loadEnv } from 'vite';

const distDir = resolve('dist');
const installDir = resolve(distDir, 'install');
const sourceConfig = resolve('public', 'install', 'config.js');
const env = loadEnv(process.env.NODE_ENV || 'production', process.cwd(), 'VITE_');
const clientId = String(process.env.VITE_INSTALL_CLIENT_ID || env.VITE_INSTALL_CLIENT_ID || '').trim();
const operatorClientId = String(process.env.VITE_GOOGLE_CLIENT_ID || env.VITE_GOOGLE_CLIENT_ID || '').trim();
const operatorContactEmail = String(process.env.VITE_OPERATOR_CONTACT_EMAIL || env.VITE_OPERATOR_CONTACT_EMAIL || '').trim();

await mkdir(installDir, { recursive: true });
await copyFile(resolve('backend-bundle.json'), resolve(distDir, 'backend-bundle.json'));

let config = await readFile(sourceConfig, 'utf8');
if (clientId) {
  config = config.replace(/googleClientId:\s*(['"])(.*?)\1/, `googleClientId: ${JSON.stringify(clientId)}`);
}
if (operatorClientId) {
  config = config.replace(/operatorClientId:\s*(['"])(.*?)\1/, `operatorClientId: ${JSON.stringify(operatorClientId)}`);
}
if (operatorContactEmail) {
  config = config.replace(/operatorContactEmail:\s*(['"])(.*?)\1/, `operatorContactEmail: ${JSON.stringify(operatorContactEmail)}`);
}
await writeFile(resolve(installDir, 'config.js'), config);

const builtIndex = await readFile(resolve(installDir, 'index.html'), 'utf8');
if (!builtIndex.includes('HP ERP 설치 마법사')) throw new Error('설치 페이지가 빌드 결과에 없습니다.');
console.log(`install wizard: 설치용 ID ${clientId ? '적용' : '미설정'}, 공유 로그인 ${operatorClientId && operatorContactEmail ? '사용 가능' : '비활성'}`);
