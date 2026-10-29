import { logger } from '../../../utils/logger';
/**
 * WorkflowRequestModal.tsx
 * 결재 요청 모달
 * 문서 관리 페이지의 모달 컴포넌트 스타일 재사용
 */

import React, { useState, useEffect } from 'react';
import { apiClient } from '../../../utils/api/apiClient';
import { NotificationModal } from '../../ui/NotificationModal';
import { grantPersonalDocumentPermissions, grantPermissionsToMultiplePersonalDocuments } from '../../../utils/google/workflowPermissions';
import { loadAllDocuments } from '../../../utils/helpers/loadDocumentsFromDrive';
import type { DocumentInfo } from '../../../types/documents';
import WorkflowEditor from './WorkflowEditor';
import WorkflowTemplateModal from './WorkflowTemplateModal';
import type { WorkflowRequestData, ReviewLine, PaymentLine, WorkflowLineStep } from '../../../types/documents';
import type { WorkflowRequestResponse, UsersListResponse } from '../../../types/api/apiResponses';
import './WorkflowRequestModal.css';
const log = logger.scope('components/features/workflow/WorkflowRequestModal');


interface WorkflowRequestModalProps {
  isOpen: boolean;
  onClose: () => void;
  documentId?: string;
  documentTitle?: string;
  isPersonalDocument?: boolean;  // 개인 문서 여부
  onSuccess?: (response: WorkflowRequestResponse) => void;
}

interface User {
  email: string;
  name: string;
  userType?: string;
  isApproved?: boolean;
}

