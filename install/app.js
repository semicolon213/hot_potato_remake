/* global google */
const scopes = [
  'https://www.googleapis.com/auth/script.projects',
  'https://www.googleapis.com/auth/script.deployments',
  'https://www.googleapis.com/auth/userinfo.email'
].join(' ');
const button = document.querySelector('#login');
const steps = [...document.querySelectorAll('#steps li')];
const result = document.querySelector('#result');
let scriptId = '';

function mark(index, message, failed = false) {
  steps[index].textContent = message;
  steps[index].className = failed ? 'error' : 'ok';
}

async function api(path, token, options = {}) {
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

async function deploy(token, email) {
  const bundleResponse = await fetch('../backend-bundle.json');
  if (!bundleResponse.ok) throw new Error('backend-bundle.json을 읽을 수 없습니다.');
  const bundle = await bundleResponse.json();

  const storageKey = `hp-erp-script-id:${email.toLowerCase()}`;
  scriptId = localStorage.getItem(storageKey) || '';
  let cached = Boolean(scriptId);
  const createProject = async () => {
    scriptId = (await api('projects', token, { method: 'POST', body: JSON.stringify({ title: 'HP ERP Backend' }) })).scriptId;
    localStorage.setItem(storageKey, scriptId);
    cached = false;
  };
  if (!scriptId) await createProject();
  mark(1, `프로젝트 생성 완료: ${scriptId}`);
  try {
    await api(`projects/${scriptId}/content`, token, { method: 'PUT', body: JSON.stringify(bundle) });
  } catch (error) {
    if (!cached || ![403, 404].includes(error.status)) throw error;
    localStorage.removeItem(storageKey);
    await createProject();
    mark(1, `프로젝트 새로 생성 완료: ${scriptId}`);
    await api(`projects/${scriptId}/content`, token, { method: 'PUT', body: JSON.stringify(bundle) });
  }
  mark(2, '백엔드 코드 업로드 완료');
  const version = await api(`projects/${scriptId}/versions`, token, { method: 'POST', body: JSON.stringify({ description: 'HP ERP 초기 설치' }) });
  const deployment = await api(`projects/${scriptId}/deployments`, token, { method: 'POST', body: JSON.stringify({ versionNumber: version.versionNumber, manifestFileName: 'appsscript', description: 'HP ERP 웹 앱' }) });
  const url = `https://script.google.com/macros/s/${deployment.deploymentId}/exec`;
  mark(3, '웹 앱 배포 완료');
  const repositoryUrl = window.INSTALL_CONFIG.repositoryUrl;
  result.innerHTML = `백엔드 주소: <code>${url}</code><br><a href="${url}?page=setup" target="_blank" rel="noreferrer">백엔드 초기 설정 열기</a>${repositoryUrl ? `<br><a href="${repositoryUrl}/actions/workflows/electron-release.yml" target="_blank" rel="noreferrer">설치 파일 만들기</a> · <a href="${repositoryUrl}/releases" target="_blank" rel="noreferrer">설치 파일 다운로드</a>` : ''}`;
}

button.addEventListener('click', () => {
  const clientId = window.INSTALL_CONFIG?.googleClientId;
  if (!clientId) {
    result.textContent = 'install/config.js에 설치용 Google OAuth 클라이언트 ID를 설정하세요.';
    result.className = 'error';
    return;
  }
  if (typeof google === 'undefined' || !google.accounts?.oauth2) {
    finishError(new Error('Google 로그인 스크립트를 불러오는 중입니다. 잠시 후 다시 시도하세요.'));
    return;
  }
  button.disabled = true;
  google.accounts.oauth2.initTokenClient({
    client_id: clientId,
    scope: scopes,
    callback: async response => {
      if (response.error) return finishError(new Error(response.error_description || response.error));
      mark(0, 'Google 로그인 완료');
      try {
        const profile = await fetch('https://www.googleapis.com/oauth2/v3/userinfo', { headers: { Authorization: `Bearer ${response.access_token}` } }).then(res => {
          if (!res.ok) throw new Error('Google 계정 이메일을 확인할 수 없습니다.');
          return res.json();
        });
        await deploy(response.access_token, profile.email);
      } catch (error) { finishError(error); }
    },
    error_callback: error => finishError(new Error(error.message || error.type))
  }).requestAccessToken();
});

function finishError(error) {
  const current = steps.findIndex(step => !step.className);
  if (current >= 0) mark(current, error.message, true);
  result.textContent = `${error.message}${scriptId ? ` (생성된 스크립트 ID: ${scriptId})` : ''}`;
  result.className = 'error';
  button.disabled = false;
}
