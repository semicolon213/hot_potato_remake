import React, { useState, useEffect, useCallback } from 'react';
import { useAuth } from '../../../hooks/features/auth/useAuth';
import { lastUserManager } from '../../../utils/auth/lastUserManager';
import { apiClient } from '../../../utils/api/apiClient';
import type { EmploymentRow, EmploymentField } from '../../../types/features/students/employment';
import { LegalDocumentView, type LegalDocType } from './LegalDocumentView';

// 타입 정의
interface User {
  email: string;
  name: string;
  studentId: string;
  isAdmin: boolean;
  isApproved: boolean;
  accessToken?: string;
  googleAccessToken?: string;
}

interface LoginProps {
  onLogin: (user: User) => void;
}

const Login: React.FC<LoginProps> = ({ onLogin }) => {
  const [logoSrc, setLogoSrc] = useState<string>("/logo.svg");
  const [logoClickCount, setLogoClickCount] = useState<number>(0);
  const [refreshKey, setRefreshKey] = useState<number>(0);
  /** 제거 확인 중인 계정 이메일 (이 상태일 때만 '제거' 버튼 클릭으로 실제 제거) */
  const [removingEmail, setRemovingEmail] = useState<string | null>(null);

  /** 취업관리 모달 열림 여부 (로그인 카드와 별도로 모달로 띄움) */
  const [isEmploymentModalOpen, setIsEmploymentModalOpen] = useState(false);
  const [employmentStep, setEmploymentStep] = useState<1 | 2>(1);
  const [employmentVerify, setEmploymentVerify] = useState({ std_num: '', name: '', phone: '' });
  const [employmentForm, setEmploymentForm] = useState<Partial<EmploymentRow>>({
    is_major: false,
    field_num: '',
    com_name: '',
    occ_category: '',
    question: ''
  });
  const [employmentError, setEmploymentError] = useState<string | null>(null);
  const [employmentLoading, setEmploymentLoading] = useState(false);
  const [fieldList, setFieldList] = useState<EmploymentField[]>([]);
  const [employmentSaved, setEmploymentSaved] = useState(false);
  /** 취업 정보 2단계: 'before' | 'after' | 'question' */
  const [employmentFormTab, setEmploymentFormTab] = useState<'before' | 'after' | 'question'>('before');
  /** 질문 남기기: 개별 입력 후 저장 시 JSON으로 저장 */
  const [employmentQuestionEntries, setEmploymentQuestionEntries] = useState<{ key: string; value: string }[]>([{ key: '', value: '' }]);

  /** 개인정보처리방침 / 이용약관 (URL ?legal=privacy|terms 동기화, OAuth 동의화면 링크용) */
  const [legalView, setLegalView] = useState<LegalDocType | null>(null);

  const syncLegalFromUrl = useCallback(() => {
    const p = new URLSearchParams(window.location.search).get('legal');
    setLegalView(p === 'privacy' || p === 'terms' ? p : null);
  }, []);

  useEffect(() => {
    syncLegalFromUrl();
    window.addEventListener('popstate', syncLegalFromUrl);
    return () => window.removeEventListener('popstate', syncLegalFromUrl);
  }, [syncLegalFromUrl]);

  const openLegal = (type: LegalDocType) => {
    const u = new URL(window.location.href);
    u.searchParams.set('legal', type);
    window.history.pushState({}, '', u.toString());
    setLegalView(type);
  };

  const closeLegal = () => {
    const u = new URL(window.location.href);
    u.searchParams.delete('legal');
    window.history.replaceState({}, '', `${u.pathname}${u.search}`);
    setLegalView(null);
  };

  const {
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
  } = useAuth(onLogin);

  const handleLogoClick = () => {
    const next = logoClickCount + 1;
    if (next >= 10 && logoSrc !== "/logo-eat.png") {
      setLogoSrc("/logo-eat.png");
    }
    setLogoClickCount(next);
  };

  const handleRemoveAccount = (email: string, e: React.MouseEvent) => {
    e.stopPropagation();
    lastUserManager.remove(email);
    setRemovingEmail(null);
    setRefreshKey(prev => prev + 1);
  };

  const handleConfirmRemove = (email: string) => {
    setRemovingEmail(email);
  };

  const handleCancelRemove = (e: React.MouseEvent) => {
    e.stopPropagation();
    setRemovingEmail(null);
  };

  // 취업관리: 직종 목록 로드 (2단계 진입 시)
  useEffect(() => {
    if (!isEmploymentModalOpen || employmentStep !== 2) return;
    let cancelled = false;
    (async () => {
      const res = await apiClient.getFieldList(undefined);
      if (!cancelled && res.success && res.data) setFieldList(res.data);
    })();
    return () => { cancelled = true; };
  }, [isEmploymentModalOpen, employmentStep]);

  /** 질문 JSON 문자열을 개별 항목 배열로 파싱 (기존 데이터 불러올 때 사용) */
  const parseQuestionToItems = (question: string): { key: string; value: string }[] => {
    const raw = String(question || '').trim();
    if (!raw) return [];
    try {
      const parsed = JSON.parse(raw);
      if (typeof parsed !== 'object' || parsed === null) return [];
      return Object.entries(parsed).map(([k, v]) => ({ key: k, value: String(v ?? '') }));
    } catch {
      return [{ key: '질문', value: raw }];
    }
  };

  const handleEmploymentVerify = async () => {
    const { std_num, name, phone } = employmentVerify;
    if (!std_num.trim() || !name.trim() || !phone.trim()) {
      setEmploymentError('학번, 이름, 전화번호를 모두 입력해주세요.');
      return;
    }
    setEmploymentError(null);
    setEmploymentLoading(true);
    try {
      const res = await apiClient.validateStudentForEmployment({
        std_num: std_num.trim(),
        name: name.trim(),
        phone: phone.trim()
      });
      if (res.success) {
        setEmploymentStep(2);
        setEmploymentForm(prev => ({ ...prev, std_num: std_num.trim() }));
        // 기존 입력 정보가 있으면 불러와서 폼에 채움
        const existingRes = await apiClient.getEmploymentByStdNum(undefined, std_num.trim());
        if (existingRes.success && existingRes.data) {
          const data = existingRes.data;
          setEmploymentForm(prev => ({
            ...prev,
            std_num: std_num.trim(),
            is_major: data.is_major ?? false,
            field_num: data.field_num ?? '',
            com_name: data.com_name ?? '',
            occ_category: data.occ_category ?? ''
          }));
          const entries = parseQuestionToItems(data.question ?? '');
          setEmploymentQuestionEntries(entries.length > 0 ? entries : [{ key: '', value: '' }]);
        } else {
          setEmploymentQuestionEntries([{ key: '', value: '' }]);
        }
      } else {
        setEmploymentError(res.message || '본인 확인에 실패했습니다.');
      }
    } catch (e) {
      setEmploymentError('확인 중 오류가 발생했습니다.');
    } finally {
      setEmploymentLoading(false);
    }
  };

  const handleEmploymentSubmit = async () => {
    if (!employmentForm.std_num) return;
    setEmploymentError(null);
    setEmploymentLoading(true);
    try {
      const questionObj: Record<string, string> = {};
      employmentQuestionEntries.forEach(({ key, value }) => {
        const k = key.trim();
        if (k) questionObj[k] = value.trim();
      });
      const questionToSave = Object.keys(questionObj).length > 0 ? JSON.stringify(questionObj) : '';
      const payload: EmploymentRow = {
        std_num: employmentForm.std_num,
        is_major: employmentForm.is_major ?? false,
        field_num: employmentForm.field_num ?? '',
        com_name: employmentForm.com_name ?? '',
        occ_category: employmentForm.occ_category ?? '',
        question: questionToSave
      };
      const res = await apiClient.saveEmployment(undefined, payload);
      if (res.success) {
        setEmploymentSaved(true);
      } else {
        setEmploymentError(res.message || '저장에 실패했습니다.');
      }
    } catch (e) {
      setEmploymentError('저장 중 오류가 발생했습니다.');
    } finally {
      setEmploymentLoading(false);
    }
  };

  const resetEmploymentView = () => {
    setIsEmploymentModalOpen(false);
    setEmploymentStep(1);
    setEmploymentFormTab('before');
    setEmploymentVerify({ std_num: '', name: '', phone: '' });
    setEmploymentForm({ is_major: false, field_num: '', com_name: '', occ_category: '', question: '' });
    setEmploymentQuestionEntries([{ key: '', value: '' }]);
    setEmploymentError(null);
    setEmploymentSaved(false);
  };

  const addEmploymentQuestionEntry = () => {
    setEmploymentQuestionEntries(prev => [...prev, { key: '', value: '' }]);
  };

  const updateEmploymentQuestionEntry = (index: number, field: 'key' | 'value', value: string) => {
    setEmploymentQuestionEntries(prev =>
      prev.map((entry, i) => (i === index ? { ...entry, [field]: value } : entry))
    );
  };

  const removeEmploymentQuestionEntry = (index: number) => {
    setEmploymentQuestionEntries(prev => (prev.length > 1 ? prev.filter((_, i) => i !== index) : [{ key: '', value: '' }]));
  };

  if (legalView) {
    return <LegalDocumentView type={legalView} onBack={closeLegal} />;
  }

  return (
    <div className="login-container">
      <div className="login-card">
        <div className="login-card-left">
          <div className="login-header-left">
            <img
              src={logoSrc}
              alt="Hot Potato Logo"
              className="login-logo"
              loading="lazy"
              onClick={handleLogoClick}
              onError={() => setLogoSrc("/logo.svg")}
              title=""
            />
            <h1 className="hp-erp-title">HP ERP</h1>
          </div>
        </div>
        <div className="login-card-right">
          {!loginState.isLoggedIn ? (
            <div className="login-section">
              {lastUserManager.getAll().length > 0 ? (
                <>
                  <div className="last-users-section" key={refreshKey}>
                    <div className="last-users-list">
                      {lastUserManager.getAll().map((user) => (
                        <div key={user.email} className="last-user-item">
                          <button
                            onClick={() => loginWithLastUser(user.email)}
                            disabled={loginState.isLoading}
                            className="last-user-btn"
                          >
                            <div className="last-user-avatar">
                              {user.picture ? (
                                <img
                                  src={user.picture}
                                  alt={user.name}
                                  loading="lazy"
                                  onError={(e) => {
                                    // 이미지 로드 실패 시 (429 에러 등) 초기 이니셜 표시
                                    const target = e.target as HTMLImageElement;
                                    target.style.display = 'none';
                                    const parent = target.parentElement;
                                    if (parent && !parent.querySelector('.last-user-initial')) {
                                      const initialDiv = document.createElement('div');
                                      initialDiv.className = 'last-user-initial';
                                      initialDiv.textContent = user.name.charAt(0);
                                      parent.appendChild(initialDiv);
                                    }
                                  }}
                                />
                              ) : (
                                <div className="last-user-initial">{user.name.charAt(0)}</div>
                              )}
                            </div>
                            <div className="last-user-info">
                              <div className="last-user-name">{user.name}</div>
                              <div className="last-user-email">{user.email}</div>
                            </div>
                          </button>
                          {removingEmail === user.email ? (
                            <div className="last-user-remove-actions" onClick={(e) => e.stopPropagation()}>
                              <button
                                type="button"
                                onClick={(e) => handleRemoveAccount(user.email, e)}
                                className="last-user-remove-confirm-btn"
                                title="계정 제거"
                              >
                                제거
                              </button>
                              <button
                                type="button"
                                onClick={handleCancelRemove}
                                className="last-user-remove-cancel-btn"
                                title="취소"
                              >
                                취소
                              </button>
                            </div>
                          ) : (
                            <button
                              onClick={(e) => {
                                e.stopPropagation();
                                handleConfirmRemove(user.email);
                              }}
                              className="last-user-remove-btn"
                              title="계정 제거"
                            >
                              <svg width="16" height="16" viewBox="0 0 16 16" fill="none" xmlns="http://www.w3.org/2000/svg">
                                <path d="M12 4L4 12M4 4L12 12" stroke="currentColor" strokeWidth="2" strokeLinecap="round"/>
                              </svg>
                            </button>
                          )}
                        </div>
                      ))}
                    </div>
                  </div>
                  <div className="login-divider">
                    <span>또는</span>
                  </div>
                </>
              ) : (
                <div className="no-last-user-message">
                  기존 로그인된 계정이 없습니다
                </div>
              )}
              <button
                onClick={() => googleLogin()}
                disabled={loginState.isLoading}
                className="google-login-btn"
              >
                {loginState.isLoading ? (
                  <>
                    <div className="spinner"></div>
                    로그인 중...
                  </>
                ) : (
                  <>
                    <svg className="google-icon" viewBox="0 0 24 24" width="20" height="20">
                      <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"/>
                      <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"/>
                      <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"/>
                      <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"/>
                    </svg>
                    {lastUserManager.getAll().length > 0 ? '다른 계정으로 로그인' : 'Google로 로그인'}
                  </>
                )}
              </button>
              <button
                type="button"
                className="employment-entry-btn"
                onClick={() => setIsEmploymentModalOpen(true)}
              >
                취업관리 (로그인 없이 입력)
              </button>
              <div className="login-legal-links" role="navigation" aria-label="약관">
                <button type="button" className="login-legal-link" onClick={() => openLegal('privacy')}>
                  개인정보처리방침
                </button>
                <span className="login-legal-sep" aria-hidden>
                  ·
                </span>
                <button type="button" className="login-legal-link" onClick={() => openLegal('terms')}>
                  이용약관
                </button>
              </div>
            </div>
          ) : loginState.showRegistrationForm ? (
          <div className="signup-section">
            <h2 className="signup-section-title">회원가입</h2>
            <div className="signup-section-email">{formData.email}</div>

            {loginState.sheetPrefilled && (
              <p className="signup-sheet-hint">학번/교번과 이름은 총 관리자가 시트에 입력한 정보입니다.</p>
            )}
            <div className="input-group">
              <label htmlFor="name">이름 *</label>
              <input
                type="text"
                id="name"
                value={formData.name}
                onChange={(e) => updateFormData('name', e.target.value)}
                placeholder="이름을 입력하세요"
                className={`form-input ${loginState.sheetPrefilled ? 'disabled' : ''}`}
                disabled={loginState.sheetPrefilled}
                readOnly={loginState.sheetPrefilled}
              />
            </div>

            <div className="input-group">
              <label htmlFor="studentId">학번/교번 *</label>
              <input
                type="text"
                id="studentId"
                value={formData.studentId}
                onChange={(e) => updateFormData('studentId', e.target.value)}
                placeholder="학번 또는 교번을 입력하세요"
                className={`form-input ${loginState.sheetPrefilled ? 'disabled' : ''}`}
                disabled={loginState.sheetPrefilled}
                readOnly={loginState.sheetPrefilled}
              />
            </div>

            <div className="input-group">
              <label htmlFor="userType">가입유형 *</label>
              <select
                id="userType"
                value={formData.userType}
                onChange={(e) => updateFormData('userType', e.target.value)}
                className="form-input"
              >
                <option value="">가입유형을 선택하세요</option>
                <option value="student">학생</option>
                <option value="std_council">집행부</option>
                <option value="supp">조교</option>
                <option value="professor">교수</option>
                <option value="ad_professor">겸임교원</option>
              </select>
            </div>

            <div className="input-group">
              <label className="checkbox-label">
                <input
                  type="checkbox"
                  checked={formData.isAdmin}
                  onChange={(e) => updateFormData('isAdmin', e.target.checked)}
                  className="checkbox-input"
                />
                <span className="checkbox-text">관리자로 가입하기</span>
              </label>
            </div>

            {formData.isAdmin && (
              <div className="admin-key-section">
                <div className="input-group">
                  <label htmlFor="adminKey">관리자 키 *</label>
                  <div className="admin-key-input-group">
                    <input
                      type="password"
                      id="adminKey"
                      value={formData.adminKey}
                      onChange={(e) => updateFormData('adminKey', e.target.value)}
                      placeholder="관리자 키를 입력하세요"
                      className="form-input"
                    />
                    <button
                      type="button"
                      onClick={handleVerifyAdminKey}
                      disabled={loginState.isLoading || !formData.adminKey.trim()}
                      className="verify-btn"
                    >
                      인증
                    </button>
                  </div>
                </div>
              </div>
            )}

            {loginState.error && (
              <div className="error-message" onClick={clearError}>
                {loginState.error}
              </div>
            )}

            <button
              type="button"
              onClick={handleRegistration}
              disabled={
                loginState.isLoading
                || !String(formData.name || '').trim()
                || !String(formData.studentId || '').trim()
                || !formData.userType
                || (formData.isAdmin && !String(formData.adminKey || '').trim())
              }
              className="register-btn"
            >
              {loginState.isLoading ? (
                <>
                  <div className="spinner"></div>
                  가입 중...
                </>
              ) : (
                '가입하기'
              )}
            </button>
            <div className="login-legal-links login-legal-links--signup" role="navigation" aria-label="약관">
              <button type="button" className="login-legal-link" onClick={() => openLegal('privacy')}>
                개인정보처리방침
              </button>
              <span className="login-legal-sep" aria-hidden>
                ·
              </span>
              <button type="button" className="login-legal-link" onClick={() => openLegal('terms')}>
                이용약관
              </button>
            </div>
          </div>
        ) : null}
        </div>
      </div>

      {/* 취업 정보 입력 모달 (기존 모달 패턴) */}
      {isEmploymentModalOpen && (
        <div className="employment-modal-overlay" onClick={resetEmploymentView}>
          <div className="employment-modal" onClick={e => e.stopPropagation()}>
            <div className="employment-modal-header">
              <h3>취업 정보 입력</h3>
              <button type="button" className="employment-modal-close" onClick={resetEmploymentView} aria-label="닫기">
                ×
              </button>
            </div>
            <div className="employment-modal-body">
              {employmentSaved ? (
                <div className="employment-done">
                  <p>취업 정보가 저장되었습니다.</p>
                  <button type="button" className="employment-modal-btn primary" onClick={resetEmploymentView}>
                    닫기
                  </button>
                </div>
              ) : employmentStep === 1 ? (
                <>
                  <p className="employment-hint">학번·이름·전화번호로 본인 확인 후 취업 정보를 입력할 수 있습니다.</p>
                  <div className="employment-form-group">
                    <label>학번 *</label>
                    <input
                      type="text"
                      value={employmentVerify.std_num}
                      onChange={e => setEmploymentVerify(prev => ({ ...prev, std_num: e.target.value }))}
                      placeholder="학번"
                      className="employment-input"
                    />
                  </div>
                  <div className="employment-form-group">
                    <label>이름 *</label>
                    <input
                      type="text"
                      value={employmentVerify.name}
                      onChange={e => setEmploymentVerify(prev => ({ ...prev, name: e.target.value }))}
                      placeholder="이름"
                      className="employment-input"
                    />
                  </div>
                  <div className="employment-form-group">
                    <label>전화번호 *</label>
                    <input
                      type="text"
                      value={employmentVerify.phone}
                      onChange={e => setEmploymentVerify(prev => ({ ...prev, phone: e.target.value }))}
                      placeholder="010-1234-5678"
                      className="employment-input"
                    />
                  </div>
                  {employmentError && (
                    <div className="employment-error" onClick={() => setEmploymentError(null)}>{employmentError}</div>
                  )}
                  <button
                    type="button"
                    className="employment-modal-btn primary"
                    disabled={employmentLoading}
                    onClick={handleEmploymentVerify}
                  >
                    {employmentLoading ? '확인 중...' : '본인 확인'}
                  </button>
                </>
              ) : (
                <>
                  <p className="employment-hint">취업 전/후 정보와 질문을 탭에서 나누어 입력해주세요.</p>
                  <div className="employment-tabs">
                    <button
                      type="button"
                      className={`employment-tab ${employmentFormTab === 'before' ? 'active' : ''}`}
                      onClick={() => setEmploymentFormTab('before')}
                    >
                      취업 전
                    </button>
                    <button
                      type="button"
                      className={`employment-tab ${employmentFormTab === 'after' ? 'active' : ''}`}
                      onClick={() => setEmploymentFormTab('after')}
                    >
                      취업 후
                    </button>
                    <button
                      type="button"
                      className={`employment-tab ${employmentFormTab === 'question' ? 'active' : ''}`}
                      onClick={() => setEmploymentFormTab('question')}
                    >
                      질문
                    </button>
                  </div>
                  <div className="employment-tab-content">
                    {employmentFormTab === 'before' && (
                      <>
                        <div className="employment-form-group">
                          <label className="employment-checkbox-label">
                            <input
                              type="checkbox"
                              checked={employmentForm.is_major ?? false}
                              onChange={e => setEmploymentForm(prev => ({ ...prev, is_major: e.target.checked }))}
                              className="employment-checkbox"
                            />
                            <span>전공 취업</span>
                          </label>
                        </div>
                        <div className="employment-form-group">
                          <label>직종 (희망 분야)</label>
                          <select
                            value={employmentForm.field_num ?? ''}
                            onChange={e => setEmploymentForm(prev => ({ ...prev, field_num: e.target.value }))}
                            className="employment-input"
                          >
                            <option value="">선택하세요</option>
                            {fieldList.map(f => (
                              <option key={f.field_num} value={f.field_num}>{f.field_name}</option>
                            ))}
                          </select>
                        </div>
                      </>
                    )}
                    {employmentFormTab === 'after' && (
                      <>
                        <div className="employment-form-group">
                          <label>회사명</label>
                          <input
                            type="text"
                            value={employmentForm.com_name ?? ''}
                            onChange={e => setEmploymentForm(prev => ({ ...prev, com_name: e.target.value }))}
                            placeholder="회사명"
                            className="employment-input"
                          />
                        </div>
                        <div className="employment-form-group">
                          <label>직종</label>
                          <input
                            type="text"
                            value={employmentForm.occ_category ?? ''}
                            onChange={e => setEmploymentForm(prev => ({ ...prev, occ_category: e.target.value }))}
                            placeholder="직종"
                            className="employment-input"
                          />
                        </div>
                      </>
                    )}
                    {employmentFormTab === 'question' && (
                      <div className="employment-form-group">
                        <label>질문 남기기</label>
                        {employmentQuestionEntries.map((entry, idx) => (
                          <div key={idx} className="employment-question-row">
                            <input
                              type="text"
                              value={entry.key}
                              onChange={e => updateEmploymentQuestionEntry(idx, 'key', e.target.value)}
                              placeholder="질문 제목"
                              className="employment-input employment-question-key"
                            />
                            <input
                              type="text"
                              value={entry.value}
                              onChange={e => updateEmploymentQuestionEntry(idx, 'value', e.target.value)}
                              placeholder="내용"
                              className="employment-input employment-question-value"
                            />
                            <button
                              type="button"
                              className="employment-question-remove"
                              onClick={() => removeEmploymentQuestionEntry(idx)}
                              title="삭제"
                              aria-label="삭제"
                            >
                              ×
                            </button>
                          </div>
                        ))}
                        <button type="button" className="employment-question-add" onClick={addEmploymentQuestionEntry}>
                          + 질문 추가
                        </button>
                      </div>
                    )}
                  </div>
                  {employmentError && (
                    <div className="employment-error" onClick={() => setEmploymentError(null)}>{employmentError}</div>
                  )}
                  <button
                    type="button"
                    className="employment-modal-btn primary"
                    disabled={employmentLoading}
                    onClick={handleEmploymentSubmit}
                  >
                    {employmentLoading ? '저장 중...' : '저장'}
                  </button>
                </>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default Login;