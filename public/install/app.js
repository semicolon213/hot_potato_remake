/* global google */
const STORAGE_KEY = 'hp-erp-install-wizard:v1';
const STEP_META = [
  ['준비', '준비물 확인'],
  ['계정 설정', 'Apps Script API 켜기'],
  ['백엔드', '로그인하고 백엔드 만들기'],
  ['사이트', '사이트 이름 정하기'],
  ['Google 로그인', '로그인 방식 선택'],
  ['그룹', 'Google 그룹 만들기'],
  ['사이트 배포', 'Netlify에 한 번에 배포'],
  ['설치 토큰', '설치 토큰 만들기'],
  ['백엔드 설치', '기관 정보 입력하기'],
  ['설치 점검', '자동 점검'],
  ['운영 시작', '첫 관리자 로그인'],
  ['운영 시작', '그룹 구성원 초대'],
  ['운영 시작', '사용자 미리 등록'],
  ['운영 시작', '테스트 운영 안내'],
  ['완료', '최종 체크리스트']
];
const INSTALL_SCOPES = [
  'https://www.googleapis.com/auth/script.projects',
  'https://www.googleapis.com/auth/script.deployments',
  'https://www.googleapis.com/auth/userinfo.email'
].join(' ');

const GROUP_KEYS = ['STUDENT', 'COUNCIL', 'ASSISTANT', 'PROFESSOR', 'ADJ_PROFESSOR'];
const emptyState = { currentStep: 0, completed: {}, backendUrl: '', scriptId: '', siteName: '', siteUrl: '', authMode: '', appClientId: '', directClientId: '', institutionName: '', requesterContact: '', testUsers: '', groups: {}, finalChecks: {}, apiError: '' };
let state = loadState();
let finalCheckPassed = false;

const nav = document.querySelector('#step-nav');
const sections = [...document.querySelectorAll('.wizard-step')];
const message = document.querySelector('#message');
const siteInput = document.querySelector('#site-url');
const siteNameInput = document.querySelector('#site-name');
const clientInput = document.querySelector('#app-client-id');
const loginButton = document.querySelector('#login');
const sharedModeInput = document.querySelector('#auth-mode-shared');
const directModeInput = document.querySelector('#auth-mode-direct');
const institutionInput = document.querySelector('#institution-name');
const requesterContactInput = document.querySelector('#requester-contact');
const testUsersInput = document.querySelector('#test-user-emails');

function loadState() {
  try {
    const saved = JSON.parse(localStorage.getItem(STORAGE_KEY) || '{}');
    const loaded = { ...emptyState, ...saved, completed: saved.completed || {}, groups: saved.groups || {}, finalChecks: saved.finalChecks || {} };
    if (!loaded.directClientId && !loaded.authMode) loaded.directClientId = loaded.appClientId || '';
    return loaded;
  } catch {
    return { ...emptyState };
  }
}

function saveState() {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
}

