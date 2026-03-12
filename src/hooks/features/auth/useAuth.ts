import { useState, useEffect } from 'react';
import { registerUser, verifyAdminKey } from '../../../utils/api/authApi';
import { tokenManager } from '../../../utils/auth/tokenManager';
import { lastUserManager } from '../../../utils/auth/lastUserManager';
import { ENV_CONFIG } from '../../../config/environment';
import { apiClient } from '../../../utils/api/apiClient';

// 타입 정의
interface User {
  email: string;
  name: string;
  studentId: string;
  isAdmin: boolean;
  isApproved: boolean;
  userType?: string;
  accessToken?: string;
  googleAccessToken?: string;
}

interface LoginFormData {
  email: string;
  name: string;
  studentId: string;
  isAdmin: boolean;
  adminKey: string;
  userType: string;
}

interface LoginState {
  isLoggedIn: boolean;
  isLoading: boolean;
  error: string;
  showRegistrationForm: boolean;
  /** 시트에 관리자가 미리 입력한 학번/이름으로 폼이 채워진 경우 (읽기 전용) */
  sheetPrefilled: boolean;
}

interface LoginResponse {
  success: boolean;
  isRegistered: boolean;
  isApproved: boolean;
  studentId?: string;
  /** 시트(hp_member)의 name_member - 관리자가 미리 입력한 이름 */
  nameFromSheet?: string;
  isAdmin?: boolean;
  userType?: string;
  error?: string;
  approvalStatus?: string;
  debug?: {
    message?: string;
    data?: unknown;
    stack?: string;
    [key: string]: unknown;
  };
}

interface RegistrationResponse {
  success: boolean;
  message?: string;
  error?: string;
  debug?: {
    message?: string;
    data?: unknown;
    stack?: string;
    [key: string]: unknown;
  };
}

// API 함수 - apiClient 사용 (환경에 따라 올바른 URL 사용)
const checkUserStatus = async (email: string): Promise<LoginResponse> => {
  try {
    console.log('사용자 상태 확인 요청:', email);

    // apiClient를 사용하여 환경에 맞는 URL 자동 선택 (개발: /api, 프로덕션: 직접 URL)
    const data = await apiClient.checkApprovalStatus(email);

    console.log('사용자 등록 상태 확인 응답:', data);

    // 디버그 정보 출력
    if (data.debug) {
      console.log('🔍 App Script 디버그 정보:', data.debug);
    }

    // 응답 구조 변환 (UserManagement.gs의 응답을 LoginResponse 형식으로)
    const raw = (data as unknown as Record<string, unknown>).data ?? data;
    const responseData = raw as Record<string, unknown> & {
      user?: { no_member?: string; name_member?: string; user_type?: string; userType?: string; Approval?: string; isApproved?: boolean; isAdmin?: boolean; studentId?: string; student_id?: string };
      status?: string;
      approvalStatus?: string;
      studentId?: string;
      isApproved?: boolean;
      message?: string;
    };
    const user = responseData.user;
    const status = (responseData.status ?? responseData.approvalStatus ?? '').toString().toLowerCase();

    // 시트 컬럼명이 'Approval' 또는 'approval' 일 수 있음
    const approvalValue = user && (user.Approval ?? (user as Record<string, unknown>).approval);
    const hasApprovalCol = approvalValue !== undefined && approvalValue !== null && String(approvalValue).trim() !== '';
    const isApprovedByCol = String(approvalValue).trim().toUpperCase() === 'O';

    // hp_member에 행은 있지만 user_type, approval 등이 비어 있으면
    // "가입 승인 요청" 화면(회원가입 폼)으로 보내야 함 → isRegistered = false
    const hasRow = user && (user.no_member || user.student_id || responseData.studentId);
    const hasUserType = (user?.user_type ?? user?.userType ?? '') !== '';
    const registrationNotSubmitted = hasRow && (!hasUserType || !hasApprovalCol);

    // status가 approved/pending이면 이미 등록·승인 플로우가 반영된 것
    const isRegistered = status === 'not_registered' || registrationNotSubmitted
      ? false
      : (status === 'approved' || status === 'pending');
    const isApproved = isRegistered && (status === 'approved' || user?.isApproved === true || responseData.isApproved === true || isApprovedByCol);

    return {
      success: (data as unknown as Record<string, unknown>).success || false,
      isRegistered,
      isApproved,
      approvalStatus: status || 'not_requested',
      studentId: user?.no_member || user?.studentId || responseData.studentId || '',
      nameFromSheet: user?.name_member || undefined,
      isAdmin: user?.isAdmin || false,
      userType: user?.user_type || user?.userType || '',
      error: (data as unknown as Record<string, unknown>).error as string | undefined || responseData.message as string | undefined,
      debug: (data as unknown as Record<string, unknown>).debug
    } as LoginResponse;
  } catch (error) {
    console.error('사용자 상태 확인 실패:', error);
    return {
      success: false,
      isRegistered: false,
      isApproved: false,
      error: '사용자 상태 확인 중 오류가 발생했습니다.'
    };
  }
};

