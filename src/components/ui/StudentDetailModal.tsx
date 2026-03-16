import React, { useState, useEffect } from 'react';
import { fetchStudentIssues, addStudentIssue, type StudentIssue } from '../../utils/database/papyrusManager';
import { getSheetData } from 'papyrus-db';
import type { Student, StudentWithCouncil } from '../../types/features/students/student';
import type { CareerItem } from '../../types/features/staff';
import type { EmploymentRow, EmploymentAfterUpdate, EmploymentField } from '../../types/features/students/employment';
import './StudentDetailModal.css';
import { ENV_CONFIG } from '../../config/environment';
import { apiClient } from '../../utils/api/apiClient';

type ModalMode = 'student' | 'staff' | 'committee';

interface StudentDetailModalProps {
  student: StudentWithCouncil | null;
  isOpen: boolean;
  onClose: () => void;
  onUpdate: (updatedStudent: StudentWithCouncil) => void;
  onDelete: (studentToDelete: StudentWithCouncil) => void;
  studentSpreadsheetId: string | null;
  mode?: ModalMode;
  isAdding?: boolean;
  user?: {
    userType?: string;
  } | null;
  mainClassifications?: string[];
  otherClassifications?: string[];
}

const emptyStaff: StudentWithCouncil = {
  no_student: '',
  name: '',
  phone_num: '',
  email: '',
  grade: '',
  state: '',
  address: '',
  council: '',
  parsedCouncil: [],
  career: [],
};