function stepFromHash() {
  const match = location.hash.match(/^#step-(\d{1,2})$/);
  const step = match ? Number(match[1]) : -1;
  return step >= 0 && step < STEP_META.length ? step : null;
}

function buildNav() {
  STEP_META.forEach(([eyebrow, title], index) => {
    const button = document.createElement('button');
    button.type = 'button';
    button.className = 'step-jump';
    button.dataset.step = String(index);
    button.innerHTML = `<span class="step-number">${index}</span><span class="step-label">${eyebrow} · ${title}</span>`;
    button.addEventListener('click', () => goToStep(index));
    nav.appendChild(button);
  });
}

function goToStep(step) {
  const next = Math.max(0, Math.min(STEP_META.length - 1, Number(step) || 0));
  state.currentStep = next;
  saveState();
  if (location.hash !== `#step-${next}`) history.pushState(null, '', `#step-${next}`);
  render();
}

function render() {
  const step = state.currentStep;
  document.querySelector('#eyebrow').textContent = `${step}단계 · ${STEP_META[step][0]}`;
  document.querySelector('#step-title').textContent = STEP_META[step][1];
  document.querySelector('#progress').textContent = `${step + 1} / ${STEP_META.length}`;
  sections.forEach(section => section.classList.toggle('active', Number(section.dataset.step) === step));
  [...nav.children].forEach((button, index) => {
    button.classList.toggle('active', index === step);
    button.classList.toggle('done', Boolean(state.completed[index]));
    button.querySelector('.step-number').textContent = state.completed[index] ? '✓' : String(index);
  });
  document.querySelector('#previous').disabled = step === 0;
  document.querySelector('#next').disabled = step === STEP_META.length - 1;
  document.querySelector('#complete').textContent = state.completed[step] ? '완료됨 ✓' : '다 했어요';
  document.querySelector('#api-error').hidden = !state.apiError;
  document.querySelector('#api-error').textContent = state.apiError;
  updateDerivedValues();
}

function showMessage(text, type = '') {
  message.textContent = text;
  message.className = `message ${type}`.trim();
  message.hidden = !text;
}

function normalizeSiteUrl(value) {
  try {
    const url = new URL(String(value || '').trim());
    if (url.protocol !== 'https:' || url.username || url.password || (url.pathname !== '/' && url.pathname !== '')) return '';
    return url.origin;
  } catch {
    return '';
  }
}

function validClientId(value) {
  return /^[A-Za-z0-9._-]+\.apps\.googleusercontent\.com$/.test(String(value || '').trim());
}

function validBackendUrl(value) {
  return /^https:\/\/script\.google\.com\/macros\/s\/[^/]+\/exec$/.test(String(value || '').trim());
}

function validSiteName(value) {
  return /^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(String(value || '').trim());
}

function validEmail(value) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(String(value || '').trim());
}

function operatorConfig() {
  return {
    clientId: String(window.INSTALL_CONFIG?.operatorClientId || '').trim(),
    contactEmail: String(window.INSTALL_CONFIG?.operatorContactEmail || '').trim()
  };
}

function testUserEmails() {
  return state.testUsers.split(/\r?\n/).map(email => email.trim()).filter(Boolean);
}

function sharedModeAvailable() {
  const config = operatorConfig();
  return validClientId(config.clientId) && validEmail(config.contactEmail);
}

function sharedRequestText() {
  const plannedUrl = state.siteUrl || (validSiteName(state.siteName) ? `https://${state.siteName}.netlify.app` : '(사이트 주소 미입력)');
  const users = testUserEmails();
  return `HP ERP 공유 Google 로그인 등록을 요청합니다.\n\n기관·학과: ${state.institutionName || '(미입력)'}\n담당자 연락처: ${state.requesterContact || '(미입력)'}\n기관 사이트 주소: ${plannedUrl}\n테스트 사용자:\n${users.length ? users.map(email => `- ${email}`).join('\n') : '- (미입력)'}\n\n운영자 OAuth 클라이언트의 승인된 JavaScript 원본과 리디렉션 URI에 기관 사이트 주소를 추가하고, Audience 테스트 사용자에 위 이메일을 등록해 주세요.`;
}

function groupJson() {
  return GROUP_KEYS.every(key => validEmail(state.groups[key]))
    ? JSON.stringify(Object.fromEntries(GROUP_KEYS.map(key => [key, state.groups[key]])))
    : '';
}

