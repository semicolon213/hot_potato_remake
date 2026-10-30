/* global google */
const STORAGE_KEY = 'hp-erp-install-wizard:v1';
const STEP_META = [
  ['준비', '준비물 확인'],
  ['계정 설정', 'Apps Script API 켜기'],
  ['백엔드', '로그인하고 백엔드 만들기'],
  ['사이트', 'Netlify 사이트 만들기'],
  ['Google 로그인', '웹 클라이언트 설정'],
  ['설치 토큰', '설치 토큰 만들기'],
  ['백엔드 설치', '기관 정보 입력하기'],
  ['사이트 재배포', '클라이언트 ID 반영'],
  ['완료', '최종 점검']
];
const INSTALL_SCOPES = [
  'https://www.googleapis.com/auth/script.projects',
  'https://www.googleapis.com/auth/script.deployments',
  'https://www.googleapis.com/auth/userinfo.email'
].join(' ');

const emptyState = { currentStep: 0, completed: {}, backendUrl: '', scriptId: '', siteUrl: '', appClientId: '', apiError: '' };
let state = loadState();
let finalCheckPassed = false;

const nav = document.querySelector('#step-nav');
const sections = [...document.querySelectorAll('.wizard-step')];
const message = document.querySelector('#message');
const siteInput = document.querySelector('#site-url');
const clientInput = document.querySelector('#app-client-id');
const loginButton = document.querySelector('#login');

function loadState() {
  try {
    const saved = JSON.parse(localStorage.getItem(STORAGE_KEY) || '{}');
    return { ...emptyState, ...saved, completed: saved.completed || {} };
  } catch {
    return { ...emptyState };
  }
}

function saveState() {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
}

