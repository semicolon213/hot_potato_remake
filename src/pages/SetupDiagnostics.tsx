import { useEffect, useState } from 'react';
import { useGoogleLogin } from '@react-oauth/google';
import { ENV_CONFIG } from '../config/environment';
import './SetupDiagnostics.css';

type BackendStatus = { installed: boolean; spreadsheetReady: boolean; version: string };

export default function SetupDiagnostics() {
  const [backend, setBackend] = useState<BackendStatus | null>(null);
  const [backendError, setBackendError] = useState('');
  const [oauth, setOauth] = useState<'idle' | 'ok' | 'error'>('idle');
  const testLogin = useGoogleLogin({ onSuccess: () => setOauth('ok'), onError: () => setOauth('error') });

  useEffect(() => {
    if (!ENV_CONFIG.APP_SCRIPT_URL) return;
    const url = new URL(ENV_CONFIG.APP_SCRIPT_URL);
    url.searchParams.set('action', 'getSetupStatus');
    fetch(url).then(response => {
      if (!response.ok) throw new Error(`HTTP ${response.status}`);
      return response.json();
    }).then(setBackend).catch(error => setBackendError(error.message));
  }, []);

  const item = (ok: boolean, label: string, detail: string) => (
    <li className={ok ? 'setup-ok' : 'setup-error'}><strong>{label}</strong><span>{detail}</span></li>
  );

  return (
    <main className="setup-diagnostics">
      <h1>HP ERP 설치 확인</h1>
      <ul>
        {item(Boolean(ENV_CONFIG.GOOGLE_CLIENT_ID), 'OAuth 클라이언트 ID', ENV_CONFIG.GOOGLE_CLIENT_ID ? '설정됨' : 'Netlify 환경 변수를 입력하세요.')}
        {item(Boolean(backend), '백엔드 연결', backend ? `연결됨 (v${backend.version})` : backendError || '확인 중…')}
        {item(Boolean(backend?.installed), '백엔드 설치', backend?.installed ? '완료' : '백엔드 주소의 ?page=setup 화면에서 설치하세요.')}
        {item(Boolean(backend?.spreadsheetReady), '회원 시트', backend?.spreadsheetReady ? '찾음' : '백엔드 설치와 SPREADSHEET_ID를 확인하세요.')}
        {item(oauth === 'ok', 'OAuth 자바스크립트 원본', oauth === 'ok' ? '로그인 성공' : oauth === 'error' ? 'Google Cloud Console의 승인된 자바스크립트 원본을 확인하세요.' : '아래 버튼으로 확인하세요.')}
      </ul>
      <button type="button" disabled={!ENV_CONFIG.GOOGLE_CLIENT_ID} onClick={() => testLogin()}>Google 로그인 테스트</button>
    </main>
  );
}
