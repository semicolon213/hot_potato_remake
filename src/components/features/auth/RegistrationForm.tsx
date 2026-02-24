import React, { useState, useCallback } from 'react';

const STUDENT_ID_PATTERN = /^\d{8,15}$/;

// 타입 정의
interface LoginFormData {
  email: string;
  name: string;
  studentId: string;
  isAdmin: boolean;
  adminKey: string;
  userType: string;
}

interface RegistrationFormProps {
  formData: LoginFormData;
  isLoading: boolean;
  error: string;
  onFormDataChange: (field: keyof LoginFormData, value: string | boolean) => void;
  onVerifyAdminKey: () => void;
  onRegister: () => void;
  onClearError: () => void;
}

const RegistrationForm: React.FC<RegistrationFormProps> = ({
  formData,
  isLoading,
  error,
  onFormDataChange,
  onVerifyAdminKey,
  onRegister,
  onClearError
}) => {
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});

  const validateStudentId = useCallback((value: string): string => {
    const trimmed = value.trim();
    if (!trimmed) return '학번/교번을 입력하세요.';
    if (!STUDENT_ID_PATTERN.test(trimmed)) return '학번/교번은 8~15자리 숫자로 입력하세요.';
    return '';
  }, []);

  const validateUserType = useCallback((value: string): string => {
    if (!value) return '가입유형을 선택하세요.';
    return '';
  }, []);

  const handleStudentIdBlur = () => {
    const msg = validateStudentId(formData.studentId);
    setFieldErrors((prev) => (msg ? { ...prev, studentId: msg } : { ...prev, studentId: '' }));
  };

  const handleUserTypeChange = (value: string) => {
    onFormDataChange('userType', value);
    setFieldErrors((prev) => ({ ...prev, userType: validateUserType(value) }));
  };

  const handleRegisterClick = () => {
    const errors: Record<string, string> = {};
    const studentIdErr = validateStudentId(formData.studentId);
    if (studentIdErr) errors.studentId = studentIdErr;
    const userTypeErr = validateUserType(formData.userType);
    if (userTypeErr) errors.userType = userTypeErr;
    if (formData.isAdmin && !formData.adminKey.trim()) {
      errors.adminKey = '관리자 키를 입력하세요.';
    }
    setFieldErrors(errors);
    if (Object.keys(errors).length === 0) {
      onRegister();
    }
  };

  return (
    <div className="registration-container">
      <div className="registration-card">
        <div className="registration-header">
          <img src="/src/assets/image/potato.png" alt="Hot Potato Logo" className="logo" loading="lazy" />
          <h1>회원가입</h1>
          <p>정보를 입력하여 가입을 완료하세요</p>
        </div>

        <div className="registration-form">
          <div className="form-group">
            <label htmlFor="email">이메일</label>
            <input
              type="email"
              id="email"
              value={formData.email}
              onChange={(e) => onFormDataChange('email', e.target.value)}
              disabled
              className="form-input disabled"
            />
          </div>

          <div className="form-group">
            <label htmlFor="name">이름</label>
            <input
              type="text"
              id="name"
              value={formData.name}
              onChange={(e) => onFormDataChange('name', e.target.value)}
              disabled
              className="form-input disabled"
            />
          </div>

          <div className="form-group">
            <label htmlFor="studentId">학번/교번 *</label>
            <input
              type="text"
              id="studentId"
              value={formData.studentId}
              onChange={(e) => {
                onFormDataChange('studentId', e.target.value);
                if (fieldErrors.studentId) setFieldErrors((prev) => ({ ...prev, studentId: '' }));
              }}
              onBlur={handleStudentIdBlur}
              placeholder="학번 또는 교번을 입력하세요 (8~15자리 숫자)"
              className={`form-input ${fieldErrors.studentId ? 'input-error' : ''}`}
              aria-invalid={!!fieldErrors.studentId}
              aria-describedby={fieldErrors.studentId ? 'studentId-error' : undefined}
            />
            {fieldErrors.studentId && (
              <span id="studentId-error" className="field-error" role="alert">{fieldErrors.studentId}</span>
            )}
          </div>

          <div className="form-group">
            <label htmlFor="userType">가입유형 *</label>
            <select
              id="userType"
              value={formData.userType}
              onChange={(e) => handleUserTypeChange(e.target.value)}
              className={`form-input ${fieldErrors.userType ? 'input-error' : ''}`}
              aria-invalid={!!fieldErrors.userType}
              aria-describedby={fieldErrors.userType ? 'userType-error' : undefined}
            >
              <option value="">가입유형을 선택하세요</option>
              <option value="student">학생</option>
              <option value="std_council">집행부</option>
              <option value="supp">조교</option>
              <option value="professor">교수</option>
              <option value="ad_professor">겸임교원</option>
            </select>
            {fieldErrors.userType && (
              <span id="userType-error" className="field-error" role="alert">{fieldErrors.userType}</span>
            )}
          </div>

          <div className="form-group">
            <label className="checkbox-label">
              <input
                type="checkbox"
                checked={formData.isAdmin}
                onChange={(e) => onFormDataChange('isAdmin', e.target.checked)}
                className="checkbox-input"
              />
              <span className="checkbox-text">관리자로 가입하기</span>
            </label>
          </div>

          {formData.isAdmin && (
            <div className="admin-key-section">
              <div className="form-group">
                <label htmlFor="adminKey">관리자 키 *</label>
                <div className="admin-key-input-group">
                  <input
                    type="password"
                    id="adminKey"
                    value={formData.adminKey}
                    onChange={(e) => {
                      onFormDataChange('adminKey', e.target.value);
                      if (fieldErrors.adminKey) setFieldErrors((prev) => ({ ...prev, adminKey: '' }));
                    }}
                    placeholder="관리자 키를 입력하세요"
                    className={`form-input ${fieldErrors.adminKey ? 'input-error' : ''}`}
                    aria-invalid={!!fieldErrors.adminKey}
                  />
                  {fieldErrors.adminKey && (
                    <span className="field-error" role="alert">{fieldErrors.adminKey}</span>
                  )}
                  <button
                    type="button"
                    onClick={onVerifyAdminKey}
                    disabled={isLoading || !formData.adminKey.trim()}
                    className="verify-btn"
                  >
                    인증
                  </button>
                </div>
              </div>
            </div>
          )}

          {error && (
            <div className="error-message" onClick={onClearError}>
              {error}
            </div>
          )}

          <button
            type="button"
            onClick={handleRegisterClick}
            disabled={isLoading}
            className="register-btn"
          >
            {isLoading ? (
              <>
                <div className="spinner"></div>
                가입 중...
              </>
            ) : (
              '가입하기'
            )}
          </button>
        </div>
      </div>
    </div>
  );
};

export default RegistrationForm;