function validateStep(step) {
  if (step === 2 && (!validBackendUrl(state.backendUrl) || !state.scriptId)) {
    showMessage('먼저 Google 로그인 버튼을 눌러 백엔드를 끝까지 만드세요.', 'error');
    return false;
  }
  if (step === 3 && !validSiteName(siteNameInput.value)) {
    document.querySelector('#site-name-error').textContent = '영문 소문자, 숫자, 하이픈만 입력하세요.';
    return false;
  }
  if (step === 4) {
    if (!state.authMode) {
      showMessage('Google 로그인 방식 하나를 선택하세요.', 'error');
      return false;
    }
    if (state.authMode === 'shared') {
      const users = testUserEmails();
      if (!sharedModeAvailable() || !validSiteName(state.siteName) || !state.institutionName.trim() || !state.requesterContact.trim() || !users.length || users.some(email => !validEmail(email))) {
        showMessage('운영자 등록 요청에 필요한 기관명, 담당자 연락처와 테스트 사용자 이메일을 확인하세요.', 'error');
        return false;
      }
    } else if (!validClientId(clientInput.value || state.directClientId)) {
      document.querySelector('#client-id-error').textContent = '.apps.googleusercontent.com으로 끝나는 클라이언트 ID를 입력하세요.';
      return false;
    }
  }
  if (step === 5 && !groupJson()) {
    showMessage('Google 그룹 이메일 5개를 모두 확인하세요.', 'error');
    return false;
  }
  if (step === 6 && (!normalizeSiteUrl(siteInput.value) || !state.backendUrl || !state.appClientId || !groupJson())) {
    showMessage('백엔드 주소, 클라이언트 ID, 그룹 이메일과 실제 사이트 주소가 모두 필요합니다.', 'error');
    return false;
  }
  if (step === 7 && !state.scriptId) {
    showMessage('2단계에서 백엔드를 먼저 만드세요.', 'error');
    return false;
  }
  if (step === 8 && (!state.backendUrl || !state.appClientId || !groupJson())) {
    showMessage('백엔드 주소, 웹 클라이언트 ID와 그룹 이메일이 필요합니다.', 'error');
    return false;
  }
  if (step === 9 && !finalCheckPassed && !state.completed[9]) {
    showMessage('먼저 자동 점검을 실행해 모든 항목을 확인하세요.', 'error');
    return false;
  }
  if (step === 14 && Object.values(state.finalChecks).filter(Boolean).length !== 6) {
    showMessage('마지막 체크 6개를 모두 확인하세요.', 'error');
    return false;
  }
  showMessage('');
  return true;
}

function markComplete(step, moveNext = false) {
  if (!validateStep(step)) return;
  state.completed[step] = true;
  saveState();
  render();
  if (moveNext && step < STEP_META.length - 1) goToStep(step + 1);
}

function updateDerivedValues() {
  const plannedUrl = validSiteName(state.siteName) ? `https://${state.siteName}.netlify.app` : '';
  const activeSiteUrl = state.siteUrl || plannedUrl;
  const groups = groupJson();
  const sharedAvailable = sharedModeAvailable();
  sharedModeInput.disabled = !sharedAvailable;
  sharedModeInput.checked = state.authMode === 'shared';
  directModeInput.checked = state.authMode === 'direct';
  document.querySelector('#shared-mode-disabled').hidden = sharedAvailable;
  document.querySelector('#shared-mode-disabled').textContent = sharedAvailable ? '' : '운영자 연락처 또는 공유 클라이언트가 설정되지 않아 쉬운 방식을 선택할 수 없습니다. 직접 만들기를 선택하세요.';
  document.querySelector('#shared-auth-panel').hidden = state.authMode !== 'shared';
  document.querySelector('#direct-auth-panel').hidden = state.authMode !== 'direct';
  document.querySelector('#shared-site-url').textContent = activeSiteUrl || '3단계에서 사이트 이름을 입력하세요.';
  const requestText = sharedRequestText();
  document.querySelector('#operator-request').value = requestText;
  const config = operatorConfig();
  document.querySelector('#operator-mail-link').href = validEmail(config.contactEmail)
    ? `mailto:${config.contactEmail}?subject=${encodeURIComponent(`[HP ERP] ${state.institutionName || '기관'} 공유 로그인 등록 요청`)}&body=${encodeURIComponent(requestText)}`
    : '#';
  document.querySelector('#site-url-warning').textContent = state.siteUrl && plannedUrl && state.siteUrl !== plannedUrl
    ? state.authMode === 'shared'
      ? '예정 주소와 다릅니다. 4단계 요청문을 실제 주소로 고쳐 운영자에게 다시 보내세요.'
      : '예정 주소와 다릅니다. 4단계의 JavaScript 원본과 리디렉션 URI를 이 실제 주소로 고치세요.'
    : '';
  document.querySelector('#backend-result').hidden = !state.backendUrl;
  document.querySelector('#backend-url').textContent = state.backendUrl;
  document.querySelector('#script-id').textContent = state.scriptId;
  document.querySelector('#planned-site-url').textContent = plannedUrl || '사이트 이름을 입력하세요.';
  document.querySelector('#netlify-backend-url').textContent = state.backendUrl || '2단계에서 먼저 백엔드를 만드세요.';
  document.querySelector('#oauth-origin').textContent = activeSiteUrl || '3단계에서 사이트 이름을 입력하세요.';
  document.querySelector('#netlify-client-id').textContent = state.appClientId || '4-7에서 클라이언트 ID를 입력하세요.';
  document.querySelector('#netlify-group-json').textContent = groups || '5단계에서 그룹 이메일을 입력하세요.';
  document.querySelector('#group-json').textContent = groups || '그룹 이메일 5개를 모두 입력하세요.';
  document.querySelector('#editor-link').href = state.scriptId ? `https://script.google.com/d/${encodeURIComponent(state.scriptId)}/edit` : '#';
  document.querySelector('#trigger-editor-link').href = state.scriptId ? `https://script.google.com/d/${encodeURIComponent(state.scriptId)}/edit` : '#';
  document.querySelector('#backend-setup-link').href = state.backendUrl
    ? `${state.backendUrl}?page=setup${state.appClientId ? `&clientId=${encodeURIComponent(state.appClientId)}` : ''}`
    : '#';
  document.querySelector('#setup-link').href = state.siteUrl ? `${state.siteUrl}/setup` : '#';
  document.querySelector('#site-login-link').href = state.siteUrl || '#';
  document.querySelector('#member-guide').value = `HP ERP 주소: ${activeSiteUrl || '(운영자가 알려 드릴 예정입니다)'}\n\n1. 운영자가 등록한 Google 계정으로 로그인해 주세요.\n2. 미인증 경고에서 선택할 수 있다면 ‘고급 → HP ERP로 이동’을 누르세요.\n3. ‘액세스 차단됨’이 나오면 운영자에게 테스트 사용자 등록을 요청하세요.\n4. 처음 로그인하면 가입 정보를 입력하고 승인될 때까지 기다려 주세요.\n\n※ 테스트 운영 중에는 Google 동의가 7일마다 만료되어 다시 로그인해야 할 수 있습니다.`;
}

