/**
 * @file LedgerEntryList.tsx
 * @brief 장부 항목 목록 컴포넌트
 * @details 장부 항목을 표시하고 필터링할 수 있는 컴포넌트입니다.
 * @author Hot Potato Team
 * @date 2024
 */

import React, { useState, useEffect, useCallback, useMemo, useRef } from 'react';
import { getLedgerEntries, getAccounts, getCategories, deleteLedgerEntry, createLedgerEntry, updateLedgerEntry } from '../../../utils/database/accountingManager';
import { LedgerExportModal } from './LedgerExportModal';
import TableColumnFilter, { type SortDirection, type FilterOption } from '../../ui/common/TableColumnFilter';
import { FaDownload, FaPlus, FaFilter, FaTimes, FaEdit, FaTrash, FaPaperclip } from 'react-icons/fa';
import type { LedgerEntry, LedgerEntryFilter, Account, Category, CreateLedgerEntryRequest, UpdateLedgerEntryRequest } from '../../../types/features/accounting';
import { notifyGlobal } from '../../../utils/ui/globalNotification';
import './accounting.css';

interface LedgerEntryListProps {
  spreadsheetId: string;
  accountId?: string;
  onExportClick?: () => void;
  onAddClick?: () => void;
  exportDisabled?: boolean;
  addDisabled?: boolean;
  onEntriesChange?: (entries: LedgerEntry[]) => void;
  isAddingNew?: boolean;
  onAddingNewChange?: (isAdding: boolean) => void;
  onControlsRender?: (controls: {
    sortedMonths: string[];
    selectedMonthTab: string | null;
    itemsPerPage: number;
    groupedByMonth: Record<string, LedgerEntry[]>;
    formatMonthLabel: (monthKey: string) => string;
    handleAddMonthTab: () => void;
    onMonthTabChange: (monthKey: string) => void;
    onItemsPerPageChange: (value: number) => void;
    finalBalance: number;
  }) => void;
}

