import { useEffect, useState } from 'react';
import { useGoogleLogin } from '@react-oauth/google';
import { ENV_CONFIG } from '../config/environment';
import { getApiBaseUrl } from '../config/api';
import '../components/features/auth/Login.css';
import './SetupDiagnostics.css';

type BackendStatus = {
  installed: boolean;
  spreadsheetReady: boolean;
  serverClientIdConfigured: boolean;
  clientIdMatches: boolean;
  version: string;
};

type CheckState = 'ok' | 'fail' | 'pending';

const STATE_LABEL: Record<CheckState, string> = { ok: '정상', fail: '조치 필요', pending: '확인 중' };

function StateIcon({ state }: { state: CheckState }) {
  if (state === 'pending') return <span className="setup-check-spinner" aria-hidden="true" />;
  return (
    <svg className="setup-check-icon" viewBox="0 0 16 16" width="16" height="16" aria-hidden="true">
      {state === 'ok'
        ? <path d="M3.5 8.5l3 3 6-7" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
        : <path d="M4.5 4.5l7 7M11.5 4.5l-7 7" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />}
    </svg>
  );
}

export default function SetupDiagnostics() {
  const [backend, setBackend] = useState<BackendStatus | null>(null);
  const [backendError, setBackendError] = useState('');
  const [oauth, setOauth] = useState<'idle' | 'ok' | 'error'>('idle');
  const testLogin = useGoogleLogin({ onSuccess: () => setOauth('ok'), onError: () => setOauth('error') });

  useEffect(() => {
    // 앱의 다른 API와 같은 프록시를 거친다 (브라우저에서 Apps Script를 직접 부르면 CORS로 막힘)
    fetch(getApiBaseUrl(), {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ action: 'getSetupStatus', clientId: ENV_CONFIG.GOOGLE_CLIENT_ID })
    }).then(response => {
      if (!response.ok) throw new Error(`HTTP ${response.status}`);
      return response.json();
    }).then(setBackend).catch(error => setBackendError(error.message));
  }, []);

  // 백엔드 응답을 기다리는 동안은 실패가 아니라 확인 중으로 보인다
  const backendState = (ok: boolean | undefined): CheckState =>
    backend ? (ok ? 'ok' : 'fail') : backendError ? 'fail' : 'pending';

  const checks: Array<{ label: string; state: CheckState; detail: string }> = [
    { label: 'OAuth 클라이언트 ID', state: ENV_CONFIG.GOOGLE_CLIENT_ID ? 'ok' : 'fail', detail: ENV_CONFIG.GOOGLE_CLIENT_ID ? '설정됨' : 'Netlify 환경 변수를 입력하세요.' },
    { label: '백엔드 연결', state: backendState(true), detail: backend ? `연결됨 (v${backend.version})` : backendError || '확인 중…' },
    { label: '백엔드 설치', state: backendState(backend?.installed), detail: !backend ? '백엔드 연결 후 확인합니다.' : backend.installed ? '완료' : '백엔드 주소의 ?page=setup 화면에서 설치하세요.' },
    { label: '회원 시트', state: backendState(backend?.spreadsheetReady), detail: !backend ? '백엔드 연결 후 확인합니다.' : backend.spreadsheetReady ? '찾음' : '백엔드 설치와 SPREADSHEET_ID를 확인하세요.' },
    { label: '서버·사이트 클라이언트 ID 일치', state: backendState(backend?.clientIdMatches), detail: backend?.clientIdMatches ? '일치' : !backend ? '백엔드 연결 후 확인합니다.' : !backend.serverClientIdConfigured ? '백엔드 설치 화면에서 Google OAuth 클라이언트 ID를 설정하세요.' : 'Apps Script의 GOOGLE_CLIENT_ID와 Netlify의 VITE_GOOGLE_CLIENT_ID를 같은 값으로 설정하세요.' },
    { label: 'OAuth 자바스크립트 원본', state: oauth === 'ok' ? 'ok' : oauth === 'error' ? 'fail' : 'pending', detail: oauth === 'ok' ? '로그인 성공' : oauth === 'error' ? 'Google Cloud Console의 승인된 자바스크립트 원본을 확인하세요.' : '아래 버튼으로 확인하세요.' }
  ];

  return (
    <div className="login-page-container">
      <main className="login-container setup-container">
        <div className="login-card setup-card">
          <div className="login-card-left">
            <div className="login-header-left">
              <img src="/logo.svg" alt="Hot Potato Logo" className="login-logo setup-logo" />
              <h1 className="hp-erp-title">HP ERP</h1>
              <p className="hp-erp-subtitle">설치 확인</p>
            </div>
          </div>
          <div className="login-card-right setup-card-right">
            <h2 className="setup-heading">설치 상태</h2>
            <ul className="setup-checks">
              {checks.map(check => (
                <li key={check.label} className={`setup-check setup-check--${check.state}`}>
                  <span className="setup-check-mark" title={STATE_LABEL[check.state]}>
                    <StateIcon state={check.state} />
                    <span className="setup-visually-hidden">{STATE_LABEL[check.state]}</span>
                  </span>
                  <span className="setup-check-text">
                    <strong>{check.label}</strong>
                    <span>{check.detail}</span>
                  </span>
                </li>
              ))}
            </ul>
            <button type="button" className="google-login-btn setup-test-btn" disabled={!ENV_CONFIG.GOOGLE_CLIENT_ID} onClick={() => testLogin()}>
              Google 로그인 테스트
            </button>
          </div>
        </div>
      </main>
    </div>
  );
}