async function copyText(button) {
  const target = document.querySelector(button.dataset.copy);
  const text = (target?.value || target?.textContent || '').trim();
  if (!text || text.includes('단계에서') || text.includes('입력하세요')) return showMessage('먼저 앞 단계의 값을 입력하세요.', 'error');
  try {
    await navigator.clipboard.writeText(text);
    const original = button.textContent;
    button.textContent = '복사됨';
    button.classList.add('copied');
    setTimeout(() => { button.textContent = original; button.classList.remove('copied'); }, 1500);
  } catch {
    showMessage('복사하지 못했습니다. 값을 직접 선택해 복사하세요.', 'error');
  }
}

function setBackendProgress(index, text, failed = false) {
  const items = [...document.querySelectorAll('#backend-progress li')];
  if (!items[index]) return;
  items[index].textContent = `${failed ? '✕' : '✓'} ${text}`;
  items[index].style.color = failed ? '#b42318' : '#17682a';
}

async function appsScriptApi(path, token, options = {}) {
  const response = await fetch(`https://script.googleapis.com/v1/${path}`, {
    ...options,
    headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json', ...options.headers }
  });
  const body = await response.json();
  if (!response.ok) {
    const error = new Error(body.error?.message || `Google API 오류 (${response.status})`);
    error.status = response.status;
    throw error;
  }
  return body;
}

// Workspace 전용 고급 서비스. 개인 Gmail 계정에서는 "Service not found: admin v1"로 업로드가 실패한다.
const WORKSPACE_ONLY_SERVICES = ['admin', 'groupssettings'];

// 개인 계정이면 Workspace 전용 서비스를 빼고 올린다. GroupManagement.gs는 서비스가 없으면 관리자 알림으로 넘어간다.
function bundleForAccount(bundle, isWorkspace) {
  if (isWorkspace) return bundle;
  return { files: bundle.files.map(file => {
    if (file.name !== 'appsscript') return file;
    const manifest = JSON.parse(file.source);
    const services = manifest.dependencies?.enabledAdvancedServices;
    if (Array.isArray(services)) manifest.dependencies.enabledAdvancedServices = services.filter(service => !WORKSPACE_ONLY_SERVICES.includes(service.serviceId));
    return { ...file, source: JSON.stringify(manifest, null, 2) };
  }) };
}

