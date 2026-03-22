/**
 * @file useStudentManagement.ts
 * @brief 학생 관리 훅
 * @details 학생 목록, 검색, 필터링, 정렬 기능을 관리하는 커스텀 훅입니다.
 * @author Hot Potato Team
 * @date 2024
 */

import { useState, useEffect, useMemo } from 'react';
import {
  fetchStudents as fetchStudentsFromPapyrus,
  deleteStudent as deleteStudentFromPapyrus,
  updateStudent as updateStudentFromPapyrus
} from '../../../utils/database/papyrusManager';
import { apiClient } from '../../../utils/api/apiClient';
import type { Student, StudentWithCouncil, CouncilPosition } from '../../../types/features/students/student';
import { notifyGlobal } from '../../../utils/ui/globalNotification';

/**
 * @brief 학생 관리 커스텀 훅
 * @details 학생 목록을 가져오고, 검색, 필터링, 정렬 기능을 제공합니다.
 * @param {string | null} studentSpreadsheetId - 학생 데이터가 있는 스프레드시트 ID
 * @returns {Object} 학생 관리 관련 상태와 핸들러 함수들
 */
export const useStudentManagement = (studentSpreadsheetId: string | null) => {
  const [students, setStudents] = useState<StudentWithCouncil[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  
  // 필터 및 검색 상태
  const [searchTerm, setSearchTerm] = useState('');
  const [filters, setFilters] = useState({
    grade: '',
    state: '',
    council: ''
  });
  const [sortConfig, setSortConfig] = useState<{
    key: keyof StudentWithCouncil | null;
    direction: 'asc' | 'desc';
  }>({ key: null, direction: 'asc' });

  // council 필드를 파싱하는 함수
  // 실제 데이터 형식: "24 기획부장/25 학생장" (2자리 년도 + 공백 + 직책, 여러 항목은 "/"로 구분)
  const parseCouncil = (council: string): CouncilPosition[] => {
    if (!council || council.trim() === '') return [];
    
    // "/"로 구분하여 각 항목 처리
    return council.split('/').map(item => {
      const trimmed = item.trim();
      if (!trimmed) return { year: '', position: '' };
      
      // 실제 형식: "24 기획부장" 또는 "25 학생장"
      // 패턴: 숫자(년도) + 공백 + 직책명
      
      // "년"이 포함된 경우: "24년 기획부장" 또는 "2024년 기획부장"
      let match = trimmed.match(/^(\d+)\s*년\s+(.+)$/);
      if (match) {
        const year = match[1];
        // 2자리 년도는 2000년대로 가정 (24 -> 2024, 25 -> 2025)
        const fullYear = year.length === 2 ? `20${year}` : year;
        return {
          year: fullYear,
          position: match[2].trim()
        };
      }
      
      // 공백으로 구분된 경우: "24 기획부장" 또는 "2024 기획부장"
      // 정규식: 숫자로 시작 + 하나 이상의 공백 + 나머지(직책)
      match = trimmed.match(/^(\d+)\s+(.+)$/);
      if (match) {
        const year = match[1];
        // 2자리 년도는 2000년대로 가정 (24 -> 2024, 25 -> 2025)
        const fullYear = year.length === 2 ? `20${year}` : year;
        return {
          year: fullYear,
          position: match[2].trim()
        };
      }
      
      // 년도 없이 직책만 있는 경우: "기획부장"
      return {
        year: '',
        position: trimmed
      };
    }).filter(item => item.position !== ''); // 빈 항목 제거
  };

  // 전화번호 복호화 함수
  const decryptPhone = async (encryptedPhone: string): Promise<string> => {
    if (!encryptedPhone || encryptedPhone.trim() === '') {
      return encryptedPhone;
    }

    // 이미 복호화된 전화번호인지 확인 (010-XXXX-XXXX 형식)
    if (/^010-\d{4}-\d{4}$/.test(encryptedPhone)) {
      return encryptedPhone;
    }

    try {
      const result = await apiClient.request<string>('decryptEmail', { data: encryptedPhone });
      console.log('전화번호 복호화 성공:', result);
      return result.success && result.data ? result.data : encryptedPhone;
    } catch (error) {
      console.error('전화번호 복호화 실패:', error);
      return encryptedPhone;
    }
  };

  // Papyrus DB에서 학생 데이터 가져오기
  const fetchStudents = async () => {
    setIsLoading(true);
    setError(null);
    
    try {
      console.log('학생 데이터 가져오기 시작...');
      console.log('studentSpreadsheetId:', studentSpreadsheetId);
      const studentsData = await fetchStudentsFromPapyrus(studentSpreadsheetId!);
      console.log('Papyrus DB에서 받은 학생 데이터:', studentsData);
      
      if (studentsData && studentsData.length > 0) {
        // fetchStudentsFromPapyrus에서 이미 복호화된 데이터를 반환하므로 복호화 불필요
        const studentData: StudentWithCouncil[] = studentsData.map((student: Student) => {
          const parsed = parseCouncil(student.council);
          // 디버깅: 파싱 결과 확인
          if (student.council && parsed.length === 0) {
            console.warn('⚠️ 학생회 파싱 실패:', {
              학생: student.name,
              학번: student.no_student,
              원본데이터: student.council,
              파싱결과: parsed
            });
          }
          return {
            ...student,
            parsedCouncil: parsed
          };
        });

        setStudents(studentData);
        console.log(`학생 ${studentData.length}명 데이터 로드 완료 (이미 복호화된 데이터)`);
        
        // 디버깅: 전체 파싱 결과 요약
        const totalCouncilItems = studentData.reduce((sum, s) => sum + s.parsedCouncil.length, 0);
        const studentsWithCouncil = studentData.filter(s => s.parsedCouncil.length > 0).length;
        console.log('📊 학생회 데이터 파싱 요약:', {
          총학생수: studentData.length,
          학생회있는학생수: studentsWithCouncil,
          총학생회항목수: totalCouncilItems,
          년도별분포: studentData.reduce((acc, student) => {
            student.parsedCouncil.forEach(council => {
              if (council.year) {
                acc[council.year] = (acc[council.year] || 0) + 1;
              }
            });
            return acc;
          }, {} as Record<string, number>)
        });
      } else {
        console.log('학생 데이터가 없습니다.');
        setStudents([]);
      }
    } catch (err) {
      console.error('학생 데이터 가져오기 실패:', err);
      setError('학생 데이터를 가져오는데 실패했습니다.');
    } finally {
      setIsLoading(false);
    }
  };

  // 컴포넌트 마운트 시 학생 데이터 로드
  useEffect(() => {
    if (studentSpreadsheetId) {
      console.log('useStudentManagement: studentSpreadsheetId가 있으므로 학생 데이터 로드 시작');
      fetchStudents();
    } else {
      console.log('useStudentManagement: studentSpreadsheetId가 없음');
    }
  }, [studentSpreadsheetId]);

  // 년도별 학생회 데이터 가져오기
  const getCouncilByYear = (year: string) => {
    return students.filter(student => 
      student.parsedCouncil.some(council => council.year === year)
    );
  };

  // 모든 년도 목록 가져오기
  const getAllYears = () => {
    const years = new Set<string>();
    students.forEach(student => {
      student.parsedCouncil.forEach(council => {
        if (council.year) {
          years.add(council.year);
        }
      });
    });
    return Array.from(years).sort((a, b) => b.localeCompare(a)); // 최신년도부터
  };

  // 학생 목록 컬럼 정의
  const studentColumns = [
    { key: 'no_student' as const, header: '학번', width: '12%' },
    { key: 'name' as const, header: '이름', width: '15%' },
    { key: 'address' as const, header: '주소', width: '19%' },
    { key: 'phone_num' as const, header: '연락처', width: '15%' },
    { key: 'grade' as const, header: '학년', width: '8%' },
    { key: 'state' as const, header: '상태', width: '8%' },
    { 
      key: 'council' as const, 
      header: '학생회', 
      width: '21%'
    }
  ];

  // 학생회 테이블 컬럼 정의
  const councilColumns = [
    { key: 'name' as const, header: '이름', width: '20%' },
    { key: 'no_student' as const, header: '학번', width: '15%' },
    { key: 'grade' as const, header: '학년', width: '10%' },
    { key: 'position' as const, header: '직책', width: '25%' },
    { key: 'state' as const, header: '상태', width: '10%' },
    { key: 'address' as const, header: '주소', width: '20%' }
  ];

  // 특정 년도의 학생회 데이터를 테이블용으로 변환
  const getCouncilTableData = (year: string) => {
    const councilStudents = getCouncilByYear(year);
    return councilStudents.flatMap(student => 
      student.parsedCouncil
        .filter(council => council.year === year)
        .map(council => ({
          ...student,
          position: council.position
        }))
    );
  };

  // 필터링된 학생 목록
  const filteredStudents = useMemo(() => {
    let filtered = students;

    // 검색어 필터링
    if (searchTerm) {
      const term = searchTerm.toLowerCase();
      filtered = filtered.filter(student => 
        student.name.toLowerCase().includes(term) ||
        student.no_student.toLowerCase().includes(term) ||
        student.address.toLowerCase().includes(term) ||
        student.parsedCouncil.some(council => 
          council.position.toLowerCase().includes(term)
        )
      );
    }

    // 필드별 필터링
    if (filters.grade) {
      filtered = filtered.filter(student => student.grade.includes(filters.grade));
    }
    if (filters.state) {
      filtered = filtered.filter(student => student.state === filters.state);
    }
    if (filters.council) {
      filtered = filtered.filter(student => 
        student.parsedCouncil.some(council => 
          council.position.toLowerCase().includes(filters.council.toLowerCase())
        )
      );
    }

    // 정렬
    if (sortConfig.key) {
      filtered.sort((a, b) => {
        const aValue = a[sortConfig.key!];
        const bValue = b[sortConfig.key!];
        
        if (aValue < bValue) return sortConfig.direction === 'asc' ? -1 : 1;
        if (aValue > bValue) return sortConfig.direction === 'asc' ? 1 : -1;
        return 0;
      });
    }

    return filtered;
  }, [students, searchTerm, filters, sortConfig]);

  // 정렬 함수
  const handleSort = (key: keyof StudentWithCouncil) => {
    setSortConfig(prev => ({
      key,
      direction: prev.key === key && prev.direction === 'asc' ? 'desc' : 'asc'
    }));
  };

  // 필터 옵션들
  const filterOptions = useMemo(() => {
    const grades = [...new Set(students.map(s => s.grade))].filter(Boolean);
    const states = [...new Set(students.map(s => s.state))].filter(Boolean);
    const councilPositions = [...new Set(
      students.flatMap(s => s.parsedCouncil.map(c => c.position))
    )].filter(Boolean);

    return { grades, states, councilPositions };
  }, [students]);

  // CSV 내보내기
  const exportToCSV = () => {
    const headers = ['학번', '이름', '주소', '학년', '상태', '학생회'];
    const csvContent = [
      headers.join(','),
      ...filteredStudents.map(student => [
        student.no_student,
        student.name,
        student.address,
        student.grade,
        student.state,
        student.parsedCouncil.map(c => `${c.year}년 ${c.position}`).join(', ')
      ].join(','))
    ].join('\n');

    const blob = new Blob(['\uFEFF' + csvContent], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement('a');
    link.href = URL.createObjectURL(blob);
    link.download = `학생목록_${new Date().toISOString().split('T')[0]}.csv`;
    link.click();
  };

  // 엑셀 양식 다운로드
  const downloadExcelTemplate = async () => {
    try {
      const XLSX = await import('xlsx');
      const templateData = [
        ['학번', '이름', '주소', '연락처', '학년', '상태', '학생회'],
        ['202400001', '홍길동', '서울특별시 강남구', '010-1234-5678', '1', '재학', '25 기획부장'],
        ['202400002', '김철수', '경기도 수원시', '010-2345-6789', '2', '재학', '25 총무부장'],
        ['202400003', '이영희', '인천광역시', '010-3456-7890', '3', '휴학', '']
      ];

      const ws = XLSX.utils.aoa_to_sheet(templateData);
      const wb = XLSX.utils.book_new();
      XLSX.utils.book_append_sheet(wb, ws, '학생 목록');
      XLSX.writeFile(wb, `학생일괄입력_양식_${new Date().toISOString().split('T')[0]}.xlsx`);
    } catch (error) {
      console.error('양식 다운로드 실패:', error);
      notifyGlobal('양식 다운로드에 실패했습니다.', 'error');
    }
  };

  // 엑셀 파일 업로드 및 중복 검증
  const handleExcelUpload = async (file: File): Promise<void> => {
    return new Promise((resolve, reject) => {
      const fileName = file.name.toLowerCase();
      const isExcel = fileName.endsWith('.xlsx') || fileName.endsWith('.xls');
      const isCSV = fileName.endsWith('.csv');

      if (!isExcel && !isCSV) {
        reject(new Error('CSV 또는 Excel 파일(.xlsx, .xls)만 업로드 가능합니다.'));
        return;
      }

      const reader = new FileReader();
      reader.onload = async (e) => {
        try {
          let rows: string[][] = [];

          if (isExcel) {
            // Excel 파일 파싱
            const XLSX = await import('xlsx');
            const data = e.target?.result;
            const workbook = XLSX.read(data, { type: 'binary' });
            const firstSheetName = workbook.SheetNames[0];
            const worksheet = workbook.Sheets[firstSheetName];
            rows = XLSX.utils.sheet_to_json(worksheet, { header: 1 }) as string[][];
          } else {
            // CSV 파일 파싱
            const data = e.target?.result as string;
            const lines = data.split('\n').filter(line => line.trim());
            rows = lines.map(line => {
              // CSV 파싱 (쉼표로 구분, 따옴표 처리)
              const values: string[] = [];
              let current = '';
              let inQuotes = false;
              for (let i = 0; i < line.length; i++) {
                const char = line[i];
                if (char === '"') {
                  inQuotes = !inQuotes;
                } else if (char === ',' && !inQuotes) {
                  values.push(current.trim());
                  current = '';
                } else {
                  current += char;
                }
              }
              values.push(current.trim());
              return values;
            });
          }

          if (rows.length < 2) {
            reject(new Error('파일에 데이터가 없습니다.'));
            return;
          }

          const newStudents: StudentWithCouncil[] = [];
          const duplicates: string[] = [];
          const errors: string[] = [];

          // 헤더 행 건너뛰기 (첫 번째 행)
          for (let i = 1; i < rows.length; i++) {
            const row = rows[i];
            if (!row || row.length === 0 || row.every(cell => !cell || cell.trim() === '')) {
              continue; // 빈 행 건너뛰기
            }

            const student: Student = {
              no_student: (row[0] || '').toString().trim(),
              name: (row[1] || '').toString().trim(),
              address: (row[2] || '').toString().trim(),
              phone_num: (row[3] || '').toString().trim(),
              grade: (row[4] || '').toString().trim(),
              state: (row[5] || '').toString().trim(),
              council: (row[6] || '').toString().trim()
            };

            // 필수 필드 검증
            if (!student.no_student || !student.name) {
              errors.push(`${i + 1}행: 학번과 이름은 필수입니다.`);
              continue;
            }

            // 중복 검증 (학번 기준)
            if (students.some(s => s.no_student === student.no_student)) {
              duplicates.push(student.no_student);
              continue;
            }

            newStudents.push({
              ...student,
              parsedCouncil: parseCouncil(student.council)
            });
          }

          if (errors.length > 0) {
            notifyGlobal(`오류가 발생했습니다:\n${errors.join('\n')}`, 'error', 5000);
          }

          if (duplicates.length > 0) {
            notifyGlobal(`중복된 학번이 발견되었습니다: ${duplicates.join(', ')}`, 'warning', 5000);
          }

          // Google Sheets에 추가
          if (newStudents.length > 0 && studentSpreadsheetId) {
            const values = newStudents.map(student => [
              student.no_student,
              student.name,
              student.address,
              student.phone_num || '',
              student.grade,
              student.state,
              student.council
            ]);

            await window.gapi.client.sheets.spreadsheets.values.append({
              spreadsheetId: studentSpreadsheetId,
              range: 'A:G',
              valueInputOption: 'RAW',
              insertDataOption: 'INSERT_ROWS',
              resource: { values }
            });

            // 로컬 상태 업데이트
            setStudents(prev => [...prev, ...newStudents]);
            notifyGlobal(`${newStudents.length}명의 학생이 추가되었습니다.`, 'success');
            
            // 데이터 새로고침
            await fetchStudents();
          } else if (newStudents.length === 0) {
            notifyGlobal('추가할 학생이 없습니다.', 'warning');
          }

          resolve();
        } catch (error) {
          console.error('파일 업로드 오류:', error);
          reject(error);
        }
      };

      if (isExcel) {
        reader.readAsBinaryString(file);
      } else {
        reader.readAsText(file, 'UTF-8');
      }
    });
  };

  /** 연락처 암호화 (Apps Script encryptEmail API) - 저장 시 사용, apiClient 통해 프록시 경유 */
  const encryptForSave = async (plain: string): Promise<string> => {
    if (!plain || !plain.trim()) return plain;
    if (/^010-\d{4}-\d{4}$/.test(plain)) {
      try {
        const res = await apiClient.request<string>('encryptEmail', { data: plain });
        return res.success && res.data ? res.data : plain;
      } catch {
        return plain;
      }
    }
    return plain;
  };

  // 학생 추가 함수 (전화번호 암호화 후 저장)
  const addStudent = async (newStudent: StudentWithCouncil) => {
    if (!studentSpreadsheetId) return;

    try {
      // 중복 검증 (학번 기준)
      if (students.some(s => s.no_student === newStudent.no_student)) {
        notifyGlobal(`이미 존재하는 학번입니다: ${newStudent.no_student}`, 'warning');
        return;
      }

      const phoneToSave = await encryptForSave(newStudent.phone_num || '');

      const values = [
        [
          newStudent.no_student,
          newStudent.name,
          newStudent.address,
          phoneToSave,
          newStudent.grade,
          newStudent.state,
          newStudent.council
        ]
      ];

      await window.gapi.client.sheets.spreadsheets.values.append({
        spreadsheetId: studentSpreadsheetId,
        range: 'A:G',
        valueInputOption: 'RAW',
        insertDataOption: 'INSERT_ROWS',
        resource: { values }
      });

      // 로컬 상태 업데이트 (화면에는 복호화된 번호 유지)
      setStudents(prev => [...prev, newStudent]);
      notifyGlobal('학생이 성공적으로 추가되었습니다.', 'success');

    } catch (error) {
      console.error('학생 추가 실패:', error);
      notifyGlobal('학생 추가에 실패했습니다.', 'error');
    }
  };

  const deleteStudent = async (studentNo: string) => {
    if (!studentSpreadsheetId) return;

    try {
      await deleteStudentFromPapyrus(studentSpreadsheetId, studentNo);
      setStudents(prev => prev.filter(s => s.no_student !== studentNo));
      notifyGlobal('학생이 성공적으로 삭제되었습니다.', 'success');
    } catch (error) {
      console.error('학생 삭제 실패:', error);
      notifyGlobal('학생 삭제에 실패했습니다.', 'error');
    }
  };

  const updateStudent = async (originalStudentNo: string, updatedStudent: StudentWithCouncil): Promise<boolean> => {
    if (!studentSpreadsheetId) return false;

    try {
      await updateStudentFromPapyrus(studentSpreadsheetId, originalStudentNo, updatedStudent);

      // 즉시 UI 반영 (새로고침 전에도 변경값 표시)
      setStudents(prev =>
        prev.map((s) =>
          s.no_student === originalStudentNo
            ? {
                ...updatedStudent,
                parsedCouncil: parseCouncil(updatedStudent.council)
              }
            : s
        )
      );

      return true;
    } catch (error) {
      console.error('학생 정보 업데이트 실패:', error);
      return false;
    }
  };

  const setStudentRetainedLocal = (studentId: string, isRetained: boolean) => {
    setStudents(prev =>
      prev.map((s) =>
        s.no_student === studentId
          ? {
              ...s,
              flunk: isRetained ? 'O' : ''
            }
          : s
      )
    );
  };

  useEffect(() => {
    if (studentSpreadsheetId) {
      fetchStudents();
    }
  }, [studentSpreadsheetId]);

  return {
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
    addStudent, // addStudent 추가
    updateStudent,
    setStudentRetainedLocal,
    deleteStudent,
    fetchStudents,
    getCouncilByYear,
    getAllYears,
    getCouncilTableData,
    studentColumns,
    councilColumns
  };
};
