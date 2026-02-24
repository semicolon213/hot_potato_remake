/**
 * 번들 크기 검증 스크립트 (bundlesize 대체)
 * npm run build 후 실행. .bundlesizerc.json의 maxSize와 비교해 초과 시 exit 1.
 */
import fs from 'fs';
import path from 'path';
import zlib from 'zlib';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(__dirname, '..');
const configPath = path.join(root, '.bundlesizerc.json');
const distDir = path.join(root, 'dist');

function parseSize(str) {
  const m = str.trim().match(/^(\d+(?:\.\d+)?)\s*(B|kB|KB|MB)?$/i);
  if (!m) return 0;
  let bytes = Number(m[1]);
  const unit = (m[2] || 'B').toUpperCase();
  if (unit === 'KB') bytes *= 1024;
  else if (unit === 'MB') bytes *= 1024 * 1024;
  return bytes;
}

function getGzipSize(filePath) {
  const buf = fs.readFileSync(filePath);
  return zlib.gzipSync(buf, { level: 9 }).length;
}

function globMatch(rootDir, entryPath) {
  const fullPattern = path.join(rootDir, entryPath.replace(/^\.\//, ''));
  const dir = path.dirname(fullPattern);
  const basenamePattern = path.basename(fullPattern);
  const re = new RegExp(`^${basenamePattern.replace(/\*/g, '.*')}$`);
  if (!fs.existsSync(dir)) return [];
  return fs.readdirSync(dir)
    .filter((f) => re.test(f))
    .map((f) => path.join(dir, f));
}

if (!fs.existsSync(configPath)) {
  console.log('No .bundlesizerc.json found, skipping bundle size check.');
  process.exit(0);
}

if (!fs.existsSync(distDir)) {
  console.warn('dist/ not found. Run npm run build first.');
  process.exit(1);
}

const config = JSON.parse(fs.readFileSync(configPath, 'utf8'));
const files = config.files || [];
let failed = false;

for (const entry of files) {
  const matches = globMatch(root, entry.path);
  const maxBytes = parseSize(entry.maxSize || '0');
  const useGzip = entry.compression === 'gzip';

  for (const file of matches) {
    const size = useGzip ? getGzipSize(file) : fs.statSync(file).size;
    const label = path.relative(root, file);
    if (maxBytes > 0 && size > maxBytes) {
      console.error(`[bundle-size] ${label}: ${(size / 1024).toFixed(1)} kB > ${entry.maxSize} (limit)`);
      failed = true;
    } else {
      console.log(`[bundle-size] ${label}: ${(size / 1024).toFixed(1)} kB (limit: ${entry.maxSize})`);
    }
  }
}

process.exit(failed ? 1 : 0);