const WorkflowRequestModal: React.FC<WorkflowRequestModalProps> = ({
  isOpen,
  onClose,
  documentId,
  documentTitle,
  isPersonalDocument = false,
  onSuccess
}) => {
  const [step, setStep] = useState<'options' | 'editor' | 'lines'>('options');
  const [createWorkflowDocument, setCreateWorkflowDocument] = useState<boolean>(false);
  const [attachDocument, setAttachDocument] = useState<boolean>(false);
  const [workflowTitle, setWorkflowTitle] = useState<string>('');
  const [workflowContent, setWorkflowContent] = useState<string>('');
  const [reviewLine, setReviewLine] = useState<ReviewLine>([]);
  const [paymentLine, setPaymentLine] = useState<PaymentLine>([]);
  const [users, setUsers] = useState<User[]>([]);
  const [selectedDocumentId, setSelectedDocumentId] = useState<string>(documentId || '');
  const [selectedAttachDocumentIds, setSelectedAttachDocumentIds] = useState<string[]>([]);
  const [availableDocuments, setAvailableDocuments] = useState<DocumentInfo[]>([]);
  const [isLoadingDocuments, setIsLoadingDocuments] = useState<boolean>(false);
  const [isLoading, setIsLoading] = useState<boolean>(false);
  const [notification, setNotification] = useState<{ message: string; type: 'success' | 'error' | 'info' } | null>(null);
  const [isTemplateModalOpen, setIsTemplateModalOpen] = useState<boolean>(false);

  // 사용자 목록 로드
  useEffect(() => {
    const loadUsers = async () => {
      try {
        const response = await apiClient.getAllUsers();
        
        // Apps Script는 response.users에 직접 배열을 반환함
        if (response.success && response.users && Array.isArray(response.users)) {
          // 승인된 사용자만 필터링
          const usersResponse = response as UsersListResponse;
          const userList = usersResponse.users.filter((user) => {
            const isApproved = user.isApproved || user.Approval === 'O';
            // 이메일과 이름이 있는 사용자만
            return isApproved && user.email && (user.name || user.name_member);
          }).map((user) => ({
            email: user.email || '',
            name: user.name || user.name_member || '',
            userType: user.userType || user.user_type || 'student',
            isApproved: user.isApproved || user.Approval === 'O'
          }));
          setUsers(userList);
        } else {
          log.warn('사용자 목록을 가져올 수 없습니다');
          // 디버깅을 위해 응답 전체를 로그
          if (response.data) {
      // Intentionally ignored.

          }
        }
      } catch (error) {
        log.error('사용자 목록 로드 오류:', error);
      }
    };
    
    if (isOpen) {
      loadUsers();
    }
  }, [isOpen]);

  // 문서 목록 로드
  useEffect(() => {
    const loadDocuments = async () => {
      setIsLoadingDocuments(true);
      try {
        const docs = await loadAllDocuments();
        setAvailableDocuments(docs);
      } catch (error) {
        log.error('문서 목록 로드 오류:', error);
      } finally {
        setIsLoadingDocuments(false);
      }
    };
    if (isOpen) {
      loadDocuments();
    }
  }, [isOpen]);

  // 모달이 열릴 때 초기화
  useEffect(() => {
    if (isOpen) {
      setStep('options');
      setCreateWorkflowDocument(false);
      setAttachDocument(false);
      setWorkflowTitle('');
      setWorkflowContent('');
      setReviewLine([]);
      setPaymentLine([]);
      setSelectedDocumentId(documentId || '');
      setSelectedAttachDocumentIds([]);
    }
  }, [isOpen, documentId]);

  const handleNext = () => {
    if (step === 'options') {
      if (createWorkflowDocument) {
        setStep('editor');
      } else {
        setStep('lines');
      }
    } else if (step === 'editor') {
      setStep('lines');
    }
  };

  const handleBack = () => {
    if (step === 'lines') {
      if (createWorkflowDocument) {
        setStep('editor');
      } else {
        setStep('options');
      }
    } else if (step === 'editor') {
      setStep('options');
    }
  };

  const addReviewStep = () => {
    const newStep: WorkflowLineStep = {
      step: reviewLine.length + 1,
      email: '',
      name: '',
      status: '대기'
    };
    setReviewLine([...reviewLine, newStep]);
  };

  const removeReviewStep = (index: number) => {
    const newLine = reviewLine.filter((_, i) => i !== index).map((step, i) => ({
      ...step,
      step: i + 1
    }));
    setReviewLine(newLine);
  };

  const updateReviewStep = (index: number, field: keyof WorkflowLineStep, value: string) => {
    const newLine = [...reviewLine];
    newLine[index] = { ...newLine[index], [field]: value };
    if (field === 'email') {
      // 이메일로 사용자 이름 찾기
      const user = users.find(u => u.email === value);
      if (user) {
        newLine[index].name = user.name;
      }
    }
    setReviewLine(newLine);
  };

  const addPaymentStep = () => {
    const newStep: WorkflowLineStep = {
      step: paymentLine.length + 1,
      email: '',
      name: '',
      status: '대기'
    };
    setPaymentLine([...paymentLine, newStep]);
  };

  const removePaymentStep = (index: number) => {
    const newLine = paymentLine.filter((_, i) => i !== index).map((step, i) => ({
      ...step,
      step: i + 1
    }));
    setPaymentLine(newLine);
  };

  const updatePaymentStep = (index: number, field: keyof WorkflowLineStep, value: string) => {
    const newLine = [...paymentLine];
    newLine[index] = { ...newLine[index], [field]: value };
    if (field === 'email') {
      // 이메일로 사용자 이름 찾기
      const user = users.find(u => u.email === value);
      if (user) {
        newLine[index].name = user.name;
      }
    }
    setPaymentLine(newLine);
  };

  const handleSubmit = async () => {
    // 유효성 검사
    if (!createWorkflowDocument && selectedAttachDocumentIds.length === 0 && !selectedDocumentId && !documentId) {
      setNotification({ message: '결재할 문서를 최소 1개 이상 선택해주세요.', type: 'error' });
      return;
    }

    if (createWorkflowDocument && attachDocument && selectedAttachDocumentIds.length === 0) {
      setNotification({ message: '첨부할 문서를 최소 1개 이상 선택해주세요.', type: 'error' });
      return;
    }

    if (createWorkflowDocument && !workflowTitle.trim()) {
      setNotification({ message: '결재 문서 제목을 입력해주세요.', type: 'error' });
      return;
    }

    if (reviewLine.length === 0 || reviewLine.some(r => !r.email)) {
      setNotification({ message: '검토 라인을 모두 입력해주세요.', type: 'error' });
      return;
    }

    if (paymentLine.length === 0 || paymentLine.some(p => !p.email)) {
      setNotification({ message: '결재 라인을 모두 입력해주세요.', type: 'error' });
      return;
    }

    setIsLoading(true);
    try {
      const userInfo = typeof window !== 'undefined' ? JSON.parse(localStorage.getItem('user') || '{}') : {};
      
      // 선택된 첨부 문서들의 타입 확인
      let hasPersonalDocument = false;
      if (createWorkflowDocument && attachDocument && selectedAttachDocumentIds.length > 0) {
        hasPersonalDocument = selectedAttachDocumentIds.some(docId => {
          const doc = availableDocuments.find(d => d.id === docId);
          return doc && doc.documentType === 'personal';
        });
      } else if (!createWorkflowDocument) {
        if (selectedAttachDocumentIds.length > 0) {
          // 여러 문서 선택됨
          hasPersonalDocument = selectedAttachDocumentIds.some(docId => {
            const doc = availableDocuments.find(d => d.id === docId);
            return doc && doc.documentType === 'personal';
          });
          // documentId도 확인
          if (!hasPersonalDocument && documentId) {
            const doc = availableDocuments.find(d => d.id === documentId);
            hasPersonalDocument = doc?.documentType === 'personal' || false;
          }
        } else if (selectedDocumentId) {
          const selectedDoc = availableDocuments.find(d => d.id === selectedDocumentId);
          hasPersonalDocument = selectedDoc?.documentType === 'personal' || false;
        } else {
          hasPersonalDocument = isPersonalDocument;
        }
      } else {
        hasPersonalDocument = isPersonalDocument;
      }
      
      // 문서 ID 설정 로직
      // - 결재 문서 생성 + 첨부: selectedAttachDocumentIds는 첨부할 문서들
      // - 결재 문서만: documentId 없음
      // - 문서 직접 결재: selectedAttachDocumentIds가 있으면 여러 문서, 없으면 selectedDocumentId 또는 documentId
      let finalDocumentId = undefined;
      let finalAttachDocumentIds: string[] | undefined = undefined;
      
      if (createWorkflowDocument && attachDocument) {
        // 결재 문서 생성 + 첨부: selectedAttachDocumentIds는 첨부할 문서들
        finalAttachDocumentIds = selectedAttachDocumentIds.length > 0 ? selectedAttachDocumentIds : undefined;
        // 원래 documentId가 있으면 그것도 포함 (이미 선택되지 않은 경우)
        if (documentId && !selectedAttachDocumentIds.includes(documentId)) {
          finalAttachDocumentIds = [...(finalAttachDocumentIds || []), documentId];
        }
      } else if (!createWorkflowDocument) {
        // 문서 직접 결재: 여러 문서 선택 가능
        if (selectedAttachDocumentIds.length > 0) {
          // 여러 문서 선택됨
          finalAttachDocumentIds = selectedAttachDocumentIds;
          // documentId가 선택 목록에 없으면 추가
          if (documentId && !selectedAttachDocumentIds.includes(documentId)) {
            finalAttachDocumentIds = [...finalAttachDocumentIds, documentId];
          }
          // 첫 번째 문서를 documentId로도 설정 (Apps Script 호환성)
          finalDocumentId = finalAttachDocumentIds[0] || documentId || undefined;
        } else {
          // 단일 문서 선택 (기존 방식 호환)
          finalDocumentId = selectedDocumentId || documentId || undefined;
        }
      }
      // 결재 문서만 생성하는 경우는 documentId가 없어도 됨
      
      const requestData: WorkflowRequestData = {
        createWorkflowDocument,
        attachDocument: createWorkflowDocument ? attachDocument : false,
        documentId: finalDocumentId,
        attachedDocumentIds: finalAttachDocumentIds, // 첨부할 문서 ID 목록 (여러 개)
        isPersonalDocument: hasPersonalDocument,
        workflowTitle: createWorkflowDocument ? workflowTitle : undefined,
        workflowContent: createWorkflowDocument ? workflowContent : undefined,
        requesterEmail: userInfo.email,
        requesterName: userInfo.name,
        reviewLine: reviewLine.map(r => ({ step: r.step, email: r.email, name: r.name })),
        paymentLine: paymentLine.map(p => ({ step: p.step, email: p.email, name: p.name }))
      };

      const response = await apiClient.requestWorkflow(requestData);
      
      // 디버그 정보 확인
      if (response.debug) {
      // Intentionally ignored.

      }
      
      if (response.success && response.data) {
        // 개인 문서인 경우 프론트엔드에서 권한 부여
        if (response.data.requiresFrontendPermissionGrant && response.data.personalDocuments) {
          try {
            
            const permissionResults = await grantPermissionsToMultiplePersonalDocuments(
              response.data.personalDocuments,
              'reader'
            );
            
            if (permissionResults.successCount > 0) {
              setNotification({ 
                message: `결재 요청이 등록되었습니다. (권한 부여: ${permissionResults.successCount}개 문서)`, 
                type: 'success' 
              });
            } else if (permissionResults.failCount > 0) {
              setNotification({ 
                message: '결재 요청은 등록되었지만 일부 권한 부여에 실패했습니다.', 
                type: 'error' 
              });
            } else {
              setNotification({ message: '결재 요청이 성공적으로 등록되었습니다.', type: 'success' });
            }
          } catch (permError) {
            log.error('개인 문서 권한 부여 오류:', permError);
            setNotification({ 
              message: '결재 요청은 등록되었지만 권한 부여 중 오류가 발생했습니다.', 
              type: 'error' 
            });
          }
        } else {
          setNotification({ message: '결재 요청이 성공적으로 등록되었습니다.', type: 'success' });
        }
        
        if (onSuccess) {
          onSuccess(response.data);
        }
        setTimeout(() => {
          onClose();
        }, 1500);
      } else {
        // 디버그 정보가 있으면 함께 표시
        let errorMessage = response.message || '결재 요청에 실패했습니다.';
        if (response.debug) {
          log.error('결재 요청 실패 디버그');
          if (response.debug.actionReceived !== 'requestWorkflow') {
            errorMessage += ` (받은 액션: ${response.debug.actionReceived || '없음'})`;
          }
        }
        setNotification({ message: errorMessage, type: 'error' });
      }
    } catch (error) {
      log.error('결재 요청 오류:', error);
      setNotification({ message: '결재 요청 중 오류가 발생했습니다.', type: 'error' });
    } finally {
      setIsLoading(false);
    }
  };

  if (!isOpen) return null;

  return (
    <>
      <div className="document-modal-overlay" onClick={onClose}>
        <div className="document-modal-content workflow-request-modal" onClick={(e) => e.stopPropagation()}>
          <div className="document-modal-header">
            <h2>결재 요청</h2>
            <button className="document-modal-close" onClick={onClose}>
              ×
            </button>
          </div>

          <div className="document-modal-body">
            {step === 'options' && (
              <div className="form-section">
                <div className="form-group">
                  <label className="checkbox-label">
                    <input
                      type="checkbox"
                      checked={createWorkflowDocument}
                      onChange={(e) => setCreateWorkflowDocument(e.target.checked)}
                    />
                    <span>결재 문서 생성</span>
                  </label>
                </div>

                {createWorkflowDocument && (
                  <div className="form-group">
                    <label className="checkbox-label">
                      <input
                        type="checkbox"
                        checked={attachDocument}
                        onChange={(e) => setAttachDocument(e.target.checked)}
                      />
                      <span>기존 문서 첨부</span>
                    </label>
                    <p className="form-hint">결재 문서에 기존에 생성된 문서를 첨부하여 함께 결재합니다.</p>
                    {attachDocument && (
                      <div>
                        {selectedAttachDocumentIds.length > 0 && (
                          <div className="added-users-list" style={{ marginBottom: '16px' }}>
                            <div style={{ marginBottom: '8px', fontWeight: 600, fontSize: '14px' }}>
                              선택된 문서 ({selectedAttachDocumentIds.length}개)
                            </div>
                            {selectedAttachDocumentIds.map((docId) => {
                              const doc = availableDocuments.find(d => d.id === docId);
                              if (!doc) return null;
                              return (
                                <div key={docId} className="added-user-item">
                                  <span className="user-info">
                                    {doc.title} ({doc.documentType === 'personal' ? '개인' : '공유'})
                                  </span>
                                  <button
                                    type="button"
                                    className="btn-remove-step"
                                    onClick={() => {
                                      setSelectedAttachDocumentIds(prev => prev.filter(id => id !== docId));
                                    }}
                                  >
                                    삭제
                                  </button>
                                </div>
                              );
                            })}
                          </div>
                        )}
                        <div className="user-table-container">
                          <div className="user-table-header">
                            <span>문서 목록 (더블클릭하여 첨부할 문서 선택)</span>
                            <span className="user-count">총 {availableDocuments.filter(d => !selectedAttachDocumentIds.includes(d.id)).length}개</span>
                          </div>
                          {isLoadingDocuments ? (
                            <div className="loading-documents" style={{ padding: '20px', textAlign: 'center' }}>
                              문서 목록 로딩 중...
                            </div>
                          ) : (
                            <div className="user-table">
                              <div className="user-table-row user-table-header-row">
                                <div className="user-table-cell" style={{ width: '50px' }}>#</div>
                                <div className="user-table-cell" style={{ flex: 2 }}>문서명</div>
                                <div className="user-table-cell" style={{ flex: 1 }}>유형</div>
                              </div>
                              {availableDocuments
                                .filter(doc => !selectedAttachDocumentIds.includes(doc.id))
                                .map((doc, index) => (
                                  <div
                                    key={doc.id}
                                    className="user-table-row user-table-data-row"
                                    onDoubleClick={() => {
                                      if (!selectedAttachDocumentIds.includes(doc.id)) {
                                        setSelectedAttachDocumentIds(prev => [...prev, doc.id]);
                                      }
                                    }}
                                  >
                                    <div className="user-table-cell" style={{ width: '50px' }}>{index + 1}</div>
                                    <div className="user-table-cell" style={{ flex: 2 }}>{doc.title}</div>
                                    <div className="user-table-cell" style={{ flex: 1 }}>
                                      <span style={{ 
                                        padding: '4px 8px', 
                                        borderRadius: '4px',
                                        fontSize: '12px',
                                        backgroundColor: doc.documentType === 'personal' ? '#e3f2fd' : '#f3e5f5',
                                        color: doc.documentType === 'personal' ? '#1976d2' : '#7b1fa2'
                                      }}>
                                        {doc.documentType === 'personal' ? '개인' : '공유'}
                                      </span>
                                    </div>
                                  </div>
                                ))}
                              {availableDocuments.filter(doc => !selectedAttachDocumentIds.includes(doc.id)).length === 0 && (
                                <div className="user-table-row">
                                  <div className="user-table-cell" style={{ width: '100%', textAlign: 'center', padding: '20px' }}>
                                    추가할 수 있는 문서가 없습니다.
                                  </div>
                                </div>
                              )}
                            </div>
                          )}
                        </div>
                        {documentId && !selectedAttachDocumentIds.includes(documentId) && (
                          <p className="form-hint" style={{ marginTop: '8px' }}>
                            현재 문서: {documentTitle || '문서'} (더블클릭하여 추가 가능)
                          </p>
                        )}
                      </div>
                    )}
                  </div>
                )}

                {!createWorkflowDocument && (
                  <div className="form-group">
                    {documentId && !selectedAttachDocumentIds.includes(documentId) ? (
                      <div className="document-info">
                        <strong>{documentTitle || '문서'}</strong>
                        {documentId && <span className="document-id">ID: {documentId.substring(0, 20)}...</span>}
                        <p className="form-hint" style={{ marginTop: '8px', marginLeft: '0' }}>
                          선택된 문서에 대해 직접 결재를 진행합니다. (별도의 결재 문서 없이)
                        </p>
                        <button
                          type="button"
                          style={{ marginTop: '8px', padding: '6px 12px', fontSize: '13px' }}
                          onClick={() => {
                            if (!selectedAttachDocumentIds.includes(documentId)) {
                              setSelectedAttachDocumentIds([documentId]);
                              setSelectedDocumentId('');
                            }
                          }}
                        >
                          여러 문서 선택으로 변경
                        </button>
                      </div>
                    ) : (
                      <>
                        {selectedAttachDocumentIds.length > 0 && (
                          <div className="added-users-list" style={{ marginBottom: '16px' }}>
                            <div style={{ marginBottom: '8px', fontWeight: 600, fontSize: '14px' }}>
                              선택된 문서 ({selectedAttachDocumentIds.length}개)
                            </div>
                            {selectedAttachDocumentIds.map((docId) => {
                              const doc = availableDocuments.find(d => d.id === docId);
                              if (!doc) return null;
                              return (
                                <div key={docId} className="added-user-item">
                                  <span className="user-info">
                                    {doc.title} ({doc.documentType === 'personal' ? '개인' : '공유'})
                                  </span>
                                  <button
                                    type="button"
                                    className="btn-remove-step"
                                    onClick={() => {
                                      setSelectedAttachDocumentIds(prev => prev.filter(id => id !== docId));
                                    }}
                                  >
                                    삭제
                                  </button>
                                </div>
                              );
                            })}
                          </div>
                        )}
                        <div className="user-table-container">
                          <div className="user-table-header">
                            <span>문서 목록 (더블클릭하여 결재할 문서 선택)</span>
                            <span className="user-count">총 {availableDocuments.filter(d => !selectedAttachDocumentIds.includes(d.id) && (documentId ? d.id !== documentId : true)).length}개</span>
                          </div>
                          {isLoadingDocuments ? (
                            <div className="loading-documents" style={{ padding: '20px', textAlign: 'center' }}>
                              문서 목록 로딩 중...
                            </div>
                          ) : (
                            <div className="user-table">
                              <div className="user-table-row user-table-header-row">
                                <div className="user-table-cell" style={{ width: '50px' }}>#</div>
                                <div className="user-table-cell" style={{ flex: 2 }}>문서명</div>
                                <div className="user-table-cell" style={{ flex: 1 }}>유형</div>
                              </div>
                              {availableDocuments
                                .filter(doc => !selectedAttachDocumentIds.includes(doc.id) && (documentId ? doc.id !== documentId : true))
                                .map((doc, index) => (
                                  <div
                                    key={doc.id}
                                    className="user-table-row user-table-data-row"
                                    onDoubleClick={() => {
                                      if (!selectedAttachDocumentIds.includes(doc.id)) {
                                        setSelectedAttachDocumentIds(prev => [...prev, doc.id]);
                                      }
                                    }}
                                  >
                                    <div className="user-table-cell" style={{ width: '50px' }}>{index + 1}</div>
                                    <div className="user-table-cell" style={{ flex: 2 }}>{doc.title}</div>
                                    <div className="user-table-cell" style={{ flex: 1 }}>
                                      <span style={{ 
                                        padding: '4px 8px', 
                                        borderRadius: '4px',
                                        fontSize: '12px',
                                        backgroundColor: doc.documentType === 'personal' ? '#e3f2fd' : '#f3e5f5',
                                        color: doc.documentType === 'personal' ? '#1976d2' : '#7b1fa2'
                                      }}>
                                        {doc.documentType === 'personal' ? '개인' : '공유'}
                                      </span>
                                    </div>
                                  </div>
                                ))}
                              {availableDocuments.filter(doc => !selectedAttachDocumentIds.includes(doc.id) && (documentId ? doc.id !== documentId : true)).length === 0 && (
                                <div className="user-table-row">
                                  <div className="user-table-cell" style={{ width: '100%', textAlign: 'center', padding: '20px' }}>
                                    추가할 수 있는 문서가 없습니다.
                                  </div>
                                </div>
                              )}
                            </div>
                          )}
                        </div>
                        {documentId && !selectedAttachDocumentIds.includes(documentId) && (
                          <p className="form-hint" style={{ marginTop: '8px' }}>
                            현재 문서: {documentTitle || '문서'} (테이블에서 더블클릭하여 추가 가능)
                          </p>
                        )}
                      </>
                    )}
                  </div>
                )}
              </div>
            )}

            {step === 'editor' && (
              <div className="form-section">
                <div className="form-group">
                  <label>결재 문서 제목 *</label>
                  <input
                    type="text"
                    className="form-input"
                    value={workflowTitle}
                    onChange={(e) => setWorkflowTitle(e.target.value)}
                    placeholder="결재 문서 제목을 입력하세요"
                  />
                </div>

                <div className="form-group">
                  <label>결재 문서 내용</label>
                  <WorkflowEditor
                    value={workflowContent}
                    onChange={setWorkflowContent}
                    placeholder="결재 문서 내용을 입력하세요..."
                  />
                </div>
              </div>
            )}

            {step === 'lines' && (
              <div className="form-section">
                <div style={{ marginBottom: '16px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <p style={{ margin: 0, color: 'var(--text-medium)' }}>
                    템플릿을 선택하여 검토 라인과 결재 라인을 자동으로 설정할 수 있습니다.
                  </p>
                  <button
                    type="button"
                    className="btn-secondary"
                    onClick={() => setIsTemplateModalOpen(true)}
                    style={{ padding: '8px 16px', fontSize: '14px' }}
                  >
                    템플릿 선택
                  </button>
                </div>
                
                <div className="line-section">
                  <div className="line-header">
                    <h3>검토 라인 *</h3>
                  </div>
                  {reviewLine.length > 0 && (
                    <div className="added-users-list">
                      {reviewLine.map((step, index) => (
                        <div key={index} className="added-user-item">
                          <span className="step-number-small">{step.step}</span>
                          <span className="user-info">{step.name} ({step.email})</span>
                          <button
                            type="button"
                            className="btn-remove-step"
                            onClick={() => removeReviewStep(index)}
                          >
                            삭제
                          </button>
                        </div>
                      ))}
                    </div>
                  )}
                  <div className="user-table-container">
                    <div className="user-table-header">
                      <span>회원 목록 (더블클릭하여 검토 라인에 추가)</span>
                      <span className="user-count">총 {users.filter(u => !reviewLine.some(r => r.email === u.email)).length}명</span>
                    </div>
                    <div className="user-table">
                      <div className="user-table-row user-table-header-row">
                        <div className="user-table-cell" style={{ width: '50px' }}>#</div>
                        <div className="user-table-cell" style={{ flex: 1 }}>이름</div>
                        <div className="user-table-cell" style={{ flex: 2 }}>이메일</div>
                      </div>
                      {users
                        .filter(u => !reviewLine.some(r => r.email === u.email))
                        .map((user, index) => (
                          <div
                            key={user.email}
                            className="user-table-row user-table-data-row"
                            onDoubleClick={() => {
                              const maxStep = reviewLine.length > 0 ? Math.max(...reviewLine.map(r => r.step)) : 0;
                              const newStep: WorkflowLineStep = {
                                step: maxStep + 1,
                                email: user.email,
                                name: user.name,
                                status: '대기'
                              };
                              setReviewLine([...reviewLine, newStep]);
                            }}
                          >
                            <div className="user-table-cell" style={{ width: '50px' }}>{index + 1}</div>
                            <div className="user-table-cell" style={{ flex: 1 }}>{user.name}</div>
                            <div className="user-table-cell" style={{ flex: 2 }}>{user.email}</div>
                          </div>
                        ))}
                      {users.filter(u => !reviewLine.some(r => r.email === u.email)).length === 0 && (
                        <div className="user-table-row">
                          <div className="user-table-cell" style={{ width: '100%', textAlign: 'center', padding: '20px' }}>
                            추가할 수 있는 회원이 없습니다.
                          </div>
                        </div>
                      )}
                    </div>
                  </div>
                </div>

                <div className="line-section" style={{ marginTop: '32px' }}>
                  <div className="line-header">
                    <h3>결재 라인 *</h3>
                  </div>
                  {paymentLine.length > 0 && (
                    <div className="added-users-list">
                      {paymentLine.map((step, index) => (
                        <div key={index} className="added-user-item">
                          <span className="step-number-small">{step.step}</span>
                          <span className="user-info">{step.name} ({step.email})</span>
                          <button
                            type="button"
                            className="btn-remove-step"
                            onClick={() => removePaymentStep(index)}
                          >
                            삭제
                          </button>
                        </div>
                      ))}
                    </div>
                  )}
                  <div className="user-table-container">
                    <div className="user-table-header">
                      <span>회원 목록 (더블클릭하여 결재 라인에 추가)</span>
                      <span className="user-count">총 {users.filter(u => !paymentLine.some(p => p.email === u.email)).length}명</span>
                    </div>
                    <div className="user-table">
                      <div className="user-table-row user-table-header-row">
                        <div className="user-table-cell" style={{ width: '50px' }}>#</div>
                        <div className="user-table-cell" style={{ flex: 1 }}>이름</div>
                        <div className="user-table-cell" style={{ flex: 2 }}>이메일</div>
                      </div>
                      {users
                        .filter(u => !paymentLine.some(p => p.email === u.email))
                        .map((user, index) => (
                          <div
                            key={user.email}
                            className="user-table-row user-table-data-row"
                            onDoubleClick={() => {
                              const maxStep = paymentLine.length > 0 ? Math.max(...paymentLine.map(p => p.step)) : 0;
                              const newStep: WorkflowLineStep = {
                                step: maxStep + 1,
                                email: user.email,
                                name: user.name,
                                status: '대기'
                              };
                              setPaymentLine([...paymentLine, newStep]);
                            }}
                          >
                            <div className="user-table-cell" style={{ width: '50px' }}>{index + 1}</div>
                            <div className="user-table-cell" style={{ flex: 1 }}>{user.name}</div>
                            <div className="user-table-cell" style={{ flex: 2 }}>{user.email}</div>
                          </div>
                        ))}
                      {users.filter(u => !paymentLine.some(p => p.email === u.email)).length === 0 && (
                        <div className="user-table-row">
                          <div className="user-table-cell" style={{ width: '100%', textAlign: 'center', padding: '20px' }}>
                            추가할 수 있는 회원이 없습니다.
                          </div>
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              </div>
            )}

            <div className="modal-footer">
              <button
                type="button"
                className="btn-secondary"
                onClick={step === 'options' ? onClose : handleBack}
                disabled={isLoading}
              >
                {step === 'options' ? '취소' : '이전'}
              </button>
              <button
                type="button"
                className="btn-primary"
                onClick={step === 'lines' ? handleSubmit : handleNext}
                disabled={isLoading}
              >
                {isLoading ? '처리 중...' : step === 'lines' ? '요청' : '다음'}
              </button>
            </div>
          </div>
        </div>
      </div>

      {notification && (
        <NotificationModal
          isOpen={true}
          message={notification.message}
          type={notification.type}
          onClose={() => setNotification(null)}
          duration={notification.type === 'success' ? 2000 : 3000}
        />
      )}
      
      <WorkflowTemplateModal
        isOpen={isTemplateModalOpen}
        onClose={() => setIsTemplateModalOpen(false)}
        onSelectTemplate={(template) => {
          setReviewLine(template.reviewLine);
          setPaymentLine(template.paymentLine);
          setIsTemplateModalOpen(false);
          setNotification({ message: '템플릿이 적용되었습니다.', type: 'success' });
        }}
        isAdmin={false}
      />
    </>
  );
};

export default WorkflowRequestModal;