const StudentDetailModal: React.FC<StudentDetailModalProps> = ({
  student,
  isOpen,
  onClose,
  onUpdate,
  onDelete,
  studentSpreadsheetId,
  mode = 'student',
  isAdding = false,
  user,
  mainClassifications = [],
  otherClassifications = [],
}) => {
  const [activeTab, setActiveTab] = useState<'info' | 'issues' | 'employment'>('info');
  const [isEditing, setIsEditing] = useState(isAdding);
  const [editedStudent, setEditedStudent] = useState<StudentWithCouncil | null>(isAdding ? emptyStaff : student);
  const [issues, setIssues] = useState<StudentIssue[]>([]);
  const [employment, setEmployment] = useState<EmploymentRow | null>(null);
  const [employmentLoading, setEmploymentLoading] = useState(false);
  const [employmentAfterEdit, setEmploymentAfterEdit] = useState<EmploymentAfterUpdate>({ com_name: '', occ_category: '', question: '' });
  const [employmentSaving, setEmploymentSaving] = useState(false);
  /** 질문 남기기 개별 입력 (저장 시 JSON으로 합침) */
  const [employmentQuestionEntries, setEmploymentQuestionEntries] = useState<{ key: string; value: string }[]>([{ key: '', value: '' }]);
  /** 직종 분야 목록 (field_num → field_name 표시용) */
  const [employmentFieldList, setEmploymentFieldList] = useState<EmploymentField[]>([]);
  const [newIssue, setNewIssue] = useState<Omit<StudentIssue, 'id'>>({
    no_member: '',
    date_issue: '',
    type_issue: '',
    level_issue: '',
    content_issue: ''
  });
  const [isLoading, setIsLoading] = useState(false);
  const [isGradeOther, setIsGradeOther] = useState(false);
  const [customGrade, setCustomGrade] = useState('');
  const [isStateOther, setIsStateOther] = useState(false);
  const [customState, setCustomState] = useState('');
  const [isLevelOther, setIsLevelOther] = useState(false);
  const [customLevel, setCustomLevel] = useState('');
  const [isTypeOther, setIsTypeOther] = useState(false);
  const [customType, setCustomType] = useState('');
  const isSupp = user?.userType === 'supp'; // 조교 여부

  const handleDelete = () => {
    if (window.confirm('정말로 이 항목을 삭제하시겠습니까? 이 작업은 되돌릴 수 없습니다.')) {
      if (editedStudent) {
        onDelete(editedStudent);
        onClose();
      }
    }
  };

  // App Script를 통한 암복호화 함수들
  const decryptPhone = async (encryptedPhone: string): Promise<string> => {
    console.log('연락처 복호화 시도:', encryptedPhone);
    
    if (!encryptedPhone) {
      console.log('연락처 복호화 건너뜀 - 데이터 없음');
      return encryptedPhone;
    }

    // 이미 복호화된 연락처인지 확인 (010-xxxx-xxxx 패턴)
    if (/^010-\d{4}-\d{4}$/.test(encryptedPhone)) {
      console.log('이미 복호화된 연락처:', encryptedPhone);
      return encryptedPhone;
    }

    try {
      // 개발 환경에서는 프록시 사용, 프로덕션에서는 직접 URL 사용
      const isDevelopment = import.meta.env.DEV;
      const baseUrl = isDevelopment ? '/api' : (ENV_CONFIG.APP_SCRIPT_URL || '');
      
      const requestBody = {
        action: 'decryptEmail',
        data: encryptedPhone
      };
      console.log('복호화 요청 데이터:', { baseUrl, requestBody });
      
      const response = await fetch(baseUrl, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(requestBody)
      });

      console.log('복호화 응답 상태:', response.status);
      
      if (response.ok) {
        const result = await response.json();
        console.log('복호화 응답 데이터:', result);
        return result.success ? result.data : encryptedPhone;
      } else {
        console.error('복호화 응답 실패:', response.status, response.statusText);
      }
    } catch (error) {
      console.error('연락처 복호화 실패:', error);
    }
    
    return encryptedPhone;
  };

  const encryptPhone = async (phone: string): Promise<string> => {
    console.log('연락처 암호화 시도:', phone);
    
    if (!phone) {
      console.log('연락처 암호화 건너뜀 - 데이터 없음');
      return phone;
    }

    // 이미 암호화된 연락처인지 확인 (암호화된 데이터는 일반적으로 길고 특수문자 포함)
    if (phone.length > 20 || !/^010-\d{4}-\d{4}$/.test(phone)) {
      console.log('이미 암호화된 연락처 또는 암호화 불필요:', phone);
      return phone;
    }

    try {
      // 개발 환경에서는 프록시 사용, 프로덕션에서는 직접 URL 사용
      const isDevelopment = import.meta.env.DEV;
      const baseUrl = isDevelopment ? '/api' : (ENV_CONFIG.APP_SCRIPT_URL || '');
      
      console.log('🔗 사용하는 URL:', baseUrl);
      console.log('🔗 ENV_CONFIG.APP_SCRIPT_URL:', ENV_CONFIG.APP_SCRIPT_URL);
      console.log('🔗 개발환경 여부:', isDevelopment);
      
      const requestBody = {
        action: 'encryptEmail',
        data: phone
      };
      console.log('암호화 요청 데이터:', { baseUrl, requestBody });
      
      const response = await fetch(baseUrl, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(requestBody)
      });

      console.log('암호화 응답 상태:', response.status);
      
      if (response.ok) {
        const result = await response.json();
        console.log('암호화 응답 데이터:', result);
        if (result.debug) {
          console.log('🔍 디버그 정보:', result.debug);
        }
        return result.success ? result.data : phone;
      } else {
        console.error('암호화 응답 실패:', response.status, response.statusText);
      }
    } catch (error) {
      console.error('연락처 암호화 실패:', error);
    }
    
    return phone;
  };

  // 수정된 값이 있는지 확인하는 함수
  const hasUnsavedChanges = () => {
    if (!student || !editedStudent) return false;
    
    return (
      editedStudent.no_student !== student.no_student ||
      editedStudent.name !== student.name ||
      editedStudent.phone_num !== student.phone_num ||
      editedStudent.grade !== student.grade ||
      editedStudent.state !== student.state ||
      editedStudent.address !== student.address ||
      editedStudent.council !== student.council ||
      (editedStudent.email || '') !== (student.email || '')
    );
  };

  // 모달 닫기 핸들러 (수정 중일 때 확인)
  const handleCloseModal = () => {
    if (isEditing && hasUnsavedChanges()) {
      const shouldSave = window.confirm('수정된 내용이 있습니다. 저장하시겠습니까?');
      if (shouldSave) {
        handleSave();
      } else {
        // 수정 모드만 끄고 원본 데이터로 복원
        setIsEditing(false);
        if (student) {
          setEditedStudent({ ...student });
        }
      }
    } else {
      // 수정 중이 아니거나 변경사항이 없으면 바로 닫기
      onClose();
    }
  };

  useEffect(() => {
    if (isOpen) {
      setIsEditing(isAdding); // Reset editing state every time modal opens
      if (isAdding) {
        setEditedStudent(emptyStaff);
      } else if (student) {
        // 연락처 복호화 후 학생 데이터 설정
        const loadStudentData = async () => {
          const decryptedPhone = await decryptPhone(student.phone_num);
          setEditedStudent({ 
            ...student, 
            phone_num: decryptedPhone 
          });
          setNewIssue({
            no_member: student.no_student,
            date_issue: '',
            type_issue: '',
            level_issue: '',
            content_issue: ''
          });
          loadStudentIssues();
        };
        
        loadStudentData();
      }
          }
        }, [student, isOpen, isAdding, user]);
    
                    useEffect(() => {
    
                      if (editedStudent && mode === 'committee') {
    
                        const standardGrades = ["교과과정위원회", "학과운영위원회", "입학위원회", "졸업위원회"];
    
                        if (editedStudent.grade && !standardGrades.includes(editedStudent.grade)) {
    
                          setIsGradeOther(true);
    
                          setCustomGrade(editedStudent.grade);
    
                        } else {
    
                          setIsGradeOther(false);
    
                          setCustomGrade('');
    
                        }
    
                
    
                        const standardStates = ["위원장", "위원", "간사", "자문위원", "직접 입력"];
    
                        if (editedStudent.state && !standardStates.includes(editedStudent.state)) {
    
                          setIsStateOther(true);
    
                          setCustomState(editedStudent.state);
    
                        } else {
    
                          setIsStateOther(false);
    
                          setCustomState('');
    
                        }
    
                      } else if (editedStudent && mode === 'student') {
    
                        const standardStates = ["재학", "휴학", "졸업", "자퇴"];
    
                        if (editedStudent.state && !standardStates.includes(editedStudent.state)) {
    
                          setIsStateOther(true);
    
                          setCustomState(editedStudent.state);
    
                        } else {
    
                          setIsStateOther(false);
    
                          setCustomState('');
    
                        }
    
                      }
    
                    }, [editedStudent, mode]);  const loadStudentIssues = async () => {
    if (!student) return;

    setIsLoading(true);
    try {
      const studentIssues = await fetchStudentIssues(student.no_student);
      setIssues(studentIssues);
    } catch (error) {
      console.error('특이사항 로드 실패:', error);
    } finally {
      setIsLoading(false);
    }
  };

  // 취업관리: 학번으로 취업 정보 로드 + 직종 분야 목록 로드
  const loadEmployment = async () => {
    if (!student || !studentSpreadsheetId) return;
    setEmploymentLoading(true);
    try {
      const [empRes, fieldRes] = await Promise.all([
        apiClient.getEmploymentByStdNum(studentSpreadsheetId, student.no_student),
        apiClient.getFieldList(studentSpreadsheetId)
      ]);
      if (fieldRes.success && fieldRes.data) {
        setEmploymentFieldList(fieldRes.data);
      } else {
        setEmploymentFieldList([]);
      }
      const res = empRes;
      if (res.success && res.data) {
        setEmployment(res.data);
        setEmploymentAfterEdit({
          com_name: res.data.com_name ?? '',
          occ_category: res.data.occ_category ?? '',
          question: res.data.question ?? ''
        });
        const entries = parseQuestionToItems(res.data.question ?? '');
        setEmploymentQuestionEntries(entries.length > 0 ? entries : [{ key: '', value: '' }]);
      } else {
        setEmployment(null);
        setEmploymentAfterEdit({ com_name: '', occ_category: '', question: '' });
        setEmploymentQuestionEntries([{ key: '', value: '' }]);
      }
    } catch (e) {
      console.error('취업 정보 로드 실패:', e);
      setEmployment(null);
    } finally {
      setEmploymentLoading(false);
    }
  };

  /** 질문 JSON 문자열을 파싱해 개별 항목 배열로 반환 (표시용) */
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

  // 취업 후만 저장 (학생관리에서 수정, 질문은 개별 입력을 JSON으로 합쳐 저장)
  const handleSaveEmploymentAfter = async () => {
    if (!student || !studentSpreadsheetId) return;
    setEmploymentSaving(true);
    try {
      const questionObj: Record<string, string> = {};
      employmentQuestionEntries.forEach(({ key, value }) => {
        const k = key.trim();
        if (k) questionObj[k] = value.trim();
      });
      const questionToSave = Object.keys(questionObj).length > 0 ? JSON.stringify(questionObj) : '';
      const payload: EmploymentAfterUpdate = {
        com_name: employmentAfterEdit.com_name,
        occ_category: employmentAfterEdit.occ_category,
        question: questionToSave
      };
      const res = await apiClient.updateEmploymentAfter(studentSpreadsheetId, student.no_student, payload);
      if (res.success) {
        setEmployment(prev => prev ? { ...prev, com_name: payload.com_name, occ_category: payload.occ_category, question: payload.question } : null);
        setEmploymentAfterEdit(prev => ({ ...prev, question: questionToSave }));
        const entries = parseQuestionToItems(questionToSave);
        setEmploymentQuestionEntries(entries.length > 0 ? entries : [{ key: '', value: '' }]);
      } else {
        alert(res.message || '저장에 실패했습니다.');
      }
    } catch (e) {
      console.error('취업 후 저장 실패:', e);
      alert('저장에 실패했습니다.');
    } finally {
      setEmploymentSaving(false);
    }
  };

  const handleCareerChange = (index: number, field: keyof CareerItem, value: string) => {
    if (!editedStudent || !Array.isArray(editedStudent.career)) return;
    const newCareer = [...editedStudent.career];
    newCareer[index] = { ...newCareer[index], [field]: value };
    setEditedStudent(prev => prev ? { ...prev, career: newCareer } : null);
  };

  const addCareerItem = () => {
    if (!editedStudent) return;
    const newCareerItem: CareerItem = { company: '', position: '', period: '', description: '' };
    const newCareer = [...(editedStudent.career || []), newCareerItem];
    setEditedStudent(prev => prev ? { ...prev, career: newCareer } : null);
  };

  const removeCareerItem = (index: number) => {
    if (!editedStudent || !Array.isArray(editedStudent.career)) return;
    const newCareer = editedStudent.career.filter((_, i) => i !== index);
    setEditedStudent(prev => prev ? { ...prev, career: newCareer } : null);
  };

  const handleSave = async () => {
    if (!editedStudent) return;

    // Create a mutable copy to hold the final values
    const studentToSave = { ...editedStudent };

                      if (mode === 'committee') {

                        if (isGradeOther) {

                          studentToSave.grade = customGrade;

                        }

                        if (isStateOther) {

                          studentToSave.state = customState;

                        }

                      } else if (mode === 'student') {

                        if (isStateOther) {

                          studentToSave.state = customState;

                        }

                      }    // 연락처와 이메일 유효성 검사
    if (mode === 'staff' || mode === 'committee' || mode === 'student') {
      const phone = studentToSave.phone_num;
      if (!/^\d{3}-\d{3,4}-\d{4}$/.test(phone)) {
        alert('연락처는 하이픈(-)을 포함한 12~13자리 숫자로 입력해야 합니다.');
        return;
      }
      // 이메일 유효성 검사는 교직원/위원회 모드에서만 적용
      if ((mode === 'staff' || mode === 'committee') && !studentToSave.email.includes('@')) {
        alert('이메일 형식이 올바르지 않습니다. "@"를 포함해야 합니다.');
        return;
      }
    }

    if (mode === 'staff') {
      const requiredFields = [
        { key: 'no_student', name: '교번' },
        { key: 'grade', name: '구분' },
        { key: 'name', name: '이름' },
        { key: 'address', name: '내선번호' },
        { key: 'phone_num', name: '연락처' },
        { key: 'email', name: '이메일' },
      ];

      for (const field of requiredFields) {
        const value = studentToSave[field.key as keyof StudentWithCouncil];
        if (typeof value !== 'string' || !value.trim()) {
          alert(`${field.name}은(는) 필수 입력 항목입니다.`);
          return; // 저장 중단
        }
      }
    }

    // 위원회 필수 항목 유효성 검사
    if (mode === 'committee') {
      const requiredFields = [
        { key: 'grade', name: '위원회 구분' },
        { key: 'name', name: '이름' },
        { key: 'phone_num', name: '연락처' },
        { key: 'email', name: '이메일' },
        { key: 'state', name: '직책' },
      ];

      for (const field of requiredFields) {
        const value = studentToSave[field.key as keyof StudentWithCouncil];
        if (typeof value !== 'string' || !value.trim()) {
          alert(`${field.name}은(는) 필수 입력 항목입니다.`);
          return; // 저장 중단
        }
      }
    }

    // 학생 필수 항목 유효성 검사
    if (mode === 'student') {
      const requiredFields = [
        { key: 'no_student', name: '학번' },
        { key: 'name', name: '이름' },
        { key: 'phone_num', name: '연락처' },
        { key: 'grade', name: '학년' },
        { key: 'address', name: '주소' },
      ];

      for (const field of requiredFields) {
        const value = studentToSave[field.key as keyof StudentWithCouncil];
        if (typeof value !== 'string' || !value.trim()) {
          alert(`${field.name}은(는) 필수 입력 항목입니다.`);
          return; // 저장 중단
        }
      }
    }

    // 저장하기 전 비어있는 경력 항목 자동 삭제
    if (studentToSave.career && Array.isArray(studentToSave.career)) {
      studentToSave.career = studentToSave.career.filter(
        item => item.period.trim() !== '' || item.company.trim() !== '' || item.position.trim() !== ''
      );
    }

    // The modal should not handle the update logic itself.
    // It should pass the cleaned data back to the parent component.
    onUpdate(studentToSave);
    setIsEditing(false);
    onClose();
  };

  const handleAddIssue = async () => {
    // Updated validation for type_issue
    if (!isTypeOther && !newIssue.type_issue) {
      alert('유형을 선택해주세요.');
      return;
    }
    if (isTypeOther && !customType.trim()) {
      alert('유형을 직접 입력해주세요.');
      return;
    }
    // Updated validation for level_issue
    if (!isLevelOther && !newIssue.level_issue) {
      alert('주의도를 선택해주세요.');
      return;
    }
    if (isLevelOther && !customLevel.trim()) {
      alert('주의도를 직접 입력해주세요.');
      return;
    }
    if (!newIssue.content_issue.trim()) {
      alert('내용을 입력해주세요.');
      return;
    }

    try {
      if (!studentSpreadsheetId) {
        alert('학생 스프레드시트 ID를 찾을 수 없습니다.');
        return;
      }

      const issueData = {
        no_member: newIssue.no_member,
        date_issue: newIssue.date_issue || new Date().toISOString().split('T')[0],
        type_issue: isTypeOther ? customType : newIssue.type_issue, // Use custom type if set
        level_issue: isLevelOther ? customLevel : newIssue.level_issue, // Use custom level if set
        content_issue: newIssue.content_issue
      };

      await addStudentIssue(studentSpreadsheetId, issueData);
      
      const newIssueWithId: StudentIssue = {
        ...issueData,
        id: `issue_${Date.now()}`
      };
      setIssues(prev => [...prev, newIssueWithId]);
      
      // Reset form including all custom fields
      setNewIssue({
        no_member: student?.no_student || '',
        date_issue: new Date().toISOString().split('T')[0],
        type_issue: '',
        level_issue: '',
        content_issue: ''
      });
      setIsTypeOther(false);
      setCustomType('');
      setIsLevelOther(false);
      setCustomLevel('');
      
      alert('특이사항이 성공적으로 추가되었습니다.');
    } catch (error) {
      console.error('특이사항 추가 실패:', error);
      alert('특이사항 추가에 실패했습니다.');
    }
  };

  const handleInputChange = (field: keyof StudentWithCouncil, value: string) => {
    if (!editedStudent) return;
    setEditedStudent(prev => prev ? { ...prev, [field]: value } : null);
  };



  const handleIssueInputChange = (field: keyof Omit<StudentIssue, 'id'>, value: string) => {
    setNewIssue(prev => ({ ...prev, [field]: value }));
  };

  // 일렉트론에서 입력 필드 포커스 문제 해결
  const handleInputFocus = (e: React.FocusEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>) => {
    e.target.focus();
    if ('select' in e.target && typeof e.target.select === 'function') {
      e.target.select();
    }
  };

  if (!isOpen || (!student && !isAdding) || !editedStudent) return null;

  return (
    <>
      <style>{`
        .career-editor {
          display: flex;
          flex-direction: column;
          gap: 8px;
        }
        .career-item {
          display: flex;
          gap: 8px;
          align-items: center;
        }
        .career-item input {
          flex-grow: 1;
          min-width: 0;
        }
        .career-item .remove-btn {
          flex-shrink: 0;
        }
        .career-display input.career-view-item {
          width: 100%;
          box-sizing: border-box;
          margin-bottom: 4px; /* 보기 모드에서 경력 아이템 간 여백 추가 */
        }
        .career-editor .form-group {
          margin-bottom: 4px; /* 경력 아이템 간 세로 여백 줄이기 */
        }
      `}</style>
      <div className="modal-overlay" onClick={handleCloseModal}>
        <div className="modal-container" onClick={(e) => e.stopPropagation()}>
          {/* Header */}
        <div className="modal-header">
          <h2>
            {isAdding
              ? (mode === 'staff' ? '교직원 추가' :
                 mode === 'committee' ? '위원 추가' :
                 '학생 추가')
              : (mode === 'staff' ? '교직원 정보' :
                 mode === 'committee' ? '위원회 정보' :
                 '학생 정보')}
          </h2>
          <div className="header-actions">
            {!isEditing ? (
              <>
                <button className="delete-btn" onClick={handleDelete}>
                  삭제
                </button>
                <button className="edit-btn" onClick={() => setIsEditing(true)}>
                  수정
                </button>
              </>
            ) : (
              <button className="save-btn" onClick={handleSave}>
                저장
              </button>
            )}
            <button className="close-btn" onClick={handleCloseModal}>
              ✕
            </button>
          </div>
        </div>

        {/* Tabs */}
        <div className="modal-tabs">
          <button 
            className={`tab-btn ${activeTab === 'info' ? 'active' : ''}`}
            onClick={() => setActiveTab('info')}
          >
            {mode === 'staff' ? '교직원 정보' : 
             mode === 'committee' ? '위원회 정보' : 
             '기본 정보'}
          </button>
          {mode === 'student' && (
            <button 
              className={`tab-btn ${activeTab === 'issues' ? 'active' : ''}`}
              onClick={() => setActiveTab('issues')}
            >
              특이사항
            </button>
          )}
          {mode === 'student' && (
            <button 
              className={`tab-btn ${activeTab === 'employment' ? 'active' : ''}`}
              onClick={() => {
                setActiveTab('employment');
                loadEmployment();
              }}
            >
              취업관리
            </button>
          )}
        </div>

        {/* Content */}
        <div className="modal-body">
          {activeTab === 'info' && (
            <div className="info-section">
              <h3>기본 정보</h3>
              <div className="form-grid">
                {mode === 'staff' ? (
                  // 교직원 필드들 (8개 필드)
                  <>
                    <div className="form-group">
                      <label>교번<span style={{color: 'red'}}>*</span></label>
                      <input
                        type="text"
                        value={editedStudent.no_student}
                        onChange={(e) => handleInputChange('no_student', e.target.value)}
                        disabled={!isEditing}
                        onFocus={handleInputFocus}
                      />
                    </div>

                    <div className="form-group">
                      <label>구분<span style={{color: 'red'}}>*</span></label>
                      <select
                        value={editedStudent.grade}
                        onChange={(e) => handleInputChange('grade', e.target.value)}
                        disabled={!isEditing}
                        onFocus={handleInputFocus}
                      >
                        <option value="">선택하세요</option>
                        {mainClassifications.map(pos => (
                          <option key={pos} value={pos}>{pos}</option>
                        ))}
                        {otherClassifications.length > 0 && (
                          <optgroup label="기타">
                            {otherClassifications.map(pos => (
                              <option key={pos} value={pos}>{pos}</option>
                            ))}
                          </optgroup>
                        )}
                      </select>
                    </div>

                    <div className="form-group">
                      <label>이름<span style={{color: 'red'}}>*</span></label>
                      <input
                        type="text"
                        value={editedStudent.name}
                        onChange={(e) => handleInputChange('name', e.target.value)}
                        disabled={!isEditing}
                        onFocus={handleInputFocus}
                      />
                    </div>

                    <div className="form-group">
                      <label>내선번호<span style={{color: 'red'}}>*</span></label>
                      <input
                        type="text"
                        value={editedStudent.address}
                        onChange={(e) => handleInputChange('address', e.target.value)}
                        disabled={!isEditing}
                        onFocus={handleInputFocus}
                        placeholder="내선번호를 입력하세요"
                      />
                    </div>

                    <div className="form-group">
                      <label>연락처<span style={{color: 'red'}}>*</span></label>
                      <input
                        type="text"
                        value={mode === 'staff' || mode === 'committee' ? editedStudent.phone_num : (editedStudent.council.split(' / ')[0] || '')}
                        onChange={(e) => {
                          const value = e.target.value;
                          const digitsOnly = value.replace(/\D/g, '');
                          let formattedValue = digitsOnly;

                          if (digitsOnly.length > 3 && digitsOnly.length <= 7) {
                            formattedValue = `${digitsOnly.slice(0, 3)}-${digitsOnly.slice(3)}`;
                          } else if (digitsOnly.length > 7) {
                            formattedValue = `${digitsOnly.slice(0, 3)}-${digitsOnly.slice(3, 7)}-${digitsOnly.slice(7, 11)}`;
                          }
                          
                          if (mode === 'staff' || mode === 'committee') {
                            handleInputChange('phone_num', formattedValue);
                          } else {
                            const parts = editedStudent.council.split(' / ');
                            const newCouncil = `${value} / ${parts[1] || ''} / ${parts[2] || ''}`;
                            handleInputChange('council', newCouncil);
                          }
                        }}
                        disabled={!isEditing}
                        onFocus={handleInputFocus}
                        placeholder="010-1234-5678"
                        maxLength={13}
                      />
                    </div>

                    <div className="form-group">
                      <label>이메일<span style={{color: 'red'}}>*</span></label>
                      <input
                        type="email"
                        value={mode === 'staff' || mode === 'committee' ? (editedStudent.email || '') : (editedStudent.council.split(' / ')[1] || '')}
                        onChange={(e) => {
                          if (mode === 'staff' || mode === 'committee') {
                            handleInputChange('email', e.target.value);
                          } else {
                            const parts = editedStudent.council.split(' / ');
                            const newCouncil = `${parts[0] || ''} / ${e.target.value} / ${parts[2] || ''}`;
                            handleInputChange('council', newCouncil);
                          }
                        }}
                        disabled={!isEditing}
                        onFocus={handleInputFocus}
                        placeholder="example@university.ac.kr"
                      />
                    </div>

                    <div className="form-group">
                      <label>임용일</label>
                      <input
                        type="date"
                        value={editedStudent.state}
                        onChange={(e) => handleInputChange('state', e.target.value)}
                        disabled={!isEditing}
                        onFocus={handleInputFocus}
                      />
                    </div>

                    <div className="form-group">
                      <label>비고</label>
                      <input
                        type="text"
                        value={mode === 'staff' || mode === 'committee' ? editedStudent.council : (editedStudent.council.split(' / ')[2] || '')}
                        onChange={(e) => {
                          if (mode === 'staff' || mode === 'committee') {
                            handleInputChange('council', e.target.value);
                          } else {
                            const parts = editedStudent.council.split(' / ');
                            const newCouncil = `${parts[0] || ''} / ${parts[1] || ''} / ${e.target.value}`;
                            handleInputChange('council', newCouncil);
                          }
                        }}
                        disabled={!isEditing}
                        onFocus={handleInputFocus}
                        placeholder="추가 정보나 메모를 입력하세요"
                      />
                    </div>
                  </>
                ) : mode === 'committee' ? (
                  // 위원회 필드들 (올바른 데이터 바인딩으로 전면 수정)
                  <>
                    <div className="form-group">
                      <label>위원회 구분<span style={{color: 'red'}}>*</span></label>
                      <select
                        value={isGradeOther ? '직접 입력' : editedStudent.grade}
                        onChange={(e) => {
                          if (e.target.value === '직접 입력') {
                            setIsGradeOther(true);
                          } else {
                            setIsGradeOther(false);
                            handleInputChange('grade', e.target.value);
                          }
                        }}
                        disabled={!isEditing}
                        onFocus={handleInputFocus}
                      >
                        <option value="">선택하세요</option>
                        <option value="교과과정위원회">교과과정위원회</option>
                        <option value="학과운영위원회">학과운영위원회</option>
                        <option value="입학위원회">입학위원회</option>
                        <option value="졸업위원회">졸업위원회</option>
                        <option value="직접 입력">직접 입력</option>
                      </select>
                      {isGradeOther && (
                        <input
                          type="text"
                          value={customGrade}
                          onChange={(e) => setCustomGrade(e.target.value)}
                          placeholder="위원회 구분 직접 입력"
                          disabled={!isEditing}
                          style={{ marginTop: '8px' }}
                        />
                      )}
                    </div>

                    <div className="form-group">
                      <label>이름<span style={{color: 'red'}}>*</span></label>
                      <input
                        type="text"
                        value={editedStudent.name}
                        onChange={(e) => handleInputChange('name', e.target.value)}
                        disabled={!isEditing}
                        onFocus={handleInputFocus}
                      />
                    </div>

                    <div className="form-group">
                      <label>연락처<span style={{color: 'red'}}>*</span></label>
                      <input
                        type="text"
                        value={editedStudent.phone_num} // phone_num 직접 사용
                        onChange={(e) => {
                          const value = e.target.value;
                          const digitsOnly = value.replace(/\D/g, '');
                          let formattedValue = digitsOnly;

                          if (digitsOnly.length > 3 && digitsOnly.length <= 7) {
                            formattedValue = `${digitsOnly.slice(0, 3)}-${digitsOnly.slice(3)}`;
                          } else if (digitsOnly.length > 7) {
                            formattedValue = `${digitsOnly.slice(0, 3)}-${digitsOnly.slice(3, 7)}-${digitsOnly.slice(7, 11)}`;
                          }
                          
                          handleInputChange('phone_num', formattedValue);
                        }}
                        disabled={!isEditing}
                        onFocus={handleInputFocus}
                        placeholder="010-1234-5678"
                        maxLength={13}
                      />
                    </div>

                    <div className="form-group">
                      <label>이메일<span style={{color: 'red'}}>*</span></label>
                      <input
                        type="email"
                        value={editedStudent.email || ''} // email 직접 사용
                        onChange={(e) => handleInputChange('email', e.target.value)}
                        disabled={!isEditing}
                        onFocus={handleInputFocus}
                        placeholder="example@company.com"
                      />
                    </div>

                    <div className="form-group">
                      <label>직책<span style={{color: 'red'}}>*</span></label>
                      <select
                        value={isStateOther ? '기타' : editedStudent.state}
                        onChange={(e) => {
                          if (e.target.value === '직접 입력') {
                            setIsStateOther(true);
                          } else {
                            setIsStateOther(false);
                            handleInputChange('state', e.target.value);
                          }
                        }}
                        disabled={!isEditing}
                        onFocus={handleInputFocus}
                      >
                        <option value="">선택하세요</option>
                        <option value="위원장">위원장</option>
                        <option value="위원">위원</option>
                        <option value="간사">간사</option>
                        <option value="자문위원">자문위원</option>
                        <option value="직접 입력">직접 입력</option>
                      </select>
                      {isStateOther && (
                        <input
                          type="text"
                          value={customState}
                          onChange={(e) => setCustomState(e.target.value)}
                          placeholder="직책 직접 입력"
                          disabled={!isEditing}
                          style={{ marginTop: '8px' }}
                        />
                      )}
                    </div>

                    <div className="form-group">
                      <label>소재지</label>
                      <input
                        type="text"
                        value={editedStudent.address} // location -> address
                        onChange={(e) => handleInputChange('address', e.target.value)}
                        disabled={!isEditing}
                        onFocus={handleInputFocus}
                        placeholder="서울시 강남구, 경기도 성남시 등"
                      />
                    </div>

                    <div className="form-group full-width">
                      <label>경력</label>
                      {isEditing ? (
                        <div className="career-editor">
                          {editedStudent.career?.map((item, index) => (
                            <div key={index} className="form-group">
                              <div className="career-item">
                              <input
                                type="text"
                                placeholder="근무기간 (예: 2020-2023)"
                                value={item.period}
                                onChange={(e) => handleCareerChange(index, 'period', e.target.value)}
                              />
                              <input
                                type="text"
                                placeholder="회사명"
                                value={item.company}
                                onChange={(e) => handleCareerChange(index, 'company', e.target.value)}
                              />
                              <input
                                type="text"
                                placeholder="직책"
                                value={item.position}
                                onChange={(e) => handleCareerChange(index, 'position', e.target.value)}
                              />
                              <button type="button" className="remove-btn" onClick={() => removeCareerItem(index)}>-</button>
                            </div>
                          </div>
                          ))}
                          <button type="button" className="add-btn" onClick={addCareerItem}>+ 경력 추가</button>
                        </div>
                      ) : (
                        <div className="career-display">
                          {(editedStudent.career && editedStudent.career.length > 0) ? (
                            editedStudent.career.map((item, index) => (
                              <input
                                key={index}
                                type="text"
                                className="career-view-item"
                                value={`${item.period || ''}: ${item.company || ''} (${item.position || ''})`}
                                disabled
                              />
                            ))
                          ) : (
                            <input
                              type="text"
                              value="입력된 경력 정보가 없습니다."
                              disabled
                            />
                          )}
                        </div>
                      )}
                    </div>

                    <div className="form-group">
                      <label>업체명</label>
                      <input
                        type="text"
                        value={(editedStudent.council || '').split(' / ')[0] || ''}
                        onChange={(e) => {
                          const parts = (editedStudent.council || '').split(' / ');
                          const newCouncil = `${e.target.value} / ${parts[1] || ''} / ${parts[2] || ''}`;
                          handleInputChange('council', newCouncil);
                        }}
                        disabled={!isEditing}
                        onFocus={handleInputFocus}
                      />
                    </div>

                    <div className="form-group">
                      <label>대표자</label>
                      <input
                        type="text"
                        value={(editedStudent.council || '').split(' / ')[1] || ''}
                        onChange={(e) => {
                          const parts = (editedStudent.council || '').split(' / ');
                          const newCouncil = `${parts[0] || ''} / ${e.target.value} / ${parts[2] || ''}`;
                          handleInputChange('council', newCouncil);
                        }}
                        disabled={!isEditing}
                        onFocus={handleInputFocus}
                      />
                    </div>

                    <div className="form-group full-width">
                      <label>비고</label>
                      <input
                        type="text"
                        value={editedStudent.council?.split(' / ')[2] || ''}
                        onChange={(e) => {
                          const parts = editedStudent.council?.split(' / ') || ['', '', ''];
                          const newCouncil = `${parts[0] || ''} / ${parts[1] || ''} / ${e.target.value}`;
                          handleInputChange('council', newCouncil);
                        }}
                        disabled={!isEditing}
                        onFocus={handleInputFocus}
                        placeholder="추가 정보나 메모를 입력하세요"
                      />
                    </div>
                  </>
                ) : (
                  // 학생 필드들 (기존)
                  <>
                    <div className="form-group">
                      <label>학번<span style={{color: 'red'}}>*</span></label>
                      <input
                        type="text"
                        value={editedStudent.no_student}
                        onChange={(e) => handleInputChange('no_student', e.target.value)}
                        disabled={!isEditing}
                        onFocus={handleInputFocus}
                      />
                    </div>

                    <div className="form-group">
                      <label>이름<span style={{color: 'red'}}>*</span></label>
                      <input
                        type="text"
                        value={editedStudent.name}
                        onChange={(e) => handleInputChange('name', e.target.value)}
                        disabled={!isEditing}
                        onFocus={handleInputFocus}
                      />
                    </div>

                    <div className="form-group">
                      <label>연락처<span style={{color: 'red'}}>*</span></label>
                      <input
                        type="text"
                        value={editedStudent.phone_num}
                        onChange={(e) => {
                          const value = e.target.value;
                          const digitsOnly = value.replace(/\D/g, '');
                          let formattedValue = digitsOnly;

                          if (digitsOnly.length > 3 && digitsOnly.length <= 7) {
                            formattedValue = `${digitsOnly.slice(0, 3)}-${digitsOnly.slice(3)}`;
                          } else if (digitsOnly.length > 7) {
                            formattedValue = `${digitsOnly.slice(0, 3)}-${digitsOnly.slice(3, 7)}-${digitsOnly.slice(7, 11)}`;
                          }
                          
                          handleInputChange('phone_num', formattedValue);
                        }}
                        disabled={!isEditing}
                        onFocus={handleInputFocus}
                        placeholder="010-1234-5678"
                        maxLength={13}
                      />
                    </div>

                    <div className="form-group">
                      <label>학년<span style={{color: 'red'}}>*</span></label>
                      <select
                        value={editedStudent.grade}
                        onChange={(e) => handleInputChange('grade', e.target.value)}
                        disabled={!isEditing}
                        onFocus={handleInputFocus}
                      >
                        <option value="">선택하세요</option>
                        <option value="1">1학년</option>
                        <option value="2">2학년</option>
                        <option value="3">3학년</option>
                        <option value="4">4학년</option>
                      </select>
                    </div>

                    <div className="form-group">
                      <label>상태</label>
                      <select
                        value={isStateOther ? '직접 입력' : editedStudent.state}
                        onChange={(e) => {
                          if (e.target.value === '직접 입력') {
                            setIsStateOther(true);
                          } else {
                            setIsStateOther(false);
                            handleInputChange('state', e.target.value);
                          }
                        }}
                        disabled={!isEditing}
                        onFocus={handleInputFocus}
                      >
                        <option value="">선택하세요</option>
                        <option value="재학">재학</option>
                        <option value="휴학">휴학</option>
                        <option value="졸업">졸업</option>
                        <option value="자퇴">자퇴</option>
                        <option value="직접 입력">직접 입력</option>
                      </select>
                      {isStateOther && (
                        <input
                          type="text"
                          value={customState}
                          onChange={(e) => setCustomState(e.target.value)}
                          placeholder="상태 직접 입력"
                          disabled={!isEditing}
                          style={{ marginTop: '8px' }}
                        />
                      )}
                    </div>

                    <div className="form-group full-width">
                      <label>주소<span style={{color: 'red'}}>*</span></label>
                      <input
                        type="text"
                        value={editedStudent.address}
                        onChange={(e) => handleInputChange('address', e.target.value)}
                        disabled={!isEditing}
                        onFocus={handleInputFocus}
                        placeholder="주소를 입력하세요"
                      />
                    </div>

                    <div className="form-group full-width">
                      <label>학생회 직책</label>
                      <input
                        type="text"
                        value={editedStudent.council}
                        onChange={(e) => handleInputChange('council', e.target.value)}
                        disabled={!isEditing}
                        placeholder="예: 25 기획부장/24 총무부장"
                        onFocus={handleInputFocus}
                      />
                    </div>

                  </>
                )}
              </div>
            </div>
          )}

          {activeTab === 'issues' && (
            <div className="issues-section">
              <h3>특이사항 기록</h3>
              
              <div className="add-issue-form">
                <div className="form-row">
                <div className="form-group">
                  <label>발생일</label>
                  <input
                    type="date"
                    value={newIssue.date_issue}
                    onChange={(e) => handleIssueInputChange('date_issue', e.target.value)}
                    onFocus={handleInputFocus}
                    onMouseDown={(e) => e.preventDefault()}
                    onMouseUp={(e) => e.preventDefault()}
                  />
                </div>
                <div className="form-group">
                  <label>유형</label>
                  <select
                    value={isTypeOther ? '직접 입력' : newIssue.type_issue}
                    onChange={(e) => {
                      if (e.target.value === '직접 입력') {
                        setIsTypeOther(true);
                        handleIssueInputChange('type_issue', '');
                      } else {
                        setIsTypeOther(false);
                        handleIssueInputChange('type_issue', e.target.value);
                      }
                    }}
                    onFocus={handleInputFocus}
                  >
                    <option value="">선택하세요</option>
                    <option value="학업">학업</option>
                    <option value="출석">출석</option>
                    <option value="행동">행동</option>
                    <option value="기타">기타</option>
                    <option value="직접 입력">직접 입력</option>
                  </select>
                  {isTypeOther && (
                    <input
                      type="text"
                      value={customType}
                      onChange={(e) => setCustomType(e.target.value)}
                      placeholder="유형 직접 입력"
                      style={{ marginTop: '8px' }}
                    />
                  )}
                </div>
                <div className="form-group">
                  <label>주의도</label>
                  <select
                    value={isLevelOther ? '직접 입력' : newIssue.level_issue}
                    onChange={(e) => {
                      if (e.target.value === '직접 입력') {
                        setIsLevelOther(true);
                        handleIssueInputChange('level_issue', '');
                      } else {
                        setIsLevelOther(false);
                        handleIssueInputChange('level_issue', e.target.value);
                      }
                    }}
                    onFocus={handleInputFocus}
                  >
                    <option value="">선택하세요</option>
                    <option value="낮음">낮음</option>
                    <option value="보통">보통</option>
                    <option value="높음">높음</option>
                    <option value="심각">심각</option>
                    <option value="직접 입력">직접 입력</option>
                  </select>
                  {isLevelOther && (
                    <input
                      type="text"
                      value={customLevel}
                      onChange={(e) => setCustomLevel(e.target.value)}
                      placeholder="주의도 직접 입력"
                      style={{ marginTop: '8px' }}
                    />
                  )}
                </div>
                </div>
                <div className="form-group">
                  <label>내용</label>
                  <textarea
                    value={newIssue.content_issue}
                    onChange={(e) => handleIssueInputChange('content_issue', e.target.value)}
                    placeholder="특이사항 내용을 입력하세요..."
                    rows={3}
                    onFocus={handleInputFocus}
                  />
                </div>
                <div className="form-actions">
                  <button className="add-btn" onClick={handleAddIssue}>
                    특이사항 추가
                  </button>
                </div>
              </div>

              <div className="issues-list">
                <h4>기록된 특이사항 ({issues.length}건)</h4>
                {isLoading ? (
                  <div className="loading">특이사항을 불러오는 중...</div>
                ) : issues.length === 0 ? (
                  <div className="no-issues">기록된 특이사항이 없습니다.</div>
                ) : (
                  <div className="issues-grid">
                    {issues.map((issue) => (
                      <div key={issue.id} className="issue-card">
                        <div className="issue-header">
                          <span className="issue-date">{issue.date_issue}</span>
                          <span className={`issue-level ${issue.level_issue}`}>
                            {issue.level_issue}
                          </span>
                        </div>
                        <div className="issue-type">{issue.type_issue}</div>
                        <div className="issue-content">{issue.content_issue}</div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>
          )}

          {activeTab === 'employment' && (
            <div className="employment-section">
              <h3>취업관리</h3>
              {employmentLoading ? (
                <div className="loading">취업 정보를 불러오는 중...</div>
              ) : !employment ? (
                <div className="no-issues">등록된 취업 정보가 없습니다.</div>
              ) : (
                <>
                  <div className="form-group">
                    <label>취업 전</label>
                    <div className="employment-readonly">
                      <span>{employment.is_major ? '전공 취업' : '비전공 취업'}</span>
                      <span>
                        직종: {employment.field_num
                          ? (employmentFieldList.find(f => f.field_num === employment.field_num)?.field_name ?? employment.field_num)
                          : '-'}
                      </span>
                    </div>
                  </div>
                  <div className="form-group">
                    <label>회사명 (취업 후)</label>
                    <input
                      type="text"
                      value={employmentAfterEdit.com_name}
                      onChange={e => setEmploymentAfterEdit(prev => ({ ...prev, com_name: e.target.value }))}
                      placeholder="회사명"
                      className="form-input"
                    />
                  </div>
                  <div className="form-group">
                    <label>직종 (취업 후)</label>
                    <input
                      type="text"
                      value={employmentAfterEdit.occ_category}
                      onChange={e => setEmploymentAfterEdit(prev => ({ ...prev, occ_category: e.target.value }))}
                      placeholder="직종"
                      className="form-input"
                    />
                  </div>
                  <div className="form-group">
                    <label>질문 남기기</label>
                    <p className="employment-question-hint">각 질문과 내용을 입력한 뒤 저장하면 JSON으로 저장됩니다.</p>
                    {employmentQuestionEntries.map((entry, idx) => (
                      <div key={idx} className="employment-question-row">
                        <input
                          type="text"
                          value={entry.key}
                          onChange={e => updateEmploymentQuestionEntry(idx, 'key', e.target.value)}
                          placeholder="질문 제목"
                          className="form-input employment-question-key"
                        />
                        <input
                          type="text"
                          value={entry.value}
                          onChange={e => updateEmploymentQuestionEntry(idx, 'value', e.target.value)}
                          placeholder="내용"
                          className="form-input employment-question-value"
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
                  <div className="form-actions">
                    <button
                      type="button"
                      className="add-btn"
                      disabled={employmentSaving}
                      onClick={handleSaveEmploymentAfter}
                    >
                      {employmentSaving ? '저장 중...' : '취업 후 저장'}
                    </button>
                  </div>
                </>
              )}
            </div>
          )}
        </div>
              </div>
            </div>
          </>
        );};

export default StudentDetailModal;