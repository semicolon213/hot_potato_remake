import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { bundleForAccount } from '../public/install/bundle-config.js';

const bundle = JSON.parse(await readFile('backend-bundle.json', 'utf8'));

for (const [label, isWorkspace, expectedServices] of [
  ['개인', false, ['drive']],
  ['Workspace', true, ['drive', 'admin']]
]) {
  const accountBundle = bundleForAccount(bundle, isWorkspace);
  const manifestFile = accountBundle.files.find(file => file.name === 'appsscript');
  const manifest = JSON.parse(manifestFile.source);
  const services = manifest.dependencies.enabledAdvancedServices.map(service => service.serviceId);
  assert.deepEqual(services, expectedServices);
  assert.ok(manifest.oauthScopes.includes('https://www.googleapis.com/auth/drive'));
  assert.ok(manifest.oauthScopes.includes('https://www.googleapis.com/auth/spreadsheets'));
  assert.ok(manifest.oauthScopes.includes('https://www.googleapis.com/auth/documents'));
  assert.ok(manifest.oauthScopes.includes('https://www.googleapis.com/auth/script.send_mail'));
  assert.ok(manifest.oauthScopes.includes('https://www.googleapis.com/auth/script.external_request'));
  assert.equal(manifest.oauthScopes.includes('https://mail.google.com/'), false);
  assert.equal(manifest.oauthScopes.includes('https://www.googleapis.com/auth/admin.directory.group.member'), isWorkspace);
  console.log(`${label} 서비스: ${services.join(', ')}`);
  console.log(`${label} 범위: ${manifest.oauthScopes.join(', ')}`);
}
