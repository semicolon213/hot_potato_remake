/**
 * @file CategoryManagement.tsx
 * @brief 카테고리 관리 컴포넌트
 * @details 장부의 카테고리를 추가, 수정, 삭제하는 컴포넌트입니다.
 * @author Hot Potato Team
 * @date 2024
 */

import React, { useState, useEffect } from 'react';
import { FaEdit, FaTrash, FaPlus, FaSearch, FaTags } from 'react-icons/fa';
import { getCategories, createCategory, updateCategory, deleteCategory } from '../../../utils/database/accountingManager';
import type { Category } from '../../../types/features/accounting';
import { notifyGlobal } from '../../../utils/ui/globalNotification';
import './accounting.css';

interface CategoryManagementProps {
  spreadsheetId: string;
}

export const CategoryManagement: React.FC<CategoryManagementProps> = ({
  spreadsheetId
}) => {
  const [categories, setCategories] = useState<Category[]>([]);
  const [isAddModalOpen, setIsAddModalOpen] = useState(false);
  const [isEditModalOpen, setIsEditModalOpen] = useState(false);
  const [editingCategory, setEditingCategory] = useState<Category | null>(null);
  const [newCategoryName, setNewCategoryName] = useState('');
  const [newCategoryDescription, setNewCategoryDescription] = useState('');
  const [editCategoryName, setEditCategoryName] = useState('');
  const [editCategoryDescription, setEditCategoryDescription] = useState('');
  /** 목록 최초/재조회 로딩 (테이블 스켈레톤) */
  const [listLoading, setListLoading] = useState(true);
  /** 추가·수정·삭제 중 (모달 버튼만 비활성화, 테이블은 유지) */
  const [isSaving, setIsSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [listError, setListError] = useState<string | null>(null);
  const [searchTerm, setSearchTerm] = useState('');

  useEffect(() => {
    loadCategories();
  }, [spreadsheetId]);

  const loadCategories = async () => {
    setListLoading(true);
    setListError(null);
    try {
      const categoriesData = await getCategories(spreadsheetId);
      setCategories(categoriesData);
    } catch (err) {
      console.error('❌ 카테고리 로드 오류:', err);
      setListError('카테고리를 불러오는데 실패했습니다. 잠시 후 다시 시도해 주세요.');
    } finally {
      setListLoading(false);
    }
  };

  const handleAddCategory = async () => {
    if (!newCategoryName.trim()) {
      setError('카테고리 이름을 입력해주세요.');
      return;
    }

    // 중복 체크
    if (categories.some(cat => cat.categoryName.toLowerCase() === newCategoryName.trim().toLowerCase())) {
      setError('이미 존재하는 카테고리입니다.');
      return;
    }

    setIsSaving(true);
    setError(null);

    try {
      const userInfo = typeof window !== 'undefined'
        ? JSON.parse(localStorage.getItem('user') || '{}')
        : {};

      await createCategory(
        spreadsheetId,
        newCategoryName.trim(),
        newCategoryDescription.trim(),
        userInfo.studentId || userInfo.email || 'unknown'
      );

      await loadCategories();
      setIsAddModalOpen(false);
      setNewCategoryName('');
      setNewCategoryDescription('');
      setError(null);
    } catch (err: unknown) {
      console.error('❌ 카테고리 추가 오류:', err);
      const errorMessage = err instanceof Error ? err.message : '카테고리 추가에 실패했습니다.';
      setError(errorMessage);
    } finally {
      setIsSaving(false);
    }
  };

  const handleCloseModal = () => {
    setIsAddModalOpen(false);
    setNewCategoryName('');
    setNewCategoryDescription('');
    setError(null);
  };

  const handleEditCategory = (category: Category) => {
    setEditingCategory(category);
    setEditCategoryName(category.categoryName);
    setEditCategoryDescription(category.description || '');
    setIsEditModalOpen(true);
    setError(null);
  };

  const handleCloseEditModal = () => {
    setIsEditModalOpen(false);
    setEditingCategory(null);
    setEditCategoryName('');
    setEditCategoryDescription('');
    setError(null);
  };

  const handleUpdateCategory = async () => {
    if (!editingCategory) return;

    if (!editCategoryName.trim()) {
      setError('카테고리 이름을 입력해주세요.');
      return;
    }

    // 중복 체크 (자기 자신 제외)
    if (categories.some(cat => 
      cat.categoryId !== editingCategory.categoryId && 
      cat.categoryName.toLowerCase() === editCategoryName.trim().toLowerCase()
    )) {
      setError('이미 존재하는 카테고리 이름입니다.');
      return;
    }

    setIsLoading(true);
    setError(null);

    try {
      await updateCategory(
        spreadsheetId,
        editingCategory.categoryId,
        editCategoryName.trim(),
        editCategoryDescription.trim()
      );

      await loadCategories();
      handleCloseEditModal();
      setError(null);
    } catch (err: unknown) {
      console.error('❌ 카테고리 수정 오류:', err);
      const errorMessage = err instanceof Error ? err.message : '카테고리 수정에 실패했습니다.';
      setError(errorMessage);
    } finally {
      setIsLoading(false);
    }
  };

  const handleDeleteCategory = async (category: Category) => {
    if (!window.confirm(`카테고리 "${category.categoryName}"를 삭제하시겠습니까?\n\n사용 중인 항목이 있으면 삭제할 수 없습니다.`)) {
      return;
    }

    setIsSaving(true);
    setError(null);

    try {
      await deleteCategory(spreadsheetId, category.categoryId);
      await loadCategories();
      setError(null);
    } catch (err: unknown) {
      console.error('❌ 카테고리 삭제 오류:', err);
      const errorMessage = err instanceof Error ? err.message : '카테고리 삭제에 실패했습니다.';
      notifyGlobal(errorMessage, 'error');
      setError(errorMessage);
    } finally {
      setIsSaving(false);
    }
  };

  const handleKeyPress = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey && newCategoryName.trim()) {
      e.preventDefault();
      handleAddCategory();
    }
  };

  // 검색 필터링
  const filteredCategories = categories.filter(category =>
    category.categoryName.toLowerCase().includes(searchTerm.toLowerCase()) ||
    (category.description && category.description.toLowerCase().includes(searchTerm.toLowerCase()))
  );

  const openAddModal = () => {
    setError(null);
    setIsAddModalOpen(true);
  };

  const isSearchNoResults =
    !listLoading &&
    !listError &&
    categories.length > 0 &&
    filteredCategories.length === 0 &&
    searchTerm.trim() !== '';

  const isEmptyList =
    !listLoading && !listError && categories.length === 0;

  return (
    <>
      <div className="category-management-panel">
        <div className="category-management-header">
          <div className="category-management-title-block">
            <h2>카테고리 관리</h2>
            <p className="category-management-subtitle">
              장부 항목·예산을 묶어서 볼 분류를 만듭니다. 항목 추가 시 카테고리를 선택하게 됩니다.
            </p>
          </div>
          <button
            type="button"
            className="add-category-btn add-category-btn--primary"
            onClick={openAddModal}
          >
            <FaPlus aria-hidden />
            카테고리 추가
          </button>
        </div>

        <div className="category-toolbar">
          <div className="category-search">
            <FaSearch className="category-search-icon" aria-hidden />
            <input
              type="search"
              placeholder="이름 또는 설명으로 검색"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              aria-label="카테고리 검색"
              disabled={listLoading || !!listError}
            />
          </div>
          {searchTerm.trim() !== '' && (
            <button
              type="button"
              className="category-search-reset"
              onClick={() => setSearchTerm('')}
              disabled={listLoading}
            >
              검색 지우기
            </button>
          )}
        </div>

        {listError && (
          <div className="category-list-error" role="alert">
            <span>{listError}</span>
            <button type="button" className="category-retry-btn" onClick={() => void loadCategories()}>
              다시 시도
            </button>
          </div>
        )}

        <div className={`category-table-wrapper ${isSaving ? 'category-table-wrapper--dimmed' : ''}`}>
          {listError && categories.length === 0 ? (
            <div className="category-empty-state category-empty-state--muted category-empty-state--compact">
              <p className="category-empty-state-text category-empty-state-text--solo">
                목록을 불러오지 못했습니다. 상단 안내에 따라 <strong>다시 시도</strong>를 눌러 주세요.
              </p>
            </div>
          ) : listLoading ? (
            <table className="category-table category-table--loading" aria-busy="true">
              <thead>
                <tr>
                  <th className="col-category-name">카테고리 이름</th>
                  <th className="col-category-description">설명</th>
                  <th className="col-category-usage">사용 횟수</th>
                  <th className="col-category-actions">작업</th>
                </tr>
              </thead>
              <tbody>
                {Array.from({ length: 5 }).map((_, index) => (
                  <tr key={`sk-${index}`} className="category-skeleton-row">
                    <td><span className="category-skeleton-cell" /></td>
                    <td><span className="category-skeleton-cell category-skeleton-cell--long" /></td>
                    <td><span className="category-skeleton-cell category-skeleton-cell--short" /></td>
                    <td><span className="category-skeleton-cell category-skeleton-cell--short" /></td>
                  </tr>
                ))}
              </tbody>
            </table>
          ) : isEmptyList ? (
            <div className="category-empty-state">
              <div className="category-empty-state-icon" aria-hidden>
                <FaTags />
              </div>
              <h3 className="category-empty-state-title">첫 카테고리를 만들어 보세요</h3>
              <p className="category-empty-state-text">
                MT·회식·소모품처럼 팀에 맞는 이름으로 정리하면 장부와 예산이 한결 보기 쉬워집니다.
              </p>
              <button type="button" className="add-category-btn add-category-btn--primary" onClick={openAddModal}>
                <FaPlus aria-hidden />
                카테고리 추가
              </button>
            </div>
          ) : isSearchNoResults ? (
            <div className="category-empty-state category-empty-state--muted">
              <div className="category-empty-state-icon category-empty-state-icon--muted" aria-hidden>
                <FaSearch />
              </div>
              <h3 className="category-empty-state-title">검색 결과가 없습니다</h3>
              <p className="category-empty-state-text">
                &ldquo;{searchTerm}&rdquo;에 맞는 카테고리가 없습니다. 다른 단어로 검색하거나 검색을 지워 주세요.
              </p>
              <button type="button" className="category-search-reset category-search-reset--standalone" onClick={() => setSearchTerm('')}>
                검색 초기화
              </button>
            </div>
          ) : (
            <table className="category-table">
              <thead>
                <tr>
                  <th className="col-category-name">카테고리 이름</th>
                  <th className="col-category-description">설명</th>
                  <th className="col-category-usage">사용 횟수</th>
                  <th className="col-category-actions">작업</th>
                </tr>
              </thead>
              <tbody>
                {filteredCategories.map(category => (
                  <tr key={category.categoryId}>
                    <td className="cell-category-name">{category.categoryName}</td>
                    <td className="cell-category-description">{category.description || '—'}</td>
                    <td className="cell-category-usage">
                      <span className="category-usage-pill">{category.usageCount}회</span>
                    </td>
                    <td className="cell-category-actions">
                      <div className="category-actions">
                        <button
                          type="button"
                          onClick={() => handleEditCategory(category)}
                          className="btn-edit"
                          title="수정"
                          disabled={isSaving}
                        >
                          <FaEdit />
                        </button>
                        <button
                          type="button"
                          onClick={() => handleDeleteCategory(category)}
                          className="btn-delete"
                          title="삭제"
                          disabled={category.usageCount > 0 || isSaving}
                        >
                          <FaTrash />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      </div>

      {/* 카테고리 추가 모달 */}
      {isAddModalOpen && (
        <div className="modal-overlay" onClick={handleCloseModal}>
          <div className="modal-content category-modal" onClick={(e) => e.stopPropagation()}>
            <div className="modal-header">
              <h2>카테고리 추가</h2>
              <button className="modal-close-btn" onClick={handleCloseModal}>×</button>
            </div>

            <div className="modal-body">
              <div className="form-group">
                <label htmlFor="category-name">
                  카테고리 이름 <span className="required">*</span>
                </label>
                <input
                  id="category-name"
                  type="text"
                  value={newCategoryName}
                  onChange={(e) => {
                    setNewCategoryName(e.target.value);
                    setError(null);
                  }}
                  onKeyPress={handleKeyPress}
                  placeholder="예: MT, 회식, 소모품 등"
                  autoFocus
                  className={error && !newCategoryName.trim() ? 'input-error' : ''}
                />
                <p className="form-hint">장부 항목을 분류할 카테고리 이름을 입력하세요</p>
              </div>

              <div className="form-group">
                <label htmlFor="category-description">설명</label>
                <textarea
                  id="category-description"
                  value={newCategoryDescription}
                  onChange={(e) => setNewCategoryDescription(e.target.value)}
                  placeholder="카테고리 설명 (선택사항)"
                  rows={3}
                  className="category-description-textarea"
                />
                <p className="form-hint">카테고리에 대한 추가 설명을 입력할 수 있습니다</p>
              </div>

              {error && (
                <div className="form-error">
                  <span className="error-icon">⚠️</span>
                  {error}
                </div>
              )}
            </div>

            <div className="modal-actions">
              <button
                type="button"
                onClick={handleCloseModal}
                disabled={isSaving}
                className="btn-cancel"
              >
                취소
              </button>
              <button
                onClick={handleAddCategory}
                disabled={isSaving || !newCategoryName.trim()}
                className="btn-primary"
              >
                {isSaving ? (
                  <>
                    <span className="spinner"></span>
                    추가 중...
                  </>
                ) : (
                  '추가'
                )}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* 카테고리 수정 모달 */}
      {isEditModalOpen && editingCategory && (
        <div className="modal-overlay" onClick={handleCloseEditModal}>
          <div className="modal-content category-modal" onClick={(e) => e.stopPropagation()}>
            <div className="modal-header">
              <h2>카테고리 수정</h2>
              <button className="modal-close-btn" onClick={handleCloseEditModal}>×</button>
            </div>

            <div className="modal-body">
              <div className="form-group">
                <label htmlFor="edit-category-name">
                  카테고리 이름 <span className="required">*</span>
                </label>
                <input
                  id="edit-category-name"
                  type="text"
                  value={editCategoryName}
                  onChange={(e) => {
                    setEditCategoryName(e.target.value);
                    setError(null);
                  }}
                  placeholder="예: MT, 회식, 소모품 등"
                  autoFocus
                  className={error && !editCategoryName.trim() ? 'input-error' : ''}
                />
                <p className="form-hint">
                  카테고리 이름을 변경하면 장부 항목과 예산안의 카테고리도 자동으로 업데이트됩니다.
                </p>
              </div>

              <div className="form-group">
                <label htmlFor="edit-category-description">설명</label>
                <textarea
                  id="edit-category-description"
                  value={editCategoryDescription}
                  onChange={(e) => setEditCategoryDescription(e.target.value)}
                  placeholder="카테고리 설명 (선택사항)"
                  rows={3}
                  className="category-description-textarea"
                />
                <p className="form-hint">카테고리 설명은 자유롭게 수정할 수 있으며, 다른 항목에 영향을 주지 않습니다.</p>
              </div>

              {error && (
                <div className="form-error">
                  <span className="error-icon">⚠️</span>
                  {error}
                </div>
              )}
            </div>

            <div className="modal-actions">
              <button
                type="button"
                onClick={handleCloseEditModal}
                disabled={isSaving}
                className="btn-cancel"
              >
                취소
              </button>
              <button
                onClick={handleUpdateCategory}
                disabled={isSaving || !editCategoryName.trim()}
                className="btn-primary"
              >
                {isSaving ? (
                  <>
                    <span className="spinner"></span>
                    수정 중...
                  </>
                ) : (
                  '수정'
                )}
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
};