async function deployBackend(token, email, isWorkspace) {
  const bundleResponse = await fetch('/backend-bundle.json', { cache: 'no-store' });
  if (!bundleResponse.ok) throw new Error('백엔드 코드 묶음을 읽지 못했습니다. 운영자에게 알려 주세요.');
  const bundle = bundleForAccount(await bundleResponse.json(), isWorkspace);
  const storageKey = `hp-erp-script-id:${email.toLowerCase()}`;
  let scriptId = state.scriptId || localStorage.getItem(storageKey) || '';
  let cached = Boolean(scriptId);

  const createProject = async () => {
    const project = await appsScriptApi('projects', token, { method: 'POST', body: JSON.stringify({ title: 'HP ERP Backend' }) });
    scriptId = project.scriptId;
    state.scriptId = scriptId;
    localStorage.setItem(storageKey, scriptId);
    saveState();
    cached = false;
  };

  if (!scriptId) await createProject();
  setBackendProgress(1, `프로젝트 준비 완료 (${scriptId})`);
  try {
    await appsScriptApi(`projects/${scriptId}/content`, token, { method: 'PUT', body: JSON.stringify(bundle) });
  } catch (error) {
    if (!cached || ![403, 404].includes(error.status)) throw error;
    localStorage.removeItem(storageKey);
    await createProject();
    await appsScriptApi(`projects/${scriptId}/content`, token, { method: 'PUT', body: JSON.stringify(bundle) });
  }
  setBackendProgress(2, '백엔드 코드 업로드 완료');
  const version = await appsScriptApi(`projects/${scriptId}/versions`, token, { method: 'POST', body: JSON.stringify({ description: 'HP ERP 초기 설치' }) });
  const deployment = await appsScriptApi(`projects/${scriptId}/deployments`, token, { method: 'POST', body: JSON.stringify({ versionNumber: version.versionNumber, manifestFileName: 'appsscript', description: 'HP ERP 운영' }) });

  state.scriptId = scriptId;
  state.backendUrl = `https://script.google.com/macros/s/${deployment.deploymentId}/exec`;
  state.completed[2] = true;
  saveState();
  setBackendProgress(3, '웹앱 배포 완료');
  showMessage('백엔드가 준비되었습니다. 주소를 복사해 다음 단계로 가세요.', 'success');
  render();
}

function handleDeployError(error) {
  loginButton.disabled = false;
  if (error.status === 403) {
    state.apiError = 'Google이 403으로 거절했습니다. Apps Script API 스위치를 켠 뒤 1분 후 다시 시도하세요.';
    saveState();
    goToStep(1);
    return;
  }
  setBackendProgress(3, error.message || '백엔드 만들기 실패', true);
  showMessage(`${error.message || '백엔드를 만들지 못했습니다.'}${state.scriptId ? ` 스크립트 ID: ${state.scriptId}` : ''}`, 'error');
}

function startGoogleInstall() {
  const clientId = String(window.INSTALL_CONFIG?.googleClientId || '').trim();
  if (!validClientId(clientId)) return showMessage('설치용 클라이언트 ID가 아직 설정되지 않았습니다. 운영자에게 알려 주세요.', 'error');
  if (typeof google === 'undefined' || !google.accounts?.oauth2) return showMessage('Google 로그인 화면을 불러오는 중입니다. 잠시 뒤 다시 눌러 주세요.', 'error');
  loginButton.disabled = true;
  google.accounts.oauth2.initTokenClient({
    client_id: clientId,
    scope: INSTALL_SCOPES,
    callback: async response => {
      if (response.error) return handleDeployError(new Error(response.error_description || response.error));
      setBackendProgress(0, 'Google 로그인 완료');
      try {
        const profileResponse = await fetch('https://www.googleapis.com/oauth2/v3/userinfo', { headers: { Authorization: `Bearer ${response.access_token}` } });
        if (!profileResponse.ok) throw new Error('Google 계정 이메일을 확인하지 못했습니다.');
        const profile = await profileResponse.json();
        state.apiError = '';
        await deployBackend(response.access_token, profile.email, Boolean(profile.hd));
      } catch (error) {
        handleDeployError(error);
      } finally {
        loginButton.disabled = false;
      }
    },
    error_callback: error => handleDeployError(new Error(error.message || error.type || 'Google 로그인 실패'))
  }).requestAccessToken();
}

