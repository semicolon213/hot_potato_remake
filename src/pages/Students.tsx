import React, { useState, useMemo, useEffect } from 'react';
import { FaChevronLeft, FaChevronRight, FaPlus } from 'react-icons/fa';
import { useStudentManagement } from '../hooks/features/students/useStudentManagement';
import StudentDetailModal from '../components/ui/StudentDetailModal';
import {
  StudentHeader,
  StudentActionButtons,
  StudentList,
  CouncilSection
} from '../components/features/students';
import type { StudentWithCouncil } from '../types/features/students/student';
import type { EmploymentField } from '../types/features/students/employment';
import { apiClient } from '../utils/api/apiClient';
import '../styles/pages/Students.css';

interface StudentsProps {
  onPageChange: (pageName: string) => void;
  studentSpreadsheetId: string | null;
  initialTab?: 'list' | 'council' | 'grade_management';
  user?: {
    userType?: string;
    isAdmin?: boolean;
    email?: string;
  } | null;
}

const Students: React.FC<StudentsProps> = ({ studentSpreadsheetId, user, initialTab = 'list', onPageChange }) => {
  const isSupp = user?.userType === 'supp';
  const {
    students,
    filteredStudents,
    isLoading,
    error,
    searchTerm,
    setSearchTerm,
    filters,
    setFilters,
    sortConfig,
    handleSort,
    filterOptions,
    exportToCSV,
    downloadExcelTemplate,
    handleExcelUpload,
    getAllYears,
    addStudent, // 학생 추가 함수
    deleteStudent,
    getCouncilTableData,
    studentColumns,
    councilColumns,
    fetchStudents
  } = useStudentManagement(studentSpreadsheetId);

  const [activeTab, setActiveTab] = useState<'list' | 'council' | 'grade_management'>(initialTab);
  
  // initialTab이 변경되면 activeTab 업데이트
  useEffect(() => {
    if (initialTab !== activeTab) {
      setActiveTab(initialTab);
    }
  }, [initialTab, activeTab]);
  const [selectedYear, setSelectedYear] = useState<string>('');
  const [selectedStudent, setSelectedStudent] = useState<StudentWithCouncil | null>(null);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [isAddStudentModalOpen, setIsAddStudentModalOpen] = useState(false); // 학생 추가 모달 상태
  const [showFilters, setShowFilters] = useState(false);
  const [isFieldModalOpen, setIsFieldModalOpen] = useState(false);
  const [fieldList, setFieldList] = useState<EmploymentField[]>([]);
  const [fieldLoading, setFieldLoading] = useState(false);
  const [newFieldNum, setNewFieldNum] = useState('');
  const [newFieldName, setNewFieldName] = useState('');
  const [fieldSaving, setFieldSaving] = useState(false);
  const [editingFieldNum, setEditingFieldNum] = useState<string | null>(null);
  const [editingFieldName, setEditingFieldName] = useState('');
  // 학년 관리 (조교 전용)
  const [graduationGrade, setGraduationGradeState] = useState<number>(3);
  const [graduationGradeLoading, setGraduationGradeLoading] = useState(false);
  const [gradeUpdateConfirmOpen, setGradeUpdateConfirmOpen] = useState(false);
  const [gradeUpdateRunning, setGradeUpdateRunning] = useState(false);
  const [retainedSearchTerm, setRetainedSearchTerm] = useState('');
  const [retainedSaving, setRetainedSaving] = useState<string | null>(null);

  // URL 파라미터에서 필터 읽기
  useEffect(() => {
    const urlParams = new URLSearchParams(window.location.search);
    const stateParam = urlParams.get('state');
    const gradeParam = urlParams.get('grade');
    
    if (stateParam || gradeParam) {
      setFilters(prev => ({
        ...prev,
        ...(stateParam && { state: stateParam }),
        ...(gradeParam && { grade: gradeParam })
      }));
      // 필터가 있으면 필터 패널 열기
      setShowFilters(true);
    }
  }, [setFilters]);

  const years = getAllYears();
  
  // 년도별로 정렬 (최신년도부터)
  const sortedYears = useMemo(() => {
    return [...years].sort((a, b) => b.localeCompare(a));
  }, [years]);
  
  // 선택된 년도가 없으면 첫 번째 년도를 자동 선택
  useEffect(() => {
    if (sortedYears.length > 0 && !selectedYear && activeTab === 'council') {
      setSelectedYear(sortedYears[0]);
    }
  }, [sortedYears, selectedYear, activeTab]);

  // 학년 관리 탭: 졸업 학년 로드
  useEffect(() => {
    if (activeTab !== 'grade_management' || !studentSpreadsheetId) return;
    setGraduationGradeLoading(true);
    apiClient.getGraduationGrade(studentSpreadsheetId)
      .then((res) => {
        if (res.success && res.data != null) setGraduationGradeState(Number(res.data));
      })
      .finally(() => setGraduationGradeLoading(false));
  }, [activeTab, studentSpreadsheetId]);
  
  // 모든 학생회 데이터를 평탄화하여 가져오기
  const allCouncilData = useMemo(() => {
    const result = students.flatMap(student => {
      // parsedCouncil이 없거나 비어있으면 건너뛰기
      if (!student.parsedCouncil || student.parsedCouncil.length === 0) {
        return [];
      }
      
      return student.parsedCouncil
        .filter(council => council.year && council.position) // 년도와 직책이 모두 있는 것만
        .map(council => ({
          ...student,
          position: council.position,
          councilYear: council.year || ''
        }));
    });
    
    // 디버깅: 파싱 결과 확인
    console.log('📊 allCouncilData 생성:', {
      총학생수: students.length,
      총항목수: result.length,
      년도별분포: result.reduce((acc, item) => {
        const year = item.councilYear;
        acc[year] = (acc[year] || 0) + 1;
        return acc;
      }, {} as Record<string, number>)
    });
    
    return result;
  }, [students]);

  // 학생회 데이터 필터링 (년도별)
  const filteredCouncilData = useMemo(() => {
    let filtered = allCouncilData;
    if (selectedYear) {
      filtered = filtered.filter(item => {
        const matches = item.councilYear === selectedYear;
        if (!matches && item.councilYear) {
          // 디버깅: 필터링되지 않은 항목 확인
          console.log('⚠️ 필터링 제외:', {
            학생: item.name,
            학번: item.no_student,
            선택된년도: selectedYear,
            항목년도: item.councilYear,
            일치여부: item.councilYear === selectedYear
          });
        }
        return matches;
      });
    }
    
    // 디버깅: 필터링 결과 확인
    console.log('🔍 filteredCouncilData:', {
      선택된년도: selectedYear,
      필터링된항목수: filtered.length,
      학생목록: filtered.map(item => `${item.name}(${item.no_student}) - ${item.position}`)
    });
    
    return filtered;
  }, [allCouncilData, selectedYear]);
  
  // 년도별 학생 수 계산 (중복 제거: 같은 학생이 여러 직책을 가져도 1명으로 카운트)
  const getYearStudentCount = (year: string) => {
    const yearStudents = allCouncilData.filter(item => item.councilYear === year);
    // 학번(no_student) 기준으로 중복 제거하여 실제 학생 수 계산
    const uniqueStudents = new Set(yearStudents.map(item => item.no_student));
    return uniqueStudents.size;
  };

  // 학생 추가 핸들러
  const handleAddStudent = () => setIsAddStudentModalOpen(true);
  const handleAddStudentModalClose = () => setIsAddStudentModalOpen(false);
  const handleCreateStudent = (newStudentData: StudentWithCouncil) => {
    addStudent(newStudentData);
    setIsAddStudentModalOpen(false);
  };

  // Council 데이터용 정렬 함수
  const handleCouncilSort = (key: string) => {
    // council 데이터는 StudentWithCouncil과 다른 구조이므로 별도 처리
    console.log('Council sort:', key);
  };

  // 학생 더블클릭 핸들러
  const handleStudentDoubleClick = (student: StudentWithCouncil) => {
    setSelectedStudent(student);
    setIsModalOpen(true);
  };

  // 모달 닫기 핸들러
  const handleCloseModal = () => {
    setIsModalOpen(false);
    setSelectedStudent(null);
  };

  // 학생 정보 업데이트 핸들러
  const handleStudentUpdate = async () => {
    // 데이터 다시 로드
    if (studentSpreadsheetId) {
      await fetchStudents();
    }
    setIsModalOpen(false);
    setSelectedStudent(null);
  };

  const handleDeleteStudent = (studentToDelete: StudentWithCouncil) => {
    deleteStudent(studentToDelete.no_student);
  };

  const loadFieldList = async () => {
    if (!studentSpreadsheetId) return;
    setFieldLoading(true);
    try {
      const res = await apiClient.getFieldList(studentSpreadsheetId);
      if (res.success && res.data) setFieldList(res.data);
      else setFieldList([]);
    } catch (e) {
      console.error('직종 목록 로드 실패:', e);
      setFieldList([]);
    } finally {
      setFieldLoading(false);
    }
  };

  useEffect(() => {
    if (isFieldModalOpen && studentSpreadsheetId) loadFieldList();
  }, [isFieldModalOpen, studentSpreadsheetId]);

  const userEmail = (typeof window !== 'undefined' && (user as { email?: string })?.email) 
    ? (user as { email?: string }).email 
    : (typeof window !== 'undefined' ? JSON.parse(localStorage.getItem('user') || '{}').email : '');

  const handleCreateField = async () => {
    if (!studentSpreadsheetId || !userEmail || !newFieldNum.trim() || !newFieldName.trim()) return;
    setFieldSaving(true);
    try {
      const res = await apiClient.createField(studentSpreadsheetId, newFieldNum.trim(), newFieldName.trim(), userEmail);
      if (res.success) {
        setNewFieldNum('');
        setNewFieldName('');
        loadFieldList();
      } else alert(res.message || '추가에 실패했습니다.');
    } catch (e) {
      alert('추가에 실패했습니다.');
    } finally {
      setFieldSaving(false);
    }
  };

  const handleUpdateField = async (field_num: string) => {
    if (!studentSpreadsheetId || !userEmail) return;
    setFieldSaving(true);
    try {
      const res = await apiClient.updateField(studentSpreadsheetId, field_num, editingFieldName.trim(), userEmail);
      if (res.success) {
        setEditingFieldNum(null);
        setEditingFieldName('');
        loadFieldList();
      } else alert(res.message || '수정에 실패했습니다.');
    } catch (e) {
      alert('수정에 실패했습니다.');
    } finally {
      setFieldSaving(false);
    }
  };

  const handleDeleteField = async (field_num: string) => {
    if (!studentSpreadsheetId || !userEmail || !window.confirm(`직종 "${field_num}"을(를) 삭제하시겠습니까?`)) return;
    setFieldSaving(true);
    try {
      const res = await apiClient.deleteField(studentSpreadsheetId, field_num, userEmail);
      if (res.success) loadFieldList();
      else alert(res.message || '삭제에 실패했습니다.');
    } catch (e) {
      alert('삭제에 실패했습니다.');
    } finally {
      setFieldSaving(false);
    }
  };

  // 학년 관리: 졸업 학년 저장
  const handleSaveGraduationGrade = async () => {
    if (!studentSpreadsheetId || !userEmail) return;
    setGraduationGradeLoading(true);
    try {
      const res = await apiClient.setGraduationGrade(studentSpreadsheetId, graduationGrade, userEmail);
      if (res.success) {
        alert('졸업 학년이 저장되었습니다.');
      } else {
        alert(res.message || '저장에 실패했습니다.');
      }
    } catch (e) {
      alert('저장에 실패했습니다.');
    } finally {
      setGraduationGradeLoading(false);
    }
  };

  // 유급 추가
  const handleSetRetained = async (studentId: string, isRetained: boolean) => {
    if (!studentSpreadsheetId) return;
    setRetainedSaving(studentId);
    try {
      const res = await apiClient.request<{ success: boolean; message?: string }>('updateStudentRetained', {
        studentId,
        spreadsheetId: studentSpreadsheetId,
        isRetained
      });
      if (res.success) await fetchStudents();
      else alert(res.message || '변경에 실패했습니다.');
    } catch (e) {
      alert('변경에 실패했습니다.');
    } finally {
      setRetainedSaving(null);
    }
  };

  // 학년 갱신 실행 (확인 모달에서 완료 클릭 시)
  const handleRunGradeUpdate = async () => {
    if (!studentSpreadsheetId) return;
    setGradeUpdateRunning(true);
    try {
      const now = new Date();
      const year = now.getFullYear();
      const term = now.getMonth() + 1 <= 2 || now.getMonth() + 1 >= 9 ? '전기' : '후기'; // 대략 1~2,9~12 전기 / 나머지 후기
      const res = await apiClient.updateStudentGrades(studentSpreadsheetId, {
        graduationGrade,
        graduationYear: year,
        graduationTerm: term
      });
      if (res.success) {
        alert(res.message || '학년 갱신이 완료되었습니다.');
        setGradeUpdateConfirmOpen(false);
        await fetchStudents();
      } else {
        alert(res.message || '학년 갱신에 실패했습니다.');
      }
    } catch (e) {
      alert('학년 갱신에 실패했습니다.');
    } finally {
      setGradeUpdateRunning(false);
    }
  };

  const retainedList = useMemo(() => {
    return students.filter(s => {
      const f = s.flunk;
      return f && (String(f).trim().toUpperCase() === 'O' || String(f).trim() === 'TRUE' || String(f).trim() === '1');
    });
  }, [students]);
  const searchForRetained = useMemo(() => {
    if (!retainedSearchTerm.trim()) return [];
    const term = retainedSearchTerm.trim().toLowerCase();
    return students.filter(s =>
      s.name.toLowerCase().includes(term) ||
      String(s.no_student).toLowerCase().includes(term)
    ).slice(0, 20);
  }, [students, retainedSearchTerm]);

  if (error) {
    return (
      <div className="students-container">
        <div className="error">오류: {error}</div>
      </div>
    );
  }

  return (
    <div className="students-container">
      <StudentHeader
        totalStudents={students.length}
        filteredStudents={filteredStudents.length}
        activeTab={activeTab}
        onTabChange={setActiveTab}
      />

      {activeTab === 'list' && (
        <div className="students-list">
          <div className="action-buttons-container">
            <div className="action-left">
              <StudentActionButtons
                onExportCSV={exportToCSV}
                onDownloadTemplate={downloadExcelTemplate}
                onFileUpload={handleExcelUpload}
                filteredCount={filteredStudents.length}
                totalCount={students.length}
              />
            </div>
            <div className="action-right">
              {user?.isAdmin && (
                <button
                  type="button"
                  className="student-add-button field-management-btn"
                  onClick={() => setIsFieldModalOpen(true)}
                  title="직종 분야 관리"
                >
                  <span className="add-button-text">직종 분야 관리</span>
                </button>
              )}
              <button 
                className="student-add-button"
                onClick={handleAddStudent}
                title="학생 추가"
              >
                <FaPlus className="add-icon" />
                <span className="add-button-text">학생 추가</span>
              </button>
            </div>
          </div>

          <StudentList
            students={students}
            columns={studentColumns}
            sortConfig={sortConfig}
            onSort={(key: string) => handleSort(key as keyof StudentWithCouncil)}
            onStudentDoubleClick={handleStudentDoubleClick}
            onAddStudent={handleAddStudent} // 학생 추가 버튼 핸들러 전달
          />
        </div>
      )}

      {activeTab === 'grade_management' && (
        <div className="students-list grade-management-section">
          {!isSupp ? (
            <div className="grade-management-forbidden">
              <p>학년 관리 메뉴는 조교 권한이 있는 사용자만 이용할 수 있습니다.</p>
            </div>
          ) : (
            <>
              <div className="grade-management-block">
                <h3>졸업 학년 설정</h3>
                <p className="grade-management-desc">전문대 2·3학년, 전공심화 등에 따라 졸업 학년을 선택하세요.</p>
                <div className="grade-management-row">
                  <label>졸업 학년</label>
                  <select
                    value={graduationGrade}
                    onChange={(e) => setGraduationGradeState(Number(e.target.value))}
                    disabled={graduationGradeLoading}
                  >
                    {[2, 3, 4, 5, 6].map((g) => (
                      <option key={g} value={g}>{g}학년</option>
                    ))}
                  </select>
                  <button
                    type="button"
                    className="student-add-button"
                    disabled={graduationGradeLoading}
                    onClick={handleSaveGraduationGrade}
                  >
                    {graduationGradeLoading ? '저장 중...' : '저장'}
                  </button>
                </div>
              </div>
              <div className="grade-management-block">
                <h3>유급 대상</h3>
                <p className="grade-management-desc">유급 대상은 학년 갱신 시 학년이 올라가지 않습니다. 학생을 검색해 추가/제거하세요.</p>
                <div className="retained-search-row">
                  <input
                    type="text"
                    placeholder="이름 또는 학번으로 검색"
                    value={retainedSearchTerm}
                    onChange={(e) => setRetainedSearchTerm(e.target.value)}
                    className="search-input"
                  />
                </div>
                {retainedSearchTerm.trim() && (
                  <div className="retained-search-results">
                    <span className="retained-search-label">검색 결과 (유급 추가)</span>
                    <ul>
                      {searchForRetained.map((s) => {
                        const isRetained = retainedList.some(r => r.no_student === s.no_student);
                        return (
                          <li key={s.no_student}>
                            {s.name} ({s.no_student}) {s.grade}학년 · {s.state}
                            {isRetained ? (
                              <span className="retained-badge">유급</span>
                            ) : (
                              <button
                                type="button"
                                className="retained-add-btn"
                                disabled={retainedSaving === s.no_student}
                                onClick={() => handleSetRetained(s.no_student, true)}
                              >
                                {retainedSaving === s.no_student ? '처리 중...' : '유급 추가'}
                              </button>
                            )}
                          </li>
                        );
                      })}
                    </ul>
                  </div>
                )}
                <div className="retained-list-wrap">
                  <span className="retained-list-label">현재 유급 대상 ({retainedList.length}명)</span>
                  <table className="field-table">
                    <thead>
                      <tr>
                        <th>학번</th>
                        <th>이름</th>
                        <th>학년</th>
                        <th>상태</th>
                        <th></th>
                      </tr>
                    </thead>
                    <tbody>
                      {retainedList.length === 0 ? (
                        <tr><td colSpan={5}>유급 대상이 없습니다.</td></tr>
                      ) : (
                        retainedList.map((s) => (
                          <tr key={s.no_student}>
                            <td>{s.no_student}</td>
                            <td>{s.name}</td>
                            <td>{s.grade}</td>
                            <td>{s.state}</td>
                            <td>
                              <button
                                type="button"
                                className="field-cancel-btn"
                                disabled={retainedSaving === s.no_student}
                                onClick={() => handleSetRetained(s.no_student, false)}
                              >
                                {retainedSaving === s.no_student ? '처리 중...' : '제거'}
                              </button>
                            </td>
                          </tr>
                        ))
                      )}
                    </tbody>
                  </table>
                </div>
              </div>
              <div className="grade-management-block">
                <h3>학년 갱신</h3>
                <p className="grade-management-desc">재학생(휴학·유급·자퇴 제외)의 학년을 1씩 올리고, 졸업 학년을 넘긴 학생은 졸업 처리합니다. 유급 대상은 위 목록에서 최종 확인 후 진행하세요.</p>
                <button
                  type="button"
                  className="student-add-button grade-update-btn"
                  onClick={() => setGradeUpdateConfirmOpen(true)}
                >
                  학년 갱신 실행
                </button>
              </div>
              {gradeUpdateConfirmOpen && (
                <div className="field-modal-overlay" onClick={() => !gradeUpdateRunning && setGradeUpdateConfirmOpen(false)}>
                  <div className="field-modal grade-confirm-modal" onClick={e => e.stopPropagation()}>
                    <div className="field-modal-header">
                      <h3>학년 갱신 확인</h3>
                      <button type="button" className="field-modal-close" onClick={() => !gradeUpdateRunning && setGradeUpdateConfirmOpen(false)}>×</button>
                    </div>
                    <div className="field-modal-body">
                      <p>아래 유급 대상은 학년이 올라가지 않습니다. 재학생만 학년이 +1 되며, 졸업 학년({graduationGrade}학년)을 넘긴 학생은 졸업 처리됩니다.</p>
                      <div className="retained-list-wrap">
                        <strong>유급 대상 ({retainedList.length}명)</strong>
                        <ul className="retained-confirm-list">
                          {retainedList.length === 0 ? (
                            <li>없음</li>
                          ) : (
                            retainedList.map((s) => (
                              <li key={s.no_student}>{s.name} ({s.no_student}) {s.grade}학년</li>
                            ))
                          )}
                        </ul>
                      </div>
                      <div className="grade-confirm-actions">
                        <button type="button" className="field-cancel-btn" disabled={gradeUpdateRunning} onClick={() => setGradeUpdateConfirmOpen(false)}>취소</button>
                        <button type="button" className="field-save-btn" disabled={gradeUpdateRunning} onClick={handleRunGradeUpdate}>
                          {gradeUpdateRunning ? '처리 중...' : '완료'}
                        </button>
                      </div>
                    </div>
                  </div>
                </div>
              )}
            </>
          )}
        </div>
      )}

      {activeTab === 'council' && (
        <div className="students-list">
          <div className="action-buttons-container">
            <div className="action-left">
              <StudentActionButtons
                onExportCSV={exportToCSV}
                onDownloadTemplate={downloadExcelTemplate}
                onFileUpload={handleExcelUpload}
                filteredCount={filteredCouncilData.length}
                totalCount={allCouncilData.length}
              />
            </div>
            {sortedYears.length > 0 && (
              <div className="action-right">
                <div className="council-year-navigation">
                  <button
                    className="council-year-nav-btn"
                    onClick={() => {
                      const currentIndex = sortedYears.findIndex(y => y === selectedYear);
                      if (currentIndex > 0) {
                        setSelectedYear(sortedYears[currentIndex - 1]);
                      }
                    }}
                    disabled={sortedYears.findIndex(y => y === selectedYear) === 0}
                    title="이전 년도"
                  >
                    <FaChevronLeft />
                  </button>
                  {selectedYear && (
                    <div className="council-year-display">
                      <span className="council-year-text">
                        {selectedYear}년 ({getYearStudentCount(selectedYear)})
                      </span>
                    </div>
                  )}
                  <button
                    className="council-year-nav-btn"
                    onClick={() => {
                      const currentIndex = sortedYears.findIndex(y => y === selectedYear);
                      if (currentIndex < sortedYears.length - 1) {
                        setSelectedYear(sortedYears[currentIndex + 1]);
                      }
                    }}
                    disabled={sortedYears.findIndex(y => y === selectedYear) === sortedYears.length - 1}
                    title="다음 년도"
                  >
                    <FaChevronRight />
                  </button>
                </div>
              </div>
            )}
          </div>

          <StudentList
            students={filteredCouncilData}
            columns={councilColumns}
            sortConfig={sortConfig}
            onSort={(key: string) => handleSort(key as keyof StudentWithCouncil)}
            onStudentDoubleClick={handleStudentDoubleClick}
          />
        </div>
      )}

      {/* 학생 상세 정보 모달 */}
      <StudentDetailModal
        student={selectedStudent}
        isOpen={isModalOpen}
        onClose={handleCloseModal}
        onUpdate={handleStudentUpdate}
        onDelete={handleDeleteStudent}
        studentSpreadsheetId={studentSpreadsheetId}
        user={user}
      />

      {/* 학생 추가 모달 */}
      <StudentDetailModal
        student={null}
        isOpen={isAddStudentModalOpen}
        onClose={handleAddStudentModalClose}
        onUpdate={handleCreateStudent}
        studentSpreadsheetId={studentSpreadsheetId}
        mode="student"
        isAdding={true}
        user={user}
      />

      {/* 직종 분야 관리 모달 (관리자 전용) */}
      {isFieldModalOpen && (
        <div className="field-modal-overlay" onClick={() => setIsFieldModalOpen(false)}>
          <div className="field-modal" onClick={e => e.stopPropagation()}>
            <div className="field-modal-header">
              <h3>직종 분야 관리</h3>
              <button type="button" className="field-modal-close" onClick={() => setIsFieldModalOpen(false)}>×</button>
            </div>
            <div className="field-modal-body">
              <div className="field-add-form">
                <input
                  type="text"
                  placeholder="분야 번호"
                  value={newFieldNum}
                  onChange={e => setNewFieldNum(e.target.value)}
                  className="field-input"
                />
                <input
                  type="text"
                  placeholder="분야 이름"
                  value={newFieldName}
                  onChange={e => setNewFieldName(e.target.value)}
                  className="field-input"
                />
                <button
                  type="button"
                  className="field-add-btn"
                  disabled={fieldSaving || !newFieldNum.trim() || !newFieldName.trim()}
                  onClick={handleCreateField}
                >
                  {fieldSaving ? '처리 중...' : '추가'}
                </button>
              </div>
              {fieldLoading ? (
                <div className="field-loading">불러오는 중...</div>
              ) : (
                <table className="field-table">
                  <thead>
                    <tr>
                      <th>분야 번호</th>
                      <th>분야 이름</th>
                      <th></th>
                    </tr>
                  </thead>
                  <tbody>
                    {fieldList.map(f => (
                      <tr key={f.field_num}>
                        <td>{f.field_num}</td>
                        <td>
                          {editingFieldNum === f.field_num ? (
                            <input
                              type="text"
                              value={editingFieldName}
                              onChange={e => setEditingFieldName(e.target.value)}
                              className="field-input-inline"
                            />
                          ) : (
                            f.field_name
                          )}
                        </td>
                        <td className="field-actions">
                          {editingFieldNum === f.field_num ? (
                            <>
                              <button type="button" className="field-save-btn" disabled={fieldSaving} onClick={() => handleUpdateField(f.field_num)}>저장</button>
                              <button type="button" className="field-cancel-btn" onClick={() => { setEditingFieldNum(null); setEditingFieldName(''); }}>취소</button>
                            </>
                          ) : (
                            <>
                              <button type="button" className="field-edit-btn" onClick={() => { setEditingFieldNum(f.field_num); setEditingFieldName(f.field_name); }}>수정</button>
                              <button type="button" className="field-delete-btn" disabled={fieldSaving} onClick={() => handleDeleteField(f.field_num)}>삭제</button>
                            </>
                          )}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default Students;