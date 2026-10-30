const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const test = require('node:test');
const vm = require('node:vm');

const properties = new Map();
const context = {
  PropertiesService: {
    getScriptProperties: () => ({ getProperty: key => properties.get(key) || '' })
  },
  getDeploymentInfo: () => ({ version: 'test' })
};
vm.createContext(context);
vm.runInContext(
  fs.readFileSync(path.join(__dirname, '..', 'appScript', 'Setup.gs'), 'utf8'),
  context
);

test('설치 상태는 서버 클라이언트 ID를 노출하지 않고 사이트 값과의 일치 여부만 반환한다', () => {
  properties.clear();
  let status = context.getSetupStatus({ clientId: 'site.apps.googleusercontent.com' });
  assert.equal(status.serverClientIdConfigured, false);
  assert.equal(status.clientIdMatches, false);

  properties.set('GOOGLE_CLIENT_ID', 'server.apps.googleusercontent.com');
  status = context.getSetupStatus({ clientId: 'site.apps.googleusercontent.com' });
  assert.equal(status.serverClientIdConfigured, true);
  assert.equal(status.clientIdMatches, false);
  assert.equal('serverClientId' in status, false);

  status = context.getSetupStatus({ clientId: 'server.apps.googleusercontent.com' });
  assert.equal(status.clientIdMatches, true);
});

test('신규 설치 기본값은 그룹 이메일을 노출하지 않고 기존 학과 주소를 거부한다', () => {
  properties.clear();
  const defaults = context.getSetupDefaults();
  assert.equal(defaults.installed, false);
  assert.equal('groupEmails' in defaults, false);
  assert.equal(context.isDefaultGroupEmail_('student_hp@googlegroups.com'), true);
  assert.equal(context.isDefaultGroupEmail_(' STUDENT_HP@googlegroups.com '), true);
  assert.equal(context.isDefaultGroupEmail_('student@another-university.example'), false);
});
