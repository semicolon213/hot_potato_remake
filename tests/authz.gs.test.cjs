const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const test = require('node:test');
const vm = require('node:vm');

const context = {};
vm.createContext(context);
vm.runInContext(
  fs.readFileSync(path.join(__dirname, '..', 'appScript', 'Authz.gs'), 'utf8'),
  context
);

test('액션 접근 등급을 분류하고 미분류 액션은 회원으로 처리한다', () => {
  assert.equal(context.getActionAccess_('getSetupStatus'), 'public');
  assert.equal(context.getActionAccess_('saveEmployment'), 'public');
  assert.equal(context.getActionAccess_('approveUserWithGroup'), 'admin');
  assert.equal(context.getActionAccess_('deleteSharedTemplate'), 'admin');
  assert.equal(context.getActionAccess_('newAction'), 'member');
});

test('Google 토큰 정보는 대상, 이메일 검증, 만료를 모두 확인한다', () => {
  const clientId = 'client.apps.googleusercontent.com';
  const valid = {
    aud: clientId,
    email: 'member@example.com',
    email_verified: true,
    expires_in: '300'
  };

  assert.equal(context.isTrustedTokenInfo_(valid, clientId, 1000), true);
  assert.equal(context.isTrustedTokenInfo_({ ...valid, aud: '', azp: clientId }, clientId, 1000), true);
  assert.equal(context.isTrustedTokenInfo_({ ...valid, aud: 'other' }, clientId, 1000), false);
  assert.equal(context.isTrustedTokenInfo_({ ...valid, email_verified: false }, clientId, 1000), false);
  assert.equal(context.isTrustedTokenInfo_({ ...valid, expires_in: '0' }, clientId, 1000), false);
  assert.equal(context.isTrustedTokenInfo_({ ...valid, exp: '999' }, clientId, 1000), false);
  assert.equal(context.isTrustedTokenInfo_({ ...valid, exp: 'invalid' }, clientId, 1000), false);
});