function makeStatusRow(label, ok, detail, step) {
  const row = document.createElement('div');
  row.className = `status-item ${ok ? 'ok' : 'fail'}`;
  const dot = document.createElement('span');
  dot.className = 'status-dot';
  dot.textContent = ok ? '✓' : '✕';
  const text = document.createElement('span');
  text.textContent = `${label}: ${detail}`;
  row.append(dot, text);
  if (!ok) {
    const link = document.createElement('a');
    link.href = `#step-${step}`;
    link.textContent = '해당 단계로 이동';
    link.addEventListener('click', event => { event.preventDefault(); goToStep(step); });
    row.appendChild(link);
  }
  return row;
}

async function runFinalCheck() {
  const list = document.querySelector('#status-list');
  list.replaceChildren();
  const siteUrl = normalizeSiteUrl(state.siteUrl);
  const clientOk = validClientId(state.appClientId);
  list.append(makeStatusRow('사이트 주소', Boolean(siteUrl), siteUrl || '6단계 주소가 올바르지 않습니다.', 6));
  list.append(makeStatusRow('클라이언트 ID', clientOk, clientOk ? '형식이 올바릅니다.' : '4-7 값을 확인하세요.', 4));
  if (!siteUrl || !clientOk) return false;

  showMessage('사이트 프록시와 백엔드를 확인하고 있습니다.');
  try {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 15000);
    const response = await fetch(`${siteUrl}/.netlify/functions/proxy`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ action: 'getSetupStatus', clientId: state.appClientId }),
      signal: controller.signal
    });
    clearTimeout(timeout);
    if (!response.ok) throw new Error(`HTTP ${response.status}`);
    const backend = await response.json();
    const checks = [
      ['백엔드 연결', backend.success === true, backend.success ? `연결됨 (v${backend.version})` : backend.message || '응답 실패', 6],
      ['백엔드 설치', backend.installed === true, backend.installed ? '완료' : '8단계 설치가 필요합니다.', 8],
      ['회원 시트', backend.spreadsheetReady === true, backend.spreadsheetReady ? '준비됨' : '8단계 설치를 확인하세요.', 8],
      ['서버 클라이언트 ID', backend.serverClientIdConfigured === true, backend.serverClientIdConfigured ? '설정됨' : '8단계에서 다시 설치하세요.', 8],
      ['서버·사이트 ID 일치', backend.clientIdMatches === true, backend.clientIdMatches ? '일치' : '6단계 배포값을 확인하세요.', 6]
    ];
    checks.forEach(check => list.append(makeStatusRow(...check)));
    finalCheckPassed = checks.every(check => check[1]);
    if (finalCheckPassed) {
      state.completed[9] = true;
      saveState();
      showMessage('모든 자동 점검을 통과했습니다. /setup 상세 점검도 확인하세요.', 'success');
      render();
    } else {
      showMessage('고칠 항목이 있습니다. 빨간 항목의 이동 버튼을 누르세요.', 'error');
    }
    return finalCheckPassed;
  } catch (error) {
    const detail = error.name === 'AbortError' ? '15초 안에 응답이 오지 않았습니다.' : error.message;
    list.append(makeStatusRow('백엔드 연결', false, detail, 6));
    showMessage('사이트 프록시에 연결하지 못했습니다.', 'error');
    return false;
  }
}

buildNav();
const initialStep = stepFromHash();
if (initialStep !== null) state.currentStep = initialStep;
if (state.authMode === 'shared' && !sharedModeAvailable()) state.authMode = '';
if (state.authMode === 'shared') state.appClientId = operatorConfig().clientId;
if (state.authMode === 'direct') state.appClientId = state.directClientId;
siteNameInput.value = state.siteName;
siteInput.value = state.siteUrl;
clientInput.value = state.directClientId;
institutionInput.value = state.institutionName;
requesterContactInput.value = state.requesterContact;
testUsersInput.value = state.testUsers;
GROUP_KEYS.forEach(key => {
  const input = document.querySelector(`#group-${key.toLowerCase().replace('_', '-')}`);
  input.value = state.groups[key] || '';
  input.addEventListener('input', () => {
    const value = input.value.trim();
    document.querySelector(`[data-group-error="${key}"]`).textContent = value && !validEmail(value) ? '이메일 주소를 확인하세요.' : '';
    state.groups[key] = value;
    state.completed[5] = Boolean(groupJson());
    saveState();
    updateDerivedValues();
  });
});
document.querySelectorAll('[data-final-check]').forEach(input => {
  input.checked = Boolean(state.finalChecks[input.dataset.finalCheck]);
  input.addEventListener('change', () => {
    state.finalChecks[input.dataset.finalCheck] = input.checked;
    saveState();
  });
});
document.querySelector('#deploy-netlify').href = `https://app.netlify.com/start/deploy?repository=${encodeURIComponent(window.INSTALL_CONFIG?.repositoryUrl || '')}`;
document.querySelector('#operator-warning').hidden = validClientId(window.INSTALL_CONFIG?.googleClientId || '');

