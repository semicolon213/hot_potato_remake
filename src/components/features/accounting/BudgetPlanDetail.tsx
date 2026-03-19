/**
 * @file BudgetPlanDetail.tsx
 * @brief 예산 계획 상세 관리 컴포넌트
 * @details 예산 계획의 항목들을 추가/수정/삭제하고 저장할 수 있는 작업 화면입니다.
 * @author Hot Potato Team
 * @date 2024
 */

import React, { useState, useEffect } from 'react';
import { getBudgetPlans, updateBudgetPlanDetails } from '../../../utils/database/accountingBudgetManager';
import { getCategories, getAccounts } from '../../../utils/database/accountingManager';
import type { BudgetPlan, BudgetPlanDetail, Category, Account } from '../../../types/features/accounting';
import { notifyGlobal } from '../../../utils/ui/globalNotification';
import './accounting.css';

interface BudgetPlanDetailProps {
  spreadsheetId: string;
  budgetId: string;
  onClose: () => void;
  onSave: () => void;
}

export const BudgetPlanDetail: React.FC<BudgetPlanDetailProps> = ({
  spreadsheetId,
  budgetId,
  onClose,
  onSave
}) => {
  const [budgetPlan, setBudgetPlan] = useState<BudgetPlan | null>(null);
  const [categories, setCategories] = useState<Category[]>([]);
  const [account, setAccount] = useState<Account | null>(null);
  const [details, setDetails] = useState<Omit<BudgetPlanDetail, 'detailId'>[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [hasChanges, setHasChanges] = useState(false);

  useEffect(() => {
    loadData();
  }, [spreadsheetId, budgetId]);

  const loadData = async () => {
    setIsLoading(true);
    setError(null);

    try {
      const [plans, categoriesData, accountsData] = await Promise.all([
        getBudgetPlans(spreadsheetId),
        getCategories(spreadsheetId),
        getAccounts(spreadsheetId)
      ]);

      const plan = plans.find(p => p.budgetId === budgetId);
      if (!plan) {
        setError('예산 계획을 찾을 수 없습니다.');
        return;
      }

      setBudgetPlan(plan);
      setDetails(plan.details.map(d => ({ 
        category: d.category, 
        description: d.description, 
        amount: d.amount,
        plannedDate: d.plannedDate,
        source: d.source || ''
      })));
      setCategories(categoriesData);
      
      const foundAccount = accountsData.find(acc => acc.accountId === plan.accountId);
      if (foundAccount) {
        setAccount(foundAccount);
      }
    } catch (err: unknown) {
      console.error('❌ 데이터 로드 오류:', err);
      const errorMessage = err instanceof Error ? err.message : '데이터를 불러오는데 실패했습니다.';
      setError(errorMessage);
    } finally {
      setIsLoading(false);
    }
  };

  const handleAddDetail = () => {
    const newDetails = [...details, { category: '', description: '', amount: 0, plannedDate: '', source: '' }];
    setDetails(newDetails);
    setHasChanges(true);
    
    // 새로 추가된 항목의 첫 번째 입력 필드에 포커스
    setTimeout(() => {
      const newIndex = newDetails.length - 1;
      const categorySelect = document.querySelector(`.budget-detail-table tbody tr:nth-child(${newIndex + 1}) select`) as HTMLSelectElement;
      if (categorySelect) {
        categorySelect.focus();
      }
    }, 100);
  };

  const handleRemoveDetail = (index: number) => {
    setDetails(details.filter((_, i) => i !== index));
    setHasChanges(true);
  };

  const handleDetailChange = (index: number, field: keyof Omit<BudgetPlanDetail, 'detailId'>, value: string | number) => {
    const newDetails = [...details];
    newDetails[index] = { ...newDetails[index], [field]: value } as Omit<BudgetPlanDetail, 'detailId'>;
    setDetails(newDetails);
    setHasChanges(true);
  };

  const formatAmount = (value: number): string => {
    if (!value) return '';
    return value.toLocaleString('ko-KR');
  };

  const parseAmount = (value: string): number => {
    const cleaned = value.replace(/[^\d]/g, '');
    return cleaned ? parseInt(cleaned, 10) : 0;
  };

  const handleSave = async () => {
    setError(null);

    // 유효성 검증
    for (let i = 0; i < details.length; i++) {
      const detail = details[i];
      if (!detail.category) {
        setError(`${i + 1}번째 항목의 카테고리를 선택해주세요.`);
        return;
      }
      if (!detail.description.trim()) {
        setError(`${i + 1}번째 항목의 설명을 입력해주세요.`);
        return;
      }
      if (detail.amount <= 0) {
        setError(`${i + 1}번째 항목의 금액을 입력해주세요.`);
        return;
      }
    }

    if (!account) {
      setError('통장 정보를 찾을 수 없습니다.');
      return;
    }

    if (!budgetPlan) {
      setError('예산 계획 정보를 찾을 수 없습니다.');
      return;
    }

    const totalAmount = details.reduce((sum, d) => sum + d.amount, 0);
    if (totalAmount > account.currentBalance) {
      setError(`예산 금액(${totalAmount.toLocaleString()}원)이 통장 잔액(${account.currentBalance.toLocaleString()}원)을 초과합니다.`);
      return;
    }

    setIsSaving(true);

    try {
      console.log('💾 예산 항목 저장 시도:', { budgetId, detailsCount: details.length });
      await updateBudgetPlanDetails(spreadsheetId, budgetId, { details });
      setHasChanges(false);
      onSave();
      notifyGlobal('예산 항목이 저장되었습니다.\n상세 항목이 수정되어 승인 요청 상태로 변경되었습니다.', 'success');
    } catch (err: unknown) {
      console.error('❌ 예산 항목 저장 오류:', err);
      
      // 인증 오류인 경우
      const errorMessage = err instanceof Error ? err.message : '예산 항목 저장에 실패했습니다.';
      if (errorMessage.includes('인증') || errorMessage.includes('401') || errorMessage.includes('Unauthorized')) {
        setError('인증이 만료되었습니다. 페이지를 새로고침해주세요.');
      } else {
        setError(errorMessage);
      }
    } finally {
      setIsSaving(false);
    }
  };

  const totalAmount = details.reduce((sum, detail) => sum + detail.amount, 0);
  const remainingBalance = account ? account.currentBalance - totalAmount : null;

  if (isLoading) {
    return (
      <div className="budget-plan-detail">
        <div className="loading-message">로딩 중...</div>
      </div>
    );
  }

  if (error && !budgetPlan) {
    return (
      <div className="budget-plan-detail">
        <div className="error-message">{error}</div>
        <button onClick={onClose} className="btn-secondary">닫기</button>
      </div>
    );
  }

  if (!budgetPlan) {
    return null;
  }

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="budget-plan-detail" onClick={(e) => e.stopPropagation()}>
        <div className="budget-plan-detail-header">
          <div>
            <h2>{budgetPlan.title}</h2>
            <p className="budget-plan-meta">
              집행일: {budgetPlan.executedDate ? new Date(budgetPlan.executedDate).toLocaleString('ko-KR', { 
                year: 'numeric', 
                month: '2-digit', 
                day: '2-digit', 
                hour: '2-digit', 
                minute: '2-digit' 
              }) : '미정'}
            </p>
          </div>
          <button onClick={onClose} className="close-btn">×</button>
        </div>

        {account && (
          <div className="account-summary">
            <div className="account-info">
              <span className="account-name">{account.accountName}</span>
              <span className="account-balance">잔액: {account.currentBalance.toLocaleString()}원</span>
            </div>
          </div>
        )}

        <div className="budget-details-section">
          <div className="section-header">
            <h3>예산 항목</h3>
            <button
              type="button"
              onClick={handleAddDetail}
              className="add-detail-btn-small"
            >
              + 항목 추가
            </button>
          </div>

          {details.length === 0 ? (
            <div className="empty-details">
              <p className="form-hint">예산 항목을 추가해주세요.</p>
            </div>
          ) : (
            <div className="budget-details-table-wrapper">
              <table className="budget-detail-table">
                <thead>
                  <tr>
                    <th className="col-index">#</th>
                    <th className="col-category">카테고리</th>
                    <th className="col-description">설명</th>
                    <th className="col-amount">금액</th>
                    <th className="col-date">집행 예정일</th>
                    <th className="col-source">출처</th>
                    <th className="col-action">작업</th>
                  </tr>
                </thead>
                <tbody>
                  {details.map((detail, index) => (
                    <tr key={index}>
                      <td className="cell-index">{index + 1}</td>
                      <td className="cell-category">
                        <select
                          value={detail.category}
                          onChange={(e) => handleDetailChange(index, 'category', e.target.value)}
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
                      <td className="cell-description">
                        <input
                          type="text"
                          value={detail.description}
                          onChange={(e) => handleDetailChange(index, 'description', e.target.value)}
                          placeholder="항목 설명을 입력하세요"
                          className="table-input-text"
                          required
                        />
                      </td>
                      <td className="cell-amount">
                        <input
                          type="text"
                          value={detail.amount ? formatAmount(detail.amount) : ''}
                          onChange={(e) => {
                            const parsed = parseAmount(e.target.value);
                            handleDetailChange(index, 'amount', parsed);
                          }}
                          onBlur={(e) => {
                            const parsed = parseAmount(e.target.value);
                            if (parsed !== detail.amount) {
                              handleDetailChange(index, 'amount', parsed);
                            }
                          }}
                          placeholder="0"
                          className="table-input-text"
                          required
                        />
                      </td>
                      <td className="cell-date">
                        <input
                          type="date"
                          value={detail.plannedDate || ''}
                          onChange={(e) => handleDetailChange(index, 'plannedDate', e.target.value)}
                          className="table-input-date"
                        />
                      </td>
                      <td className="cell-source">
                        <input
                          type="text"
                          value={detail.source || ''}
                          onChange={(e) => handleDetailChange(index, 'source', e.target.value)}
                          placeholder="출처/수입처를 입력하세요"
                          className="table-input-text"
                        />
                      </td>
                      <td className="cell-action">
                        <button
                          type="button"
                          onClick={() => handleRemoveDetail(index)}
                          className="table-btn-delete"
                          title="삭제"
                        >
                          ×
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}

          {account && (
            <div className="budget-summary">
              <div className="summary-row">
                <span>통장 잔액:</span>
                <strong>{account.currentBalance.toLocaleString()}원</strong>
              </div>
              <div className="summary-row">
                <span>총 예산 금액:</span>
                <strong>{totalAmount.toLocaleString()}원</strong>
              </div>
              <div className={`summary-row ${remainingBalance !== null && remainingBalance < 0 ? 'error-text' : ''}`}>
                <span>예상 남은 잔액:</span>
                <strong>{remainingBalance !== null ? remainingBalance.toLocaleString() : '-'}원</strong>
              </div>
              {remainingBalance !== null && remainingBalance < 0 && (
                <div className="error-warning">⚠️ 예산 금액이 통장 잔액을 초과합니다!</div>
              )}
            </div>
          )}
        </div>

        {error && (
          <div className="form-error">
            {error}
          </div>
        )}

        <div className="budget-plan-detail-actions">
          <button onClick={onClose} className="btn-secondary" disabled={isSaving}>
            닫기
          </button>
          <button
            onClick={handleSave}
            className="btn-primary"
            disabled={isSaving || !hasChanges || details.length === 0}
          >
            {isSaving ? '저장 중...' : '저장'}
          </button>
        </div>
      </div>
    </div>
  );
};