function stepFromHash() {
  const match = location.hash.match(/^#step-(\d)$/);
  return match ? Number(match[1]) : null;
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
  sections.forEach((section, index) => section.classList.toggle('active', index === step));
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

function validateStep(step) {
  if (step === 2 && (!validBackendUrl(state.backendUrl) || !state.scriptId)) {
    showMessage('먼저 Google 로그인 버튼을 눌러 백엔드를 끝까지 만드세요.', 'error');
    return false;
  }
  if (step === 3 && !normalizeSiteUrl(siteInput.value)) {
    document.querySelector('#site-url-error').textContent = 'https://로 시작하는 사이트 주소만 입력하세요. 경로와 끝 슬래시는 빼 주세요.';
    return false;
  }
  if ((step === 4 || step === 7) && !validClientId(clientInput.value || state.appClientId)) {
    document.querySelector('#client-id-error').textContent = '.apps.googleusercontent.com으로 끝나는 클라이언트 ID를 입력하세요.';
    if (step === 7) goToStep(4);
    return false;
  }
  if (step === 5 && !state.scriptId) {
    showMessage('2단계에서 백엔드를 먼저 만드세요.', 'error');
    return false;
  }
  if (step === 6 && (!state.backendUrl || !state.appClientId)) {
    showMessage('백엔드 주소와 웹 클라이언트 ID가 필요합니다.', 'error');
    return false;
  }
  if (step === 8 && !finalCheckPassed) {
    showMessage('먼저 자동 점검을 실행해 모든 항목을 확인하세요.', 'error');
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
  document.querySelector('#backend-result').hidden = !state.backendUrl;
  document.querySelector('#backend-url').textContent = state.backendUrl;
  document.querySelector('#script-id').textContent = state.scriptId;
  document.querySelector('#netlify-backend-url').textContent = state.backendUrl || '2단계에서 먼저 백엔드를 만드세요.';
  document.querySelector('#oauth-origin').textContent = state.siteUrl || '3단계에서 사이트 주소를 입력하세요.';
  document.querySelector('#netlify-client-id').textContent = state.appClientId || '4-7에서 클라이언트 ID를 입력하세요.';
  document.querySelector('#editor-link').href = state.scriptId ? `https://script.google.com/d/${encodeURIComponent(state.scriptId)}/edit` : '#';
  document.querySelector('#backend-setup-link').href = state.backendUrl
    ? `${state.backendUrl}?page=setup${state.appClientId ? `&clientId=${encodeURIComponent(state.appClientId)}` : ''}`
    : '#';
  document.querySelector('#setup-link').href = state.siteUrl ? `${state.siteUrl}/setup` : '#';
}

async function copyText(button) {
  const target = document.querySelector(button.dataset.copy);
  const text = target?.textContent?.trim() || '';
  if (!text || text.includes('단계에서')) return showMessage('먼저 앞 단계의 값을 입력하세요.', 'error');
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

async function deployBackend(token, email) {
  const bundleResponse = await fetch('/backend-bundle.json', { cache: 'no-store' });
  if (!bundleResponse.ok) throw new Error('백엔드 코드 묶음을 읽지 못했습니다. 운영자에게 알려 주세요.');
  const bundle = await bundleResponse.json();
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
        await deployBackend(response.access_token, profile.email);
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
  list.append(makeStatusRow('사이트 주소', Boolean(siteUrl), siteUrl || '3단계 주소가 올바르지 않습니다.', 3));
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
      ['백엔드 연결', backend.success === true, backend.success ? `연결됨 (v${backend.version})` : backend.message || '응답 실패', 3],
      ['백엔드 설치', backend.installed === true, backend.installed ? '완료' : '6단계 설치가 필요합니다.', 6],
      ['회원 시트', backend.spreadsheetReady === true, backend.spreadsheetReady ? '준비됨' : '6단계 설치를 확인하세요.', 6],
      ['서버 클라이언트 ID', backend.serverClientIdConfigured === true, backend.serverClientIdConfigured ? '설정됨' : '6단계에서 다시 설치하세요.', 6],
      ['서버·사이트 ID 일치', backend.clientIdMatches === true, backend.clientIdMatches ? '일치' : '7단계 값을 다시 배포하세요.', 7]
    ];
    checks.forEach(check => list.append(makeStatusRow(...check)));
    finalCheckPassed = checks.every(check => check[1]);
    if (finalCheckPassed) {
      state.completed[8] = true;
      saveState();
      showMessage('모든 자동 점검을 통과했습니다. /setup 상세 점검도 확인하세요.', 'success');
      render();
    } else {
      showMessage('고칠 항목이 있습니다. 빨간 항목의 이동 버튼을 누르세요.', 'error');
    }
    return finalCheckPassed;
  } catch (error) {
    const detail = error.name === 'AbortError' ? '15초 안에 응답이 오지 않았습니다.' : error.message;
    list.append(makeStatusRow('백엔드 연결', false, detail, 3));
    showMessage('사이트 프록시에 연결하지 못했습니다.', 'error');
    return false;
  }
}

buildNav();
const initialStep = stepFromHash();
if (initialStep !== null) state.currentStep = initialStep;
siteInput.value = state.siteUrl;
clientInput.value = state.appClientId;
document.querySelector('#deploy-netlify').href = `https://app.netlify.com/start/deploy?repository=${encodeURIComponent(window.INSTALL_CONFIG?.repositoryUrl || '')}`;
document.querySelector('#operator-warning').hidden = validClientId(window.INSTALL_CONFIG?.googleClientId || '');

siteInput.addEventListener('input', () => {
  const normalized = normalizeSiteUrl(siteInput.value);
  document.querySelector('#site-url-error').textContent = siteInput.value && !normalized ? 'https://로 시작하는 사이트 주소만 입력하세요. 경로와 끝 슬래시는 빼 주세요.' : '';
  if (!normalized) return;
  state.siteUrl = normalized;
  state.completed[3] = true;
  saveState();
  render();
});
clientInput.addEventListener('input', () => {
  const value = clientInput.value.trim();
  document.querySelector('#client-id-error').textContent = value && !validClientId(value) ? '.apps.googleusercontent.com으로 끝나는 클라이언트 ID를 입력하세요.' : '';
  if (!validClientId(value)) return;
  state.appClientId = value;
  state.completed[4] = true;
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