export const LedgerEntryList: React.FC<LedgerEntryListProps> = ({
  spreadsheetId,
  accountId,
  onExportClick,
  onAddClick,
  exportDisabled,
  addDisabled,
  onEntriesChange,
  isAddingNew: externalIsAddingNew,
  onAddingNewChange,
  onControlsRender
}) => {
  const [entries, setEntries] = useState<LedgerEntry[]>([]);
  const [accounts, setAccounts] = useState<Account[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);
  const [editingEntryId, setEditingEntryId] = useState<string | null>(null);
  const [internalIsAddingNew, setInternalIsAddingNew] = useState(false);
  const isAddingNew = externalIsAddingNew !== undefined ? externalIsAddingNew : internalIsAddingNew;
  const setIsAddingNew = (value: boolean) => {
    if (onAddingNewChange) {
      onAddingNewChange(value);
    } else {
      setInternalIsAddingNew(value);
    }
  };
  const [editingEntry, setEditingEntry] = useState<Partial<LedgerEntry> | null>(null);
  const [newEntry, setNewEntry] = useState<Partial<CreateLedgerEntryRequest>>({
    date: new Date().toISOString().split('T')[0],
    transactionType: 'expense',
    category: '',
    description: '',
    amount: 0,
    source: ''
  });
  const [newEntryEvidenceFile, setNewEntryEvidenceFile] = useState<File | null>(null);
  const [editingEntryEvidenceFile, setEditingEntryEvidenceFile] = useState<File | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [selectedAccountId, setSelectedAccountId] = useState<string>(accountId || '');
  const [currentPage, setCurrentPage] = useState<{ [monthKey: string]: number }>({});
  const [selectedMonthTab, setSelectedMonthTab] = useState<string | null>(null);
  const [showAddMonthModal, setShowAddMonthModal] = useState(false);
  const [newMonthInput, setNewMonthInput] = useState({ year: '', month: '' });
  const [itemsPerPage, setItemsPerPage] = useState<number>(10);
  const [isExportModalOpen, setIsExportModalOpen] = useState(false);
  
  // 필터 및 정렬 상태
  const [filterConfigs, setFilterConfigs] = useState<Record<string, {
    sortDirection: SortDirection;
    selectedFilters: (string | number)[];
  }>>({});
  const [openFilterColumn, setOpenFilterColumn] = useState<string | null>(null);
  const [filterPopupPosition, setFilterPopupPosition] = useState<{ top: number; left: number }>({ top: 0, left: 0 });
  const [contextMenu, setContextMenu] = useState<{ x: number; y: number; entry: LedgerEntry | null; isEmpty: boolean } | null>(null);
  
  // loadEntries를 useCallback으로 먼저 정의
  const loadEntries = useCallback(async (accountId?: string): Promise<LedgerEntry[] | undefined> => {
    // accountId 파라미터가 있으면 사용, 없으면 selectedAccountId 사용
    const targetAccountId = accountId || selectedAccountId;
    
    if (!targetAccountId) {
      console.warn('⚠️ 통장 ID가 없어 장부 항목을 로드할 수 없습니다.');
      return;
    }

    setIsLoading(true);
    setError(null);

    try {
      console.log('📋 장부 항목 로드:', { spreadsheetId, targetAccountId });
      
      // 모든 항목을 로드 (클라이언트 사이드 필터링 사용)
      const entriesData = await getLedgerEntries(
        spreadsheetId,
        targetAccountId,
        {} as LedgerEntryFilter
      );
      console.log('✅ 장부 항목 로드 완료:', entriesData.length, '개');
      setEntries(entriesData);
      if (onEntriesChange) {
        onEntriesChange(entriesData);
      }
      return entriesData;
    } catch (err) {
      console.error('❌ 장부 항목 조회 오류:', err);
      setError('장부 항목을 불러오는데 실패했습니다.');
      return;
    } finally {
      setIsLoading(false);
    }
  }, [spreadsheetId, selectedAccountId, onEntriesChange]);

  // 장부마다 통장이 하나이므로 첫 번째 통장 사용
  useEffect(() => {
    if (accounts.length > 0 && !selectedAccountId) {
      setSelectedAccountId(accounts[0].accountId);
    }
  }, [accounts]);

  useEffect(() => {
    loadData();
  }, [spreadsheetId]);

  useEffect(() => {
    // accounts가 로드되고 selectedAccountId가 설정된 후에만 장부 항목 로드
    if (accounts.length > 0 && selectedAccountId) {
      loadEntries();
    }
  }, [spreadsheetId, selectedAccountId, accounts.length, loadEntries]);

  // 외부 클릭 시 컨텍스트 메뉴 닫기
  useEffect(() => {
    const handleClickOutside = () => {
      if (contextMenu) {
        handleCloseContextMenu();
      }
    };

    if (contextMenu) {
      document.addEventListener('click', handleClickOutside);
      document.addEventListener('contextmenu', handleClickOutside);
    }

    return () => {
      document.removeEventListener('click', handleClickOutside);
      document.removeEventListener('contextmenu', handleClickOutside);
    };
  }, [contextMenu]);

  const loadData = async () => {
    try {
      console.log('📋 통장 및 카테고리 로드 시작:', spreadsheetId);
      const [accountsData, categoriesData] = await Promise.all([
        getAccounts(spreadsheetId),
        getCategories(spreadsheetId)
      ]);
      console.log('✅ 통장 목록:', accountsData);
      console.log('✅ 카테고리 목록:', categoriesData);
      
      setAccounts(accountsData);
      setCategories(categoriesData);

      if (accountsData.length > 0) {
        const firstAccountId = accountsData[0].accountId;
        console.log('🔍 첫 번째 통장 ID:', firstAccountId);
        if (!selectedAccountId || selectedAccountId !== firstAccountId) {
          console.log('✅ 통장 ID 설정:', firstAccountId);
          setSelectedAccountId(firstAccountId);
          // 통장 ID가 설정되면 자동으로 장부 항목 로드
          loadEntries(firstAccountId);
        }
      } else {
        console.warn('⚠️ 통장이 없습니다.');
        setError('통장 정보를 찾을 수 없습니다.');
      }
    } catch (err) {
      console.error('❌ 데이터 로드 오류:', err);
      setError('데이터를 불러오는데 실패했습니다.');
    }
  };

  const handleStartAdd = () => {
    setEditingEntryId(null);
    setNewEntry({
      date: new Date().toISOString().split('T')[0],
      transactionType: 'expense',
      category: '',
      description: '',
      amount: 0,
      source: ''
    });
    // 첫 번째 페이지로 이동하여 인라인 추가 행이 보이도록 함
    if (selectedMonthTab) {
      setCurrentPage(prev => ({ ...prev, [selectedMonthTab]: 1 }));
    }
    if (onAddClick) {
      onAddClick();
    } else {
      setIsAddingNew(true);
    }
  };

  const handleCancelAdd = () => {
    setIsAddingNew(false);
    setNewEntry({
      date: new Date().toISOString().split('T')[0],
      transactionType: 'expense',
      category: '',
      description: '',
      amount: 0,
      source: ''
    });
  };

  const handleSaveAdd = async () => {
    if (!selectedAccountId) {
      setError('통장 정보를 찾을 수 없습니다.');
      return;
    }

    if (!newEntry.date || !newEntry.category || !newEntry.description || !newEntry.source) {
      setError('모든 필수 항목을 입력해주세요.');
      return;
    }

    if (!newEntry.amount || newEntry.amount <= 0) {
      setError('올바른 금액을 입력해주세요.');
      return;
    }

    try {
      setIsLoading(true);
      setError(null);

      const userInfo = typeof window !== 'undefined'
        ? JSON.parse(localStorage.getItem('user') || '{}')
        : {};

      const entryData: CreateLedgerEntryRequest = {
        accountId: selectedAccountId,
        date: new Date(newEntry.date!).toISOString(),
        category: newEntry.category!,
        description: newEntry.description!,
        amount: newEntry.amount!,
        source: newEntry.source!,
        transactionType: newEntry.transactionType || 'expense',
        evidenceFile: newEntryEvidenceFile || undefined
      };

      await createLedgerEntry(
        spreadsheetId,
        entryData,
        userInfo.studentId || userInfo.email || 'unknown'
      );

      setIsAddingNew(false);
      setNewEntry({
        date: new Date().toISOString().split('T')[0],
        transactionType: 'expense',
        category: '',
        description: '',
        amount: 0,
        source: ''
      });
      setNewEntryEvidenceFile(null);
      const updatedEntries = await loadEntries();
      if (updatedEntries && onEntriesChange) {
        onEntriesChange(updatedEntries);
      }
      await loadData();
    } catch (err: unknown) {
      console.error('❌ 장부 항목 추가 오류:', err);
      const errorMessage = err instanceof Error ? err.message : '장부 항목 추가에 실패했습니다.';
      setError(errorMessage);
    } finally {
      setIsLoading(false);
    }
  };

  const handleStartEdit = (entry: LedgerEntry) => {
    // 예산안으로 생성된 항목도 수정 가능하도록 변경
    // if (entry.isBudgetExecuted && entry.budgetPlanId) {
    //   alert('예산안으로 생성된 항목은 수정할 수 없습니다.');
    //   return;
    // }
    setEditingEntryId(entry.entryId);
    setIsAddingNew(false);
    setEditingEntry({
      ...entry,
      date: entry.date.split('T')[0]
    });
    setContextMenu(null); // 컨텍스트 메뉴 닫기
  };

  // 컨텍스트 메뉴 핸들러
  const handleContextMenu = (e: React.MouseEvent, entry: LedgerEntry) => {
    e.preventDefault();
    e.stopPropagation();
    
    // 편집 중이면 컨텍스트 메뉴 표시 안 함
    if (isAddingNew || editingEntryId !== null) {
      return;
    }
    
    // 예산안으로 생성된 항목도 수정/삭제 가능하도록 변경
    // if (entry.isBudgetExecuted && entry.budgetPlanId) {
    //   return;
    // }
    
    setContextMenu({
      x: e.clientX,
      y: e.clientY,
      entry,
      isEmpty: false
    });
  };

  // 컨텍스트 메뉴 닫기
  const handleCloseContextMenu = () => {
    setContextMenu(null);
  };

  const handleCancelEdit = () => {
    setEditingEntryId(null);
    setEditingEntry(null);
    setEditingEntryEvidenceFile(null);
  };

  const handleSaveEdit = async () => {
    if (!editingEntry || !editingEntryId || !selectedAccountId) {
      return;
    }

    if (!editingEntry.date || !editingEntry.category || !editingEntry.description || !editingEntry.source) {
      setError('모든 필수 항목을 입력해주세요.');
      return;
    }

    if (!editingEntry.amount || editingEntry.amount <= 0) {
      setError('올바른 금액을 입력해주세요.');
      return;
    }

    try {
      setIsLoading(true);
      setError(null);

      const updateData: UpdateLedgerEntryRequest = {
        accountId: selectedAccountId,
        date: new Date(editingEntry.date).toISOString(),
        category: editingEntry.category,
        description: editingEntry.description,
        amount: editingEntry.amount,
        source: editingEntry.source,
        transactionType: editingEntry.transactionType || 'expense',
        evidenceFile: editingEntryEvidenceFile || undefined
      };

      await updateLedgerEntry(spreadsheetId, editingEntryId, updateData);
      
      setEditingEntryId(null);
      setEditingEntry(null);
      const updatedEntries = await loadEntries();
      if (updatedEntries && onEntriesChange) {
        onEntriesChange(updatedEntries);
      }
      await loadData();
    } catch (err: unknown) {
      console.error('❌ 장부 항목 수정 오류:', err);
      const errorMessage = err instanceof Error ? err.message : '장부 항목 수정에 실패했습니다.';
      setError(errorMessage);
    } finally {
      setIsLoading(false);
    }
  };

  const handleDelete = async (entry: LedgerEntry) => {
    if (!window.confirm('정말로 이 장부 항목을 삭제하시겠습니까?')) {
      setContextMenu(null); // 컨텍스트 메뉴 닫기
      return;
    }

    if (!selectedAccountId) {
      notifyGlobal('통장 정보를 찾을 수 없습니다.', 'error');
      return;
    }

    try {
      setIsLoading(true);
      await deleteLedgerEntry(spreadsheetId, entry.entryId, selectedAccountId);
      const updatedEntries = await loadEntries();
      if (updatedEntries && onEntriesChange) {
        onEntriesChange(updatedEntries);
      }
      await loadData(); // 잔액 업데이트를 위해
    } catch (err: unknown) {
      console.error('❌ 장부 항목 삭제 오류:', err);
      const errorMessage = err instanceof Error ? err.message : '장부 항목 삭제에 실패했습니다.';
      setError(errorMessage);
      notifyGlobal('장부 항목 삭제에 실패했습니다: ' + errorMessage, 'error');
    } finally {
      setIsLoading(false);
    }
  };

  const formatAmount = (amount: number) => {
    const sign = amount >= 0 ? '+' : '';
    return `${sign}${amount.toLocaleString()}`;
  };

  const parseAmount = (value: string): number => {
    const cleaned = value.replace(/[^\d]/g, '');
    return cleaned ? parseInt(cleaned, 10) : 0;
  };

  const formatAmountForInput = (value: number): string => {
    if (!value) return '';
    // 입력 필드에는 절댓값만 표시 (수입/지출은 transactionType으로 구분)
    return Math.abs(value).toLocaleString('ko-KR');
  };

  const formatDate = (dateString: string) => {
    const date = new Date(dateString);
    return `${date.getDate()}일`;
  };

  const formatMonthKey = (dateString: string) => {
    if (!dateString) return '';
    
    // ISO 형식 또는 YYYY-MM-DD 형식 처리
    let date: Date;
    if (dateString.includes('T')) {
      // ISO 형식: "2024-01-15T00:00:00.000Z"
      date = new Date(dateString);
    } else if (dateString.match(/^\d{4}-\d{2}-\d{2}$/)) {
      // YYYY-MM-DD 형식: "2024-01-15"
      const [year, month, day] = dateString.split('-').map(Number);
      date = new Date(year, month - 1, day);
    } else {
      // 기타 형식 시도
      date = new Date(dateString);
    }
    
    // 유효한 날짜인지 확인
    if (isNaN(date.getTime())) {
      console.warn('⚠️ 유효하지 않은 날짜:', dateString);
      return '';
    }
    
    return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`;
  };

  const formatMonthLabel = useCallback((monthKey: string) => {
    const [year, month] = monthKey.split('-');
    return `${year}년 ${parseInt(month)}월`;
  }, []);

  // 새 월 탭 추가 핸들러
  const handleAddMonthTab = useCallback(() => {
    setShowAddMonthModal(true);
  }, []);

  const handleConfirmAddMonth = () => {
    if (newMonthInput.year && newMonthInput.month) {
      const monthKey = `${newMonthInput.year}-${String(newMonthInput.month).padStart(2, '0')}`;
      if (!sortedMonths.includes(monthKey)) {
        setSelectedMonthTab(monthKey);
      } else {
        setSelectedMonthTab(monthKey);
      }
      setNewMonthInput({ year: '', month: '' });
      setShowAddMonthModal(false);
    }
  };

  const handleCancelAddMonth = () => {
    setNewMonthInput({ year: '', month: '' });
    setShowAddMonthModal(false);
  };

  // 필터링된 항목 계산
  const filteredEntries = useMemo(() => {
    let filtered = [...entries];

    // 유형 필터
    if (filterConfigs['transactionType']?.selectedFilters.length > 0) {
      const selectedTypes = filterConfigs['transactionType'].selectedFilters as string[];
      filtered = filtered.filter(entry => selectedTypes.includes(entry.transactionType));
    }

    // 카테고리 필터
    if (filterConfigs['category']?.selectedFilters.length > 0) {
      const selectedCategories = filterConfigs['category'].selectedFilters as string[];
      filtered = filtered.filter(entry => selectedCategories.includes(entry.category));
    }

    // 출처 필터
    if (filterConfigs['source']?.selectedFilters.length > 0) {
      const selectedSources = filterConfigs['source'].selectedFilters as string[];
      filtered = filtered.filter(entry => selectedSources.includes(entry.source));
    }

    // 증빙 필터
    if (filterConfigs['evidence']?.selectedFilters.length > 0) {
      const selectedEvidence = filterConfigs['evidence'].selectedFilters as string[];
      filtered = filtered.filter(entry => {
        const hasEvidence = !!entry.evidenceFileId;
        return selectedEvidence.includes(hasEvidence ? '있음' : '없음');
      });
    }

    // 예산안 필터
    if (filterConfigs['budgetPlan']?.selectedFilters.length > 0) {
      const selectedPlans = filterConfigs['budgetPlan'].selectedFilters as string[];
      filtered = filtered.filter(entry => {
        if (selectedPlans.includes('없음')) {
          return !entry.budgetPlanTitle;
        }
        return entry.budgetPlanTitle && selectedPlans.includes(entry.budgetPlanTitle);
      });
    }

    // 정렬 적용
    const sortConfig = Object.entries(filterConfigs).find(([_, config]) => config.sortDirection);
    if (sortConfig) {
      const [columnKey, config] = sortConfig;
      const direction = config.sortDirection === 'asc' ? 1 : -1;
      
      filtered.sort((a, b) => {
        let aVal: any;
        let bVal: any;
        
        switch (columnKey) {
          case 'date':
            aVal = new Date(a.date).getTime();
            bVal = new Date(b.date).getTime();
            break;
          case 'transactionType':
            aVal = a.transactionType;
            bVal = b.transactionType;
            break;
          case 'category':
            aVal = a.category;
            bVal = b.category;
            break;
          case 'description':
            aVal = a.description;
            bVal = b.description;
            break;
          case 'amount':
            aVal = Math.abs(a.amount);
            bVal = Math.abs(b.amount);
            break;
          case 'source':
            aVal = a.source;
            bVal = b.source;
            break;
          case 'balance':
            aVal = a.balanceAfter;
            bVal = b.balanceAfter;
            break;
          default:
            return 0;
        }
        
        if (aVal < bVal) return -1 * direction;
        if (aVal > bVal) return 1 * direction;
        return 0;
      });
    }

    return filtered;
  }, [entries, filterConfigs]);

  // 월별로 그룹화 (필터링된 항목 사용)
  const groupedByMonth = useMemo(() => {
    const grouped = filteredEntries.reduce((acc, entry) => {
      const monthKey = formatMonthKey(entry.date);
      // 빈 monthKey는 무시
      if (!monthKey) {
        console.warn('⚠️ 월별 그룹화 실패 - 유효하지 않은 날짜:', entry.date);
        return acc;
      }
      if (!acc[monthKey]) {
        acc[monthKey] = [];
      }
      acc[monthKey].push(entry);
      return acc;
    }, {} as Record<string, LedgerEntry[]>);

    // 각 월별 항목들을 날짜순으로 정렬 (빠른 날짜가 앞으로)
    Object.keys(grouped).forEach(monthKey => {
      grouped[monthKey].sort((a, b) => {
        const dateA = new Date(a.date).getTime();
        const dateB = new Date(b.date).getTime();
        if (isNaN(dateA) || isNaN(dateB)) {
          return 0;
        }
        if (dateA !== dateB) {
          return dateA - dateB; // 날짜가 빠른 순서대로
        }
        // 날짜가 같으면 생성일 기준으로 정렬
        const createdA = a.createdDate ? new Date(a.createdDate).getTime() : 0;
        const createdB = b.createdDate ? new Date(b.createdDate).getTime() : 0;
        return createdA - createdB;
      });
    });

    return grouped;
  }, [filteredEntries]);

  // 항목이 있는 월만 포함한 월 목록 생성 (오름차순 정렬)
  const sortedMonths = useMemo(() => {
    // 실제 데이터에 있는 월만 포함
    const monthsWithEntries = Object.keys(groupedByMonth).filter(monthKey => {
      return monthKey && groupedByMonth[monthKey] && groupedByMonth[monthKey].length > 0;
    });
    
    // 정렬: 연도 오름차순, 월 오름차순 (과거 월이 먼저)
    const months = monthsWithEntries.sort((a, b) => {
      const [yearA, monthA] = a.split('-').map(Number);
      const [yearB, monthB] = b.split('-').map(Number);
      if (yearA !== yearB) {
        return yearA - yearB; // 연도 오름차순
      }
      return monthA - monthB; // 월 오름차순
    });
    
    return months;
  }, [groupedByMonth]);

  // 선택된 탭이 없으면 첫 번째 월을 자동 선택
  // 항목이 없을 때는 현재 월을 기본으로 선택
  useEffect(() => {
    if (sortedMonths.length > 0 && !selectedMonthTab) {
      setSelectedMonthTab(sortedMonths[0]);
    } else if (sortedMonths.length === 0 && !selectedMonthTab) {
      // 항목이 없을 때 현재 월을 기본으로 선택
      const now = new Date();
      const currentMonth = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
      setSelectedMonthTab(currentMonth);
    }
  }, [sortedMonths, selectedMonthTab]);

  // 페이지당 항목 수 변경 핸들러
  const handleItemsPerPageChange = useCallback((value: number) => {
    setItemsPerPage(value);
    setCurrentPage({});
  }, []);

  // 이전 컨트롤 값들을 저장하기 위한 ref
  const prevControlsRef = useRef<{
    sortedMonths: string[];
    selectedMonthTab: string | null;
    itemsPerPage: number;
    groupedByMonthKeys: string[];
  } | null>(null);

  // 최종 잔액 계산 (가장 최근 항목의 잔액)
  const finalBalance = useMemo(() => {
    if (entries.length === 0) return 0;
    // 날짜순으로 정렬하여 가장 최근 항목의 잔액 가져오기
    const sortedEntries = [...entries].sort((a, b) => {
      const dateA = new Date(a.date).getTime();
      const dateB = new Date(b.date).getTime();
      if (dateA !== dateB) {
        return dateB - dateA; // 최신 날짜가 앞으로
      }
      // 날짜가 같으면 생성일 기준
      const createdA = a.createdDate ? new Date(a.createdDate).getTime() : 0;
      const createdB = b.createdDate ? new Date(b.createdDate).getTime() : 0;
      return createdB - createdA;
    });
    return sortedEntries[0]?.balanceAfter || 0;
  }, [entries]);

  // 컨트롤 정보를 부모 컴포넌트에 전달
  useEffect(() => {
    if (onControlsRender) {
      const groupedByMonthKeys = Object.keys(groupedByMonth).sort();
      const currentControls = {
        sortedMonths,
        selectedMonthTab,
        itemsPerPage,
        groupedByMonthKeys,
        finalBalance
      };

      // 이전 값과 비교하여 실제로 변경된 경우에만 호출
      const prev = prevControlsRef.current;
      if (!prev || 
          JSON.stringify(prev.sortedMonths) !== JSON.stringify(currentControls.sortedMonths) ||
          prev.selectedMonthTab !== currentControls.selectedMonthTab ||
          prev.itemsPerPage !== currentControls.itemsPerPage ||
          JSON.stringify(prev.groupedByMonthKeys) !== JSON.stringify(currentControls.groupedByMonthKeys) ||
          prev.finalBalance !== currentControls.finalBalance) {
        prevControlsRef.current = currentControls;
        onControlsRender({
          sortedMonths,
          selectedMonthTab,
          itemsPerPage,
          groupedByMonth,
          formatMonthLabel,
          handleAddMonthTab,
          onMonthTabChange: setSelectedMonthTab,
          onItemsPerPageChange: handleItemsPerPageChange,
          finalBalance
        });
      }
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [sortedMonths, selectedMonthTab, itemsPerPage, groupedByMonth, formatMonthLabel, handleAddMonthTab, handleItemsPerPageChange, finalBalance]);

  // 필터 옵션 생성
  const getFilterOptions = (columnKey: string): FilterOption[] => {
    const uniqueValues = new Set<string | number>();
    
    entries.forEach(entry => {
      let value: string | number | undefined;
      
      switch (columnKey) {
        case 'transactionType':
          value = entry.transactionType;
          break;
        case 'category':
          value = entry.category;
          break;
        case 'source':
          value = entry.source;
          break;
        case 'evidence':
          value = entry.evidenceFileId ? '있음' : '없음';
          break;
        case 'budgetPlan':
          value = entry.budgetPlanTitle || '없음';
          break;
        default:
          return;
      }
      
      if (value !== undefined) {
        uniqueValues.add(value);
      }
    });
    
    return Array.from(uniqueValues)
      .sort()
      .map(value => ({
        value,
        label: String(value),
        count: entries.filter(entry => {
          switch (columnKey) {
            case 'transactionType':
              return entry.transactionType === value;
            case 'category':
              return entry.category === value;
            case 'source':
              return entry.source === value;
            case 'evidence':
              const hasEvidence = !!entry.evidenceFileId;
              return (value === '있음' && hasEvidence) || (value === '없음' && !hasEvidence);
            case 'budgetPlan':
              return (value === '없음' && !entry.budgetPlanTitle) || entry.budgetPlanTitle === value;
            default:
              return false;
          }
        }).length
      }));
  };

  // 헤더 클릭 핸들러
  const handleHeaderClick = (e: React.MouseEvent<HTMLTableCellElement>, columnKey: string) => {
    const rect = e.currentTarget.getBoundingClientRect();
    setFilterPopupPosition({
      top: rect.bottom + 4,
      left: rect.left
    });
    setOpenFilterColumn(openFilterColumn === columnKey ? null : columnKey);
  };

  // 정렬 변경 핸들러
  const handleSortChange = (columnKey: string, direction: SortDirection) => {
    setFilterConfigs(prev => {
      const newConfigs: Record<string, {
        sortDirection: SortDirection;
        selectedFilters: (string | number)[];
      }> = {};
      
      // 모든 컬럼의 정렬을 초기화하고, 현재 컬럼만 정렬 설정
      Object.keys(prev).forEach(key => {
        newConfigs[key] = {
          ...prev[key],
          sortDirection: key === columnKey ? direction : null
        };
      });
      
      // 현재 컬럼이 없으면 새로 추가
      if (!newConfigs[columnKey]) {
        newConfigs[columnKey] = {
          sortDirection: direction,
          selectedFilters: []
        };
      } else {
        newConfigs[columnKey] = {
          ...newConfigs[columnKey],
          sortDirection: direction
        };
      }
      
      return newConfigs;
    });
  };

  // 필터 변경 핸들러
  const handleFilterChange = (columnKey: string, filters: (string | number)[]) => {
    setFilterConfigs(prev => ({
      ...prev,
      [columnKey]: {
        ...prev[columnKey] || { sortDirection: null, selectedFilters: [] },
        selectedFilters: filters
      }
    }));
  };

  // 필터/정렬 초기화 핸들러
  const handleClearFilters = (columnKey: string, e?: React.MouseEvent) => {
    if (e) {
      e.stopPropagation();
    }
    setFilterConfigs(prev => {
      const newConfigs = { ...prev };
      if (newConfigs[columnKey]) {
        newConfigs[columnKey] = {
          sortDirection: null,
          selectedFilters: []
        };
      }
      return newConfigs;
    });
  };

  // 내보내기 핸들러
  const handleExport = () => {
    if (onExportClick) {
      onExportClick();
    } else {
      setIsExportModalOpen(true);
    }
  };

  // 항목 추가 핸들러
  const handleAdd = () => {
    handleStartAdd();
  };

  return (
    <>
      {error && (
        <div className="error-message">
          {error}
        </div>
      )}

      {isLoading ? (
        <div className="ledger-entry-table-wrapper">
          <table className="ledger-entry-table">
            <thead>
              <tr>
                <th className="col-date">날짜</th>
                <th className="col-type">유형</th>
                <th className="col-category">카테고리</th>
                <th className="col-budget-plan">예산안</th>
                <th className="col-description">내용</th>
                <th className="col-amount">금액</th>
                <th className="col-source">출처</th>
                <th className="col-evidence">증빙</th>
                <th className="col-balance">잔액</th>
              </tr>
            </thead>
            <tbody>
              {Array.from({ length: 10 }).map((_, index) => (
                <tr key={`loading-${index}`}>
                  <td className="cell-date"></td>
                  <td className="cell-type"></td>
                  <td className="cell-category"></td>
                  <td className="cell-budget-plan"></td>
                  <td className="cell-description"></td>
                  <td className="cell-amount"></td>
                  <td className="cell-source"></td>
                  <td className="cell-evidence"></td>
                  <td className="cell-balance"></td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : (
        <>
          {/* 선택된 월의 데이터 표시 - 항목이 없을 때도 테이블 표시 */}
          {(selectedMonthTab || (() => {
            // 항목이 없을 때 현재 월을 기본으로 설정
            const now = new Date();
            return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
          })()) && (() => {
            const activeMonthTab = selectedMonthTab || (() => {
              const now = new Date();
              return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
            })();
            const monthEntries = groupedByMonth[activeMonthTab] || [];
            const totalPages = Math.ceil(monthEntries.length / itemsPerPage) || 1;
            const page = currentPage[activeMonthTab] || 1;
            const startIndex = (page - 1) * itemsPerPage;
            const endIndex = startIndex + itemsPerPage;
            const paginatedEntries = monthEntries.slice(startIndex, endIndex);
            
            // 빈 항목 생성 함수
            const createEmptyRows = (count: number) => {
              return Array.from({ length: count }).map((_, index) => ({
                entryId: `empty-${index}`,
                date: '',
                transactionType: 'expense' as const,
                category: '',
                description: '',
                amount: 0,
                source: '',
                balanceAfter: 0,
                isBudgetExecuted: false,
                budgetPlanTitle: null,
                evidenceFileId: null,
                createdDate: null
              }));
            };
            
            // 항목이 있으면 실제 데이터 + 빈 행으로 10개 채우기, 없으면 빈 행 10개
            const displayEntries = paginatedEntries.length > 0 
              ? [...paginatedEntries, ...createEmptyRows(Math.max(0, 10 - paginatedEntries.length))]
              : createEmptyRows(10);

            // 새 항목 추가 행 표시
            // 항목이 비어있을 때도 인라인 추가가 보이도록 함 (page === 1일 때)
            // isAddingNew가 true이거나 항목이 없을 때 표시
            const shouldShowAddRow = isAddingNew && page === 1;

            return (
              <React.Fragment key={activeMonthTab}>
                <div className="ledger-entry-table-wrapper">
                  <table className="ledger-entry-table">
                    <thead>
                      <tr>
                        <th 
                          className={`col-date sortable ${filterConfigs['date']?.sortDirection ? 'sorted' : ''} ${filterConfigs['date']?.selectedFilters.length ? 'filtered' : ''}`}
                          onClick={(e) => handleHeaderClick(e, 'date')}
                        >
                          <div className="th-content">
                            <span>날짜</span>
                            {(filterConfigs['date']?.sortDirection || filterConfigs['date']?.selectedFilters.length > 0) && (
                              <button
                                className="filter-clear-icon"
                                onClick={(e) => handleClearFilters('date', e)}
                                title="필터/정렬 초기화"
                              >
                                <FaFilter className="filter-icon" />
                                <FaTimes className="clear-icon" />
                              </button>
                            )}
                          </div>
                        </th>
                        <th 
                          className={`col-type sortable ${filterConfigs['transactionType']?.sortDirection ? 'sorted' : ''} ${filterConfigs['transactionType']?.selectedFilters.length ? 'filtered' : ''}`}
                          onClick={(e) => handleHeaderClick(e, 'transactionType')}
                        >
                          <div className="th-content">
                            <span>유형</span>
                            {(filterConfigs['transactionType']?.sortDirection || filterConfigs['transactionType']?.selectedFilters.length > 0) && (
                              <button
                                className="filter-clear-icon"
                                onClick={(e) => handleClearFilters('transactionType', e)}
                                title="필터/정렬 초기화"
                              >
                                <FaFilter className="filter-icon" />
                                <FaTimes className="clear-icon" />
                              </button>
                            )}
                          </div>
                        </th>
                        <th 
                          className={`col-category sortable ${filterConfigs['category']?.sortDirection ? 'sorted' : ''} ${filterConfigs['category']?.selectedFilters.length ? 'filtered' : ''}`}
                          onClick={(e) => handleHeaderClick(e, 'category')}
                        >
                          <div className="th-content">
                            <span>카테고리</span>
                            {(filterConfigs['category']?.sortDirection || filterConfigs['category']?.selectedFilters.length > 0) && (
                              <button
                                className="filter-clear-icon"
                                onClick={(e) => handleClearFilters('category', e)}
                                title="필터/정렬 초기화"
                              >
                                <FaFilter className="filter-icon" />
                                <FaTimes className="clear-icon" />
                              </button>
                            )}
                          </div>
                        </th>
                        <th 
                          className={`col-budget-plan sortable ${filterConfigs['budgetPlan']?.sortDirection ? 'sorted' : ''} ${filterConfigs['budgetPlan']?.selectedFilters.length ? 'filtered' : ''}`}
                          onClick={(e) => handleHeaderClick(e, 'budgetPlan')}
                        >
                          <div className="th-content">
                            <span>예산안 이름</span>
                            {(filterConfigs['budgetPlan']?.sortDirection || filterConfigs['budgetPlan']?.selectedFilters.length > 0) && (
                              <button
                                className="filter-clear-icon"
                                onClick={(e) => handleClearFilters('budgetPlan', e)}
                                title="필터/정렬 초기화"
                              >
                                <FaFilter className="filter-icon" />
                                <FaTimes className="clear-icon" />
                              </button>
                            )}
                          </div>
                        </th>
                        <th 
                          className={`col-description sortable ${filterConfigs['description']?.sortDirection ? 'sorted' : ''}`}
                          onClick={(e) => handleHeaderClick(e, 'description')}
                        >
                          <div className="th-content">
                            <span>내용</span>
                            {filterConfigs['description']?.sortDirection && (
                              <button
                                className="filter-clear-icon"
                                onClick={(e) => handleClearFilters('description', e)}
                                title="정렬 초기화"
                              >
                                <FaFilter className="filter-icon" />
                                <FaTimes className="clear-icon" />
                              </button>
                            )}
                          </div>
                        </th>
                        <th 
                          className={`col-amount sortable ${filterConfigs['amount']?.sortDirection ? 'sorted' : ''}`}
                          onClick={(e) => handleHeaderClick(e, 'amount')}
                        >
                          <div className="th-content">
                            <span>금액</span>
                            {filterConfigs['amount']?.sortDirection && (
                              <button
                                className="filter-clear-icon"
                                onClick={(e) => handleClearFilters('amount', e)}
                                title="정렬 초기화"
                              >
                                <FaFilter className="filter-icon" />
                                <FaTimes className="clear-icon" />
                              </button>
                            )}
                          </div>
                        </th>
                        <th 
                          className={`col-source sortable ${filterConfigs['source']?.sortDirection ? 'sorted' : ''} ${filterConfigs['source']?.selectedFilters.length ? 'filtered' : ''}`}
                          onClick={(e) => handleHeaderClick(e, 'source')}
                        >
                          <div className="th-content">
                            <span>출처</span>
                            {(filterConfigs['source']?.sortDirection || filterConfigs['source']?.selectedFilters.length > 0) && (
                              <button
                                className="filter-clear-icon"
                                onClick={(e) => handleClearFilters('source', e)}
                                title="필터/정렬 초기화"
                              >
                                <FaFilter className="filter-icon" />
                                <FaTimes className="clear-icon" />
                              </button>
                            )}
                          </div>
                        </th>
                        <th 
                          className={`col-evidence sortable ${filterConfigs['evidence']?.sortDirection ? 'sorted' : ''} ${filterConfigs['evidence']?.selectedFilters.length ? 'filtered' : ''}`}
                          onClick={(e) => handleHeaderClick(e, 'evidence')}
                        >
                          <div className="th-content">
                            <span>증빙</span>
                            {(filterConfigs['evidence']?.sortDirection || filterConfigs['evidence']?.selectedFilters.length > 0) && (
                              <button
                                className="filter-clear-icon"
                                onClick={(e) => handleClearFilters('evidence', e)}
                                title="필터/정렬 초기화"
                              >
                                <FaFilter className="filter-icon" />
                                <FaTimes className="clear-icon" />
                              </button>
                            )}
                          </div>
                        </th>
                        <th 
                          className={`col-balance sortable ${filterConfigs['balance']?.sortDirection ? 'sorted' : ''}`}
                          onClick={(e) => handleHeaderClick(e, 'balance')}
                        >
                          <div className="th-content">
                            <span>잔액</span>
                            {filterConfigs['balance']?.sortDirection && (
                              <button
                                className="filter-clear-icon"
                                onClick={(e) => handleClearFilters('balance', e)}
                                title="정렬 초기화"
                              >
                                <FaFilter className="filter-icon" />
                                <FaTimes className="clear-icon" />
                              </button>
                            )}
                          </div>
                        </th>
                      </tr>
                    </thead>
                    <tbody>
                      {/* 새 항목 추가 행 */}
                      {shouldShowAddRow && (
                        <tr className="editing-row">
                          <td className="cell-date">
                            <input
                              type="date"
                              value={newEntry.date || ''}
                              onChange={(e) => setNewEntry({ ...newEntry, date: e.target.value })}
                              className="table-input-date"
                              required
                            />
                          </td>
                          <td className="cell-type">
                            <select
                              value={newEntry.transactionType || 'expense'}
                              onChange={(e) => setNewEntry({ ...newEntry, transactionType: e.target.value as 'income' | 'expense' })}
                              className="table-input-select"
                            >
                              <option value="expense">지출</option>
                              <option value="income">수입</option>
                            </select>
                          </td>
                          <td className="cell-category">
                            <select
                              value={newEntry.category || ''}
                              onChange={(e) => setNewEntry({ ...newEntry, category: e.target.value })}
                              className="table-input-select"
                              required
                            >
                              <option value="">카테고리 선택</option>
                              {categories.map(cat => (
                                <option key={cat.categoryId} value={cat.categoryName}>
                                  {cat.categoryName}
                                </option>
                              ))}
                            </select>
                          </td>
                          <td className="cell-budget-plan">
                            <span className="budget-plan-title-empty">-</span>
                          </td>
                          <td className="cell-description">
                            <input
                              type="text"
                              value={newEntry.description || ''}
                              onChange={(e) => setNewEntry({ ...newEntry, description: e.target.value })}
                              placeholder="내용을 입력하세요"
                              className="table-input-text"
                              required
                            />
                          </td>
                          <td className="cell-amount">
                            <input
                              type="text"
                              value={newEntry.amount ? formatAmountForInput(newEntry.amount) : ''}
                              onChange={(e) => {
                                const parsed = parseAmount(e.target.value);
                                setNewEntry({ ...newEntry, amount: parsed });
                              }}
                              placeholder="0"
                              className="table-input-text"
                              required
                            />
                          </td>
                          <td className="cell-source">
                            <input
                              type="text"
                              value={newEntry.source || ''}
                              onChange={(e) => setNewEntry({ ...newEntry, source: e.target.value })}
                              placeholder="출처를 입력하세요"
                              className="table-input-text"
                              required
                            />
                          </td>
                          <td className="cell-evidence">
                            <label htmlFor="new-entry-evidence-file" className="file-input-label">
                              <FaPaperclip />
                              <span>파일 선택</span>
                            </label>
                            <input
                              id="new-entry-evidence-file"
                              type="file"
                              onChange={(e) => setNewEntryEvidenceFile(e.target.files?.[0] || null)}
                              accept=".pdf,.jpg,.jpeg,.png,.doc,.docx"
                              className="table-input-file"
                            />
                            {newEntryEvidenceFile && (
                              <span className="file-name" title={newEntryEvidenceFile.name}>
                                {newEntryEvidenceFile.name.length > 15 
                                  ? newEntryEvidenceFile.name.substring(0, 15) + '...' 
                                  : newEntryEvidenceFile.name}
                              </span>
                            )}
                          </td>
                          <td className="cell-balance"></td>
                          <td className="cell-action">
                            <div className="entry-actions">
                              <button
                                onClick={handleSaveAdd}
                                className="btn-save action-btn"
                                disabled={isLoading}
                              >
                                저장
                              </button>
                              <button
                                onClick={handleCancelAdd}
                                className="btn-cancel action-btn"
                                disabled={isLoading}
                              >
                                취소
                              </button>
                            </div>
                          </td>
                        </tr>
                      )}
                      {/* 기존 항목 행들 */}
                      {displayEntries.map(entry => {
                        // 빈 행인 경우
                        if (entry.entryId.startsWith('empty-')) {
                          return (
                            <tr 
                              key={entry.entryId}
                              onContextMenu={(e) => {
                                e.preventDefault();
                                e.stopPropagation();
                                if (isAddingNew || editingEntryId !== null) {
                                  return;
                                }
                                setContextMenu({
                                  x: e.clientX,
                                  y: e.clientY,
                                  entry: null,
                                  isEmpty: true
                                });
                              }}
                            >
                              <td className="cell-date"></td>
                              <td className="cell-type"></td>
                              <td className="cell-category"></td>
                              <td className="cell-budget-plan"></td>
                              <td className="cell-description"></td>
                              <td className="cell-amount"></td>
                              <td className="cell-source"></td>
                              <td className="cell-evidence"></td>
                              <td className="cell-balance"></td>
                            </tr>
                          );
                        }
                        
                        // 실제 데이터 행
                        const isEditing = editingEntryId === entry.entryId;
                        const entryData = isEditing ? editingEntry : entry;
                        
                        return (
                          <tr 
                            key={entry.entryId} 
                            className={isEditing ? 'editing-row' : ''}
                            onContextMenu={(e) => handleContextMenu(e, entry)}
                          >
                            <td 
                              className="cell-date"
                              onContextMenu={(e) => handleContextMenu(e, entry)}
                            >
                              {isEditing ? (
                                <input
                                  type="date"
                                  value={entryData?.date?.toString().split('T')[0] || ''}
                                  onChange={(e) => setEditingEntry({ ...editingEntry!, date: e.target.value })}
                                  className="table-input-date"
                                  required
                                />
                              ) : (
                                formatDate(entry.date)
                              )}
                            </td>
                            <td 
                              className="cell-type"
                              onContextMenu={(e) => !isEditing && handleContextMenu(e, entry)}
                            >
                              {isEditing ? (
                                <select
                                  value={entryData?.transactionType || 'expense'}
                                  onChange={(e) => setEditingEntry({ ...editingEntry!, transactionType: e.target.value as 'income' | 'expense' })}
                                  className="table-input-select"
                                >
                                  <option value="expense">지출</option>
                                  <option value="income">수입</option>
                                </select>
                              ) : (
                                <span className={`transaction-type-badge ${entry.transactionType}`}>
                                  {entry.transactionType === 'income' ? '수입' : '지출'}
                                </span>
                              )}
                            </td>
                            <td className="cell-category">
                              {isEditing ? (
                                <select
                                  value={entryData?.category || ''}
                                  onChange={(e) => setEditingEntry({ ...editingEntry!, category: e.target.value })}
                                  className="table-input-select"
                                  required
                                >
                                  <option value="">카테고리 선택</option>
                                  {categories.map(cat => (
                                    <option key={cat.categoryId} value={cat.categoryName}>
                                      {cat.categoryName}
                                    </option>
                                  ))}
                                </select>
                              ) : (
                                entry.category
                              )}
                            </td>
                            <td className="cell-budget-plan budget-plan-title-cell">
                              {entry.isBudgetExecuted && entry.budgetPlanTitle ? (
                                <span className="budget-plan-title-display">{entry.budgetPlanTitle}</span>
                              ) : (
                                <span className="budget-plan-title-empty">-</span>
                              )}
                            </td>
                            <td className="cell-description">
                              {isEditing ? (
                                <input
                                  type="text"
                                  value={entryData?.description || ''}
                                  onChange={(e) => setEditingEntry({ ...editingEntry!, description: e.target.value })}
                                  className="table-input-text"
                                  required
                                />
                              ) : (
                                entry.description
                              )}
                            </td>
                            <td className={`cell-amount ${isEditing ? '' : `amount-cell ${entry.transactionType}`}`}>
                              {isEditing ? (
                                <input
                                  type="text"
                                  value={entryData?.amount ? formatAmountForInput(entryData.amount) : ''}
                                  onChange={(e) => {
                                    const parsed = parseAmount(e.target.value);
                                    setEditingEntry({ ...editingEntry!, amount: parsed });
                                  }}
                                  className="table-input-text"
                                  required
                                />
                              ) : (
                                formatAmount(entry.amount)
                              )}
                            </td>
                            <td className="cell-source">
                              {isEditing ? (
                                <input
                                  type="text"
                                  value={entryData?.source || ''}
                                  onChange={(e) => setEditingEntry({ ...editingEntry!, source: e.target.value })}
                                  className="table-input-text"
                                  required
                                />
                              ) : (
                                entry.source
                              )}
                            </td>
                            <td className="cell-evidence">
                              {isEditing ? (
                                <>
                                  <label htmlFor={`edit-entry-evidence-file-${entry.entryId}`} className="file-input-label">
                                    <FaPaperclip />
                                    <span>파일 선택</span>
                                  </label>
                                  <input
                                    id={`edit-entry-evidence-file-${entry.entryId}`}
                                    type="file"
                                    onChange={(e) => setEditingEntryEvidenceFile(e.target.files?.[0] || null)}
                                    accept=".pdf,.jpg,.jpeg,.png,.doc,.docx"
                                    className="table-input-file"
                                  />
                                  {editingEntryEvidenceFile && (
                                    <span className="file-name" title={editingEntryEvidenceFile.name}>
                                      {editingEntryEvidenceFile.name.length > 15 
                                        ? editingEntryEvidenceFile.name.substring(0, 15) + '...' 
                                        : editingEntryEvidenceFile.name}
                                    </span>
                                  )}
                                  {!editingEntryEvidenceFile && entry.evidenceFileName && (
                                    <span className="existing-file" title={entry.evidenceFileName}>
                                      기존: {entry.evidenceFileName.length > 10 
                                        ? entry.evidenceFileName.substring(0, 10) + '...' 
                                        : entry.evidenceFileName}
                                    </span>
                                  )}
                                </>
                              ) : (
                                entry.evidenceFileName ? (
                                  <a
                                    href={`https://drive.google.com/file/d/${entry.evidenceFileId}/view`}
                                    target="_blank"
                                    rel="noopener noreferrer"
                                    className="evidence-link"
                                    title={entry.evidenceFileName}
                                  >
                                    📎 {entry.evidenceFileName.length > 15 
                                      ? entry.evidenceFileName.substring(0, 15) + '...' 
                                      : entry.evidenceFileName}
                                  </a>
                                ) : (
                                  <span className="no-evidence">-</span>
                                )
                              )}
                            </td>
                            <td className="cell-balance">
                              {isEditing ? '-' : `${entry.balanceAfter.toLocaleString()}원`}
                            </td>
                            {isEditing && (
                              <td className="cell-action">
                                <div className="entry-actions">
                                  <button
                                    onClick={handleSaveEdit}
                                    className="btn-save action-btn"
                                    disabled={isLoading}
                                  >
                                    저장
                                  </button>
                                  <button
                                    onClick={handleCancelEdit}
                                    className="btn-cancel action-btn"
                                    disabled={isLoading}
                                  >
                                    취소
                                  </button>
                                </div>
                              </td>
                            )}
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
                {(() => {
                  // 페이지네이션 번호 생성 함수 (DocumentManagement와 동일)
                  const getPaginationNumbers = (currentPage: number, totalPages: number) => {
                    const pageNeighbours = 2;
                    const totalNumbers = (pageNeighbours * 2) + 1;
                    const totalBlocks = totalNumbers + 2;

                    if (totalPages <= totalBlocks) {
                      return Array.from({ length: totalPages }, (_, i) => i + 1);
                    }

                    const startPage = Math.max(2, currentPage - pageNeighbours);
                    const endPage = Math.min(totalPages - 1, currentPage + pageNeighbours);
                    let pages: (string | number)[] = Array.from({ length: (endPage - startPage) + 1 }, (_, i) => startPage + i);

                    const hasLeftSpill = startPage > 2;
                    const hasRightSpill = (totalPages - endPage) > 1;
                    const spillOffset = totalNumbers - (pages.length + 1);

                    switch (true) {
                      case (hasLeftSpill && !hasRightSpill):
                        const extraPages = Array.from({ length: spillOffset }, (_, i) => startPage - 1 - i).reverse();
                        pages = ['...', ...extraPages, ...pages];
                        break;
                      case (!hasLeftSpill && hasRightSpill):
                        const extraPages_ = Array.from({ length: spillOffset }, (_, i) => endPage + 1 + i);
                        pages = [...pages, ...extraPages_, '...'];
                        break;
                      case (hasLeftSpill && hasRightSpill):
                      default:
                        pages = ['...', ...pages, '...'];
                        break;
                    }

                    return [1, ...pages, totalPages];
                  };

                  const paginationNumbers = totalPages >= 1 ? getPaginationNumbers(page, totalPages) : [];
                  const paginate = (newPage: number) => {
                    setCurrentPage(prev => ({ ...prev, [selectedMonthTab]: newPage }));
                  };

                  return (
                    <div className="pagination">
                      <button 
                        onClick={() => paginate(page - 1)} 
                        className="page-arrow-link"
                        disabled={page === 1}
                      >
                        <span>이전</span>
                      </button>

                      {paginationNumbers.map((pageNum, index) => {
                        if (typeof pageNum === 'string') {
                          return <span key={`ellipsis-${index}`} className="page-ellipsis">...</span>;
                        }
                        return (
                          <button 
                            key={pageNum} 
                            onClick={() => paginate(pageNum)} 
                            className={`page-link ${page === pageNum ? 'active' : ''}`}
                          >
                            {pageNum}
                          </button>
                        );
                      })}

                      <button 
                        onClick={() => paginate(page + 1)} 
                        className="page-arrow-link"
                        disabled={page === totalPages}
                      >
                        <span>다음</span>
                      </button>
                    </div>
                  );
                })()}
              </React.Fragment>
            );
          })()}
        </>
      )}

      {/* 새 월 탭 추가 모달 */}
      {showAddMonthModal && (
        <div className="modal-overlay" onClick={handleCancelAddMonth}>
          <div className="modal-content" onClick={(e) => e.stopPropagation()}>
            <h3>새 월 탭 추가</h3>
            <div className="form-group">
              <label>년도</label>
              <input
                type="number"
                value={newMonthInput.year}
                onChange={(e) => setNewMonthInput({ ...newMonthInput, year: e.target.value })}
                placeholder="예: 2025"
                min="2000"
                max="2100"
              />
            </div>
            <div className="form-group">
              <label>월</label>
              <input
                type="number"
                value={newMonthInput.month}
                onChange={(e) => setNewMonthInput({ ...newMonthInput, month: e.target.value })}
                placeholder="예: 11"
                min="1"
                max="12"
              />
            </div>
            <div className="modal-actions">
              <button onClick={handleConfirmAddMonth} className="btn-primary">
                추가
              </button>
              <button onClick={handleCancelAddMonth} className="btn-secondary">
                취소
              </button>
            </div>
          </div>
        </div>
      )}

      {/* 장부 내보내기 모달 */}
      {!onExportClick && (
        <LedgerExportModal
          isOpen={isExportModalOpen}
          onClose={() => setIsExportModalOpen(false)}
          entries={entries}
          spreadsheetId={spreadsheetId}
        />
      )}

      {/* 필터 팝업 */}
      {openFilterColumn && (
        <TableColumnFilter
          columnKey={openFilterColumn}
          columnLabel={
            openFilterColumn === 'date' ? '날짜' :
            openFilterColumn === 'transactionType' ? '유형' :
            openFilterColumn === 'category' ? '카테고리' :
            openFilterColumn === 'budgetPlan' ? '예산안 이름' :
            openFilterColumn === 'description' ? '내용' :
            openFilterColumn === 'amount' ? '금액' :
            openFilterColumn === 'source' ? '출처' :
            openFilterColumn === 'evidence' ? '증빙' :
            openFilterColumn === 'balance' ? '잔액' : ''
          }
          isOpen={true}
          position={filterPopupPosition}
          onClose={() => setOpenFilterColumn(null)}
          sortDirection={filterConfigs[openFilterColumn]?.sortDirection || null}
          onSortChange={(direction) => handleSortChange(openFilterColumn, direction)}
          availableOptions={getFilterOptions(openFilterColumn)}
          selectedFilters={filterConfigs[openFilterColumn]?.selectedFilters || []}
          onFilterChange={(filters) => handleFilterChange(openFilterColumn, filters)}
          onClearFilters={() => handleClearFilters(openFilterColumn)}
        />
      )}

      {/* 컨텍스트 메뉴 */}
      {contextMenu && (
        <>
          <div 
            className="context-menu-overlay"
            onClick={handleCloseContextMenu}
            onContextMenu={(e) => {
              e.preventDefault();
              handleCloseContextMenu();
            }}
          />
          <div 
            className="context-menu"
            style={{
              position: 'fixed',
              top: `${contextMenu.y}px`,
              left: `${contextMenu.x}px`,
              zIndex: 10000
            }}
            onClick={(e) => e.stopPropagation()}
          >
            {contextMenu.isEmpty ? (
              <button
                className="context-menu-item"
                onClick={() => {
                  if (onAddClick) {
                    onAddClick();
                  } else {
                    setIsAddingNew(true);
                  }
                  handleCloseContextMenu();
                }}
              >
                <FaPlus />
                <span>추가하기</span>
              </button>
            ) : (
              <>
                <button
                  className="context-menu-item"
                  onClick={() => {
                    if (contextMenu.entry) {
                      handleStartEdit(contextMenu.entry);
                    }
                  }}
                >
                  <FaEdit />
                  <span>수정</span>
                </button>
                <button
                  className="context-menu-item"
                  onClick={() => {
                    if (contextMenu.entry) {
                      handleDelete(contextMenu.entry);
                    }
                    handleCloseContextMenu();
                  }}
                >
                  <FaTrash />
                  <span>삭제</span>
                </button>
              </>
            )}
          </div>
        </>
      )}
    </>
  );
};