export const useAuth = (onLogin: (user: User) => void) => {
  const [loginState, setLoginState] = useState<LoginState>({
    isLoggedIn: false,
    isLoading: false,
    error: '',
    showRegistrationForm: false,
    sheetPrefilled: false
  });

  const [formData, setFormData] = useState<LoginFormData>({
    email: '',
    name: '',
    studentId: '',
    isAdmin: false,
    adminKey: '',
    userType: ''
  });

  // Google OAuth URL 생성 (리디렉션 방식)
  const buildGoogleOAuthUrl = (hint?: string): string => {
    const clientId = ENV_CONFIG.GOOGLE_CLIENT_ID; // ENV v2: VITE_GOOGLE_CLIENT_ID 기반
    // 리디렉션 URI는 origin만 사용 (슬래시 없이)
    // Google Cloud Console에 등록된 URI와 정확히 일치해야 함
    const redirectUri = window.location.origin;
    const scope = [
      'https://www.googleapis.com/auth/calendar.events',
      'https://www.googleapis.com/auth/calendar.readonly',
      'https://www.googleapis.com/auth/spreadsheets',
      'https://www.googleapis.com/auth/gmail.compose',
      'https://www.googleapis.com/auth/drive',
      'https://www.googleapis.com/auth/documents',
      'profile',
      'email'
    ].join(' ');

    const params = new URLSearchParams({
      client_id: clientId,
      redirect_uri: redirectUri,
      response_type: 'token',
      scope: scope,
      include_granted_scopes: 'true',
      prompt: hint ? 'select_account' : 'consent'
    });

    if (hint) {
      params.append('login_hint', hint);
    }

    return `https://accounts.google.com/o/oauth2/v2/auth?${params.toString()}`;
  };

  // URL에서 액세스 토큰 추출
  const extractTokenFromUrl = (): string | null => {
    const hash = window.location.hash;
    if (!hash) return null;

    const params = new URLSearchParams(hash.substring(1));
    const accessToken = params.get('access_token');
    const expiresIn = params.get('expires_in');

    if (accessToken) {
      // URL에서 토큰 제거 (보안)
      window.history.replaceState({}, document.title, window.location.pathname + window.location.search);
      
      // 토큰 저장
      if (expiresIn) {
        tokenManager.save(accessToken, parseInt(expiresIn));
      } else {
        tokenManager.save(accessToken, 3600);
      }
      
      // 팝업에서 호출된 경우 부모 창에 메시지 전송
      if (window.opener && !window.opener.closed) {
        window.opener.postMessage({
          type: 'GOOGLE_TOKEN_RECEIVED',
          accessToken,
          expiresIn: expiresIn || '3600'
        }, window.location.origin);
        
        // 팝업 닫기
        window.close();
        return accessToken;
      }
      
      return accessToken;
    }
    return null;
  };

  // Google 로그인 성공 처리
  const handleGoogleLoginSuccess = async (accessToken: string) => {
    try {
      setLoginState(prev => ({ ...prev, isLoading: true, error: '' }));

      const response = await fetch(`https://www.googleapis.com/oauth2/v1/userinfo?access_token=${accessToken}`);

      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }

      const userInfo = await response.json();
      const { email, name, picture } = userInfo;

      console.log('Google 로그인 성공:', { email, name });

      // 마지막 로그인 사용자 정보 저장
      lastUserManager.save({ email, name, picture });

      // 사용자 등록 상태 확인
      await checkUserRegistrationStatus(email, name, accessToken);
    } catch (error) {
      console.error('Google 로그인 실패:', error);
      setLoginState(prev => ({
        ...prev,
        isLoading: false,
        error: 'Google 로그인 중 오류가 발생했습니다.'
      }));
    }
  };

  // 일반 Google 로그인 (새 계정 로그인용)
  const googleLogin = (hint?: string) => {
    const authUrl = buildGoogleOAuthUrl(hint);
    // 현재 페이지에서 리디렉션 (팝업 대신)
    window.location.href = authUrl;
  };

  // 컴포넌트 마운트 시 URL에서 토큰 확인 (리디렉션 후)
  useEffect(() => {
    // 팝업 창인 경우 즉시 처리하고 닫기
    if (window.opener && !window.opener.closed) {
      const accessToken = extractTokenFromUrl();
      if (accessToken) {
        // extractTokenFromUrl에서 이미 postMessage를 보냈고 window.close()를 호출했으므로
        // 여기서는 아무것도 하지 않음
        return;
      }
    }
    
    // 일반 로그인 플로우 (메인 창)
    const accessToken = extractTokenFromUrl();
    if (accessToken) {
      handleGoogleLoginSuccess(accessToken);
    }
  }, []);

  // 사용자 등록 상태 확인
  const checkUserRegistrationStatus = async (email: string, name: string, accessToken: string) => {
    try {
      const result = await checkUserStatus(email);
      console.log('사용자 등록 상태 확인 응답:', result);

      if (result.success && result.isRegistered) {
        // 등록된 사용자 - 승인 상태 확인
        if (result.isApproved) {
          // 이미 승인된 회원 - 바로 메인 화면으로 (알림 없이)
          console.log('이미 승인된 회원 - 메인 화면으로 이동');
          onLogin({
            email: email,
            name: name,
            studentId: result.studentId || '',
            isAdmin: result.isAdmin || false,
            isApproved: true,
            userType: result.userType || '',
            accessToken: accessToken,
            googleAccessToken: accessToken
          });
        } else {
          // 승인 대기 중 - 승인 대기 화면으로
          console.log('승인 대기 중인 사용자');
          onLogin({
            email: email,
            name: name,
            studentId: result.studentId || '',
            isAdmin: result.isAdmin || false,
            isApproved: false,
            googleAccessToken: accessToken
          });
        }
      } else {
        // 새로운 사용자 또는 가입 승인 요청 미제출(user_type/Approval 비어 있음) - 회원가입 화면 표시
        // 학번/교번, 이름은 관리자가 시트에 미리 입력한 값으로 채움(있을 경우 읽기 전용)
        console.log('가입 승인 요청 화면 표시 (회원가입 폼)');
        const sheetName = result.nameFromSheet ?? '';
        const sheetStudentId = result.studentId ?? '';
        setFormData(prev => ({
          ...prev,
          email,
          name: sheetName || name || prev.name,
          studentId: sheetStudentId || prev.studentId || ''
        }));
        setLoginState(prev => ({
          ...prev,
          isLoggedIn: true,
          showRegistrationForm: true,
          isLoading: false,
          sheetPrefilled: !!(sheetName || sheetStudentId)
        }));
      }
    } catch (error) {
      console.error('사용자 등록 상태 확인 실패:', error);
      setLoginState(prev => ({
        ...prev,
        error: '사용자 상태 확인 중 오류가 발생했습니다.',
        isLoading: false
      }));
      // 오류 시 회원가입 화면 표시 (시트 데이터 없음)
      setFormData(prev => ({ ...prev, email, name: '', studentId: '' }));
      setLoginState(prev => ({
        ...prev,
        isLoggedIn: true,
        showRegistrationForm: true,
        sheetPrefilled: false
      }));
    }
  };

  // 관리자 키 인증
  const handleVerifyAdminKey = async () => {
    if (!formData.adminKey.trim()) {
      setLoginState(prev => ({ ...prev, error: '관리자 키를 입력해주세요.' }));
      return;
    }

    try {
      setLoginState(prev => ({ ...prev, isLoading: true, error: '' }));

      const result = await verifyAdminKey(formData.adminKey);

      if (result.success) {
        setFormData(prev => ({ ...prev, isAdmin: true }));
        setLoginState(prev => ({ ...prev, error: '관리자 키가 인증되었습니다.' }));
      } else {
        setLoginState(prev => ({ ...prev, error: result.error || '관리자 키 인증에 실패했습니다.' }));
      }
    } catch (error) {
      console.error('관리자 키 인증 실패:', error);
      setLoginState(prev => ({ ...prev, error: '관리자 키 인증 중 오류가 발생했습니다.' }));
    } finally {
      setLoginState(prev => ({ ...prev, isLoading: false }));
    }
  };

  // 회원가입 요청
  const handleRegistration = async () => {
    if (!String(formData.email || '').trim()) {
      setLoginState(prev => ({ ...prev, error: '이메일 정보가 없습니다. 다시 로그인해주세요.' }));
      return;
    }

    if (!String(formData.name || '').trim()) {
      setLoginState(prev => ({ ...prev, error: '이름을 입력해주세요.' }));
      return;
    }

    if (!String(formData.studentId || '').trim()) {
      setLoginState(prev => ({ ...prev, error: '학번/교번을 입력해주세요.' }));
      return;
    }

    if (!formData.userType) {
      setLoginState(prev => ({ ...prev, error: '가입유형을 선택해주세요.' }));
      return;
    }

    try {
      setLoginState(prev => ({ ...prev, isLoading: true, error: '' }));

      const registrationData = {
        email: formData.email,
        name: formData.name,
        studentId: formData.studentId,
        isAdmin: formData.isAdmin,
        adminKey: formData.isAdmin ? formData.adminKey : undefined,
        userType: formData.userType
      };

      const result: RegistrationResponse = await registerUser(registrationData);

      // 디버그 정보 출력
      if (result.debug) {
        console.log('🔍 App Script 디버그 정보:', result.debug);
      }

      if (result.success) {
        onLogin({
          email: formData.email,
          name: formData.name,
          studentId: formData.studentId,
          isAdmin: formData.isAdmin,
          isApproved: false
        });
      } else {
        console.error('회원가입 실패 응답:', result);
        console.error('상세 오류 정보:', {
          message: result.message,
          error: result.error,
          debug: result.debug,
          stack: result.debug?.stack
        });

        // 더 자세한 오류 메시지 표시
        let errorMessage = '회원가입에 실패했습니다.';
        if (result.message) {
          errorMessage = result.message;
        } else if (result.error) {
          errorMessage = result.error;
        }

        setLoginState(prev => ({ ...prev, error: errorMessage }));
      }
    } catch (error) {
      console.error('회원가입 실패:', error);
      setLoginState(prev => ({ ...prev, error: '회원가입 중 오류가 발생했습니다.' }));
    } finally {
      setLoginState(prev => ({ ...prev, isLoading: false }));
    }
  };

  // 폼 데이터 업데이트
  const updateFormData = (field: keyof LoginFormData, value: string | boolean) => {
    setFormData(prev => ({ ...prev, [field]: value }));
  };

  // 에러 메시지 초기화
  const clearError = () => {
    setLoginState(prev => ({ ...prev, error: '' }));
  };

  // 특정 사용자로 빠른 로그인
  const loginWithLastUser = async (email?: string) => {
    const targetEmail = email || (lastUserManager.get()?.email);
    if (!targetEmail) {
      setLoginState(prev => ({ ...prev, error: '저장된 사용자 정보가 없습니다.' }));
      return;
    }

    const lastUser = lastUserManager.getAll().find(u => u.email === targetEmail);
    if (!lastUser) {
      setLoginState(prev => ({ ...prev, error: '저장된 사용자 정보가 없습니다.' }));
      return;
    }

    // 로딩 상태 시작
    setLoginState(prev => ({ ...prev, isLoading: true, error: '' }));

    // 토큰이 유효한지 확인
    const validToken = tokenManager.get();
    if (validToken) {
      // 토큰이 유효하면 사용자 상태 확인 후 바로 로그인
      try {
        const result = await checkUserStatus(lastUser.email);

        if (result.success && result.isRegistered && result.isApproved) {
          // 바로 로그인 처리
          onLogin({
            email: lastUser.email,
            name: lastUser.name,
            studentId: result.studentId || '',
            isAdmin: result.isAdmin || false,
            isApproved: true,
            userType: result.userType || '',
            accessToken: validToken,
            googleAccessToken: validToken
          });
          setLoginState(prev => ({ ...prev, isLoading: false }));
          return;
        } else {
          // 승인되지 않았거나 등록되지 않은 경우
          setLoginState(prev => ({ ...prev, isLoading: false }));
          // 마지막 사용자용 Google 로그인으로 진행 (hint 사용)
          googleLogin(lastUser.email);
          return;
        }
      } catch (error) {
        console.error('마지막 사용자 로그인 실패:', error);
        setLoginState(prev => ({ ...prev, isLoading: false }));
        // 에러 발생 시 마지막 사용자용 Google 로그인으로 진행
        googleLogin(lastUser.email);
        return;
      }
    }

    // 토큰이 없거나 만료되었으면 마지막 사용자용 Google 로그인 시작
    // hint로 계정 지정하여 계정 선택 화면에서 해당 계정이 기본 선택되도록 함
    googleLogin(lastUser.email);
  };

  // 모든 로그인 사용자 목록 가져오기
  const lastUsers = lastUserManager.getAll();

  // 마지막 로그인 사용자 정보 가져오기 (하위 호환성)
  const lastUser = lastUsers.length > 0 ? lastUsers[0] : null;

  return {
    loginState,
    formData,
    googleLogin,
    handleVerifyAdminKey,
    handleRegistration,
    updateFormData,
    clearError,
    loginWithLastUser,
    lastUser,
    lastUsers
  };
};
