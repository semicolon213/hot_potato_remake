import assert from 'node:assert/strict';
import test from 'node:test';
import { updateOrCreateDeployment } from '../public/install/deployment.js';

test('저장된 배포는 같은 ID를 새 버전으로 갱신한다', async () => {
  const calls = [];
  const result = await updateOrCreateDeployment(async (path, options) => {
    calls.push({ path, options });
    return { deploymentId: 'deployment-1' };
  }, 'script-1', 'deployment-1', { versionNumber: 2, manifestFileName: 'appsscript' });

  assert.equal(result.deploymentId, 'deployment-1');
  assert.equal(calls.length, 1);
  assert.equal(calls[0].path, 'projects/script-1/deployments/deployment-1');
  assert.equal(calls[0].options.method, 'PUT');
  assert.equal(JSON.parse(calls[0].options.body).deploymentConfig.versionNumber, 2);
});

test('저장된 배포가 404이면 새 배포를 만든다', async () => {
  const calls = [];
  const result = await updateOrCreateDeployment(async (path, options) => {
    calls.push({ path, options });
    if (options.method === 'PUT') throw Object.assign(new Error('not found'), { status: 404 });
    return { deploymentId: 'deployment-2' };
  }, 'script-1', 'missing', { versionNumber: 3, manifestFileName: 'appsscript' });

  assert.equal(result.deploymentId, 'deployment-2');
  assert.deepEqual(calls.map(call => call.options.method), ['PUT', 'POST']);
});