document.querySelectorAll('[name="auth-mode"]').forEach(input => input.addEventListener('change', () => {
  state.authMode = input.value;
  state.appClientId = input.value === 'shared' ? operatorConfig().clientId : state.directClientId;
  state.completed[4] = input.value === 'direct' && validClientId(state.directClientId);
  saveState();
  render();
}));

institutionInput.addEventListener('input', () => {
  state.institutionName = institutionInput.value;
  if (state.authMode === 'shared') state.completed[4] = false;
  document.querySelector('#institution-name-error').textContent = state.institutionName.trim() ? '' : '기관·학과 이름을 입력하세요.';
  saveState();
  updateDerivedValues();
});

requesterContactInput.addEventListener('input', () => {
  state.requesterContact = requesterContactInput.value;
  if (state.authMode === 'shared') state.completed[4] = false;
  document.querySelector('#requester-contact-error').textContent = state.requesterContact.trim() ? '' : '담당자 연락처를 입력하세요.';
  saveState();
  updateDerivedValues();
});

testUsersInput.addEventListener('input', () => {
  state.testUsers = testUsersInput.value;
  if (state.authMode === 'shared') state.completed[4] = false;
  const users = testUserEmails();
  document.querySelector('#test-user-emails-error').textContent = users.length && users.every(validEmail) ? '' : '한 줄에 올바른 이메일 주소 하나씩 입력하세요.';
  saveState();
  updateDerivedValues();
});

siteNameInput.addEventListener('input', () => {
  const value = siteNameInput.value.trim();
  document.querySelector('#site-name-error').textContent = value && !validSiteName(value) ? '영문 소문자, 숫자, 하이픈만 입력하세요.' : '';
  state.siteName = value;
  state.completed[3] = validSiteName(value);
  if (state.authMode === 'shared') state.completed[4] = false;
  saveState();
  updateDerivedValues();
});
siteInput.addEventListener('input', () => {
  const normalized = normalizeSiteUrl(siteInput.value);
  document.querySelector('#site-url-error').textContent = siteInput.value && !normalized ? 'https://로 시작하는 사이트 주소만 입력하세요. 경로와 끝 슬래시는 빼 주세요.' : '';
  state.siteUrl = normalized;
  const plannedUrl = validSiteName(state.siteName) ? `https://${state.siteName}.netlify.app` : '';
  state.completed[6] = Boolean(normalized && state.backendUrl && state.appClientId && groupJson());
  saveState();
  updateDerivedValues();
});
clientInput.addEventListener('input', () => {
  const value = clientInput.value.trim();
  document.querySelector('#client-id-error').textContent = value && !validClientId(value) ? '.apps.googleusercontent.com으로 끝나는 클라이언트 ID를 입력하세요.' : '';
  state.directClientId = validClientId(value) ? value : '';
  if (state.authMode === 'direct') state.appClientId = state.directClientId;
  state.completed[4] = state.authMode === 'direct' && validClientId(value);
  saveState();
  render();
});

document.querySelectorAll('[data-copy]').forEach(button => button.addEventListener('click', () => copyText(button)));
document.querySelector('#previous').addEventListener('click', () => goToStep(state.currentStep - 1));
document.querySelector('#next').addEventListener('click', () => goToStep(state.currentStep + 1));
document.querySelector('#complete').addEventListener('click', () => markComplete(state.currentStep, true));
document.querySelector('#run-check').addEventListener('click', runFinalCheck);
loginButton.addEventListener('click', startGoogleInstall);
window.addEventListener('hashchange', () => { const step = stepFromHash(); if (step !== null) { state.currentStep = step; saveState(); render(); } });
render();
