/**
 * WorkflowManagement.tsx
 * 결재 관리 페이지
 * 탭 3개: 내가 올린 결재, 내가 결재해야 하는 것, 결재 완료된 리스트
 */

import React, { useState, useEffect, useMemo, useRef, useCallback } from 'react';
import { apiClient } from '../utils/api/apiClient';
import WorkflowRequestModal from '../components/features/workflow/WorkflowRequestModal';
import WorkflowActionModal from '../components/features/workflow/WorkflowActionModal';
import WorkflowDetailModal from '../components/features/workflow/WorkflowDetailModal';
import WorkflowResubmitModal from '../components/features/workflow/WorkflowResubmitModal';
import WorkflowTemplateModal from '../components/features/workflow/WorkflowTemplateModal';
import type { WorkflowInfoResponse, WorkflowListResponse, WorkflowRequestResponse } from '../types/api/apiResponses';
import '../components/features/templates/TemplateUI.css';
import './WorkflowManagement.css';

interface WorkflowManagementProps {
  onPageChange?: (pageName: string) => void;
}

type TabType = 'requested' | 'pending' | 'completed';

const WorkflowManagement: React.FC<WorkflowManagementProps> = ({ onPageChange }) => {
  const [activeTab, setActiveTab] = useState<TabType>('pending');
  const [requestedWorkflows, setRequestedWorkflows] = useState<WorkflowInfoResponse[]>([]);
  const [pendingWorkflows, setPendingWorkflows] = useState<WorkflowInfoResponse[]>([]);
  const [completedWorkflows, setCompletedWorkflows] = useState<WorkflowInfoResponse[]>([]);
  const [isLoading, setIsLoading] = useState<boolean>(false);
  const [userEmail, setUserEmail] = useState<string>('');
  const [isWorkflowModalOpen, setIsWorkflowModalOpen] = useState<boolean>(false);
  const [selectedDocument, setSelectedDocument] = useState<{ id?: string; title?: string } | null>(null);
  const [isActionModalOpen, setIsActionModalOpen] = useState<boolean>(false);
  const [isDetailModalOpen, setIsDetailModalOpen] = useState<boolean>(false);
  const [isResubmitModalOpen, setIsResubmitModalOpen] = useState<boolean>(false);
  const [selectedWorkflow, setSelectedWorkflow] = useState<WorkflowInfoResponse | null>(null);
  const [actionType, setActionType] = useState<'review' | 'payment'>('review');
  const [currentStep, setCurrentStep] = useState<number>(1);
  const [isTemplateModalOpen, setIsTemplateModalOpen] = useState<boolean>(false);
  const [isAdmin, setIsAdmin] = useState<boolean>(false);
  const [tableScrollTop, setTableScrollTop] = useState(0);
  const tableScrollRef = useRef<HTMLDivElement>(null);
  const WORKFLOW_ROW_HEIGHT = 56;
  const WORKFLOW_VIRTUAL_THRESHOLD = 80;
  const WORKFLOW_VISIBLE_OVERSCAN = 5;

  useEffect(() => {
    const userInfo = typeof window !== 'undefined' ? JSON.parse(localStorage.getItem('user') || '{}') : {};
    setUserEmail(userInfo.email || '');
    setIsAdmin(userInfo.is_admin === 'O' || userInfo.isAdmin === true);
  }, []);

  // 모든 탭 데이터 한번에 로드 (초기 로드 및 userEmail 변경 시)
  useEffect(() => {
    if (!userEmail) return;

    const loadAllData = async () => {
      setIsLoading(true);
      try {
        // 모든 탭의 데이터를 병렬로 로드
        const [requestedResponse, pendingResponse, completedResponse] = await Promise.all([
          apiClient.getMyRequestedWorkflows(userEmail),
          apiClient.getMyPendingWorkflows({
            userEmail
            // 상태 필터 제거: 검토중, 결재중 모두 포함
          }),
          apiClient.getCompletedWorkflows({
            userEmail
          })
        ]);

        if (requestedResponse.success && requestedResponse.data) {
          setRequestedWorkflows(requestedResponse.data.map(item => ({
            success: true,
            ...item
          } as WorkflowInfoResponse)));
        }
        if (pendingResponse.success && pendingResponse.data) {
          setPendingWorkflows(pendingResponse.data.map(item => ({
            success: true,
            ...item
          } as WorkflowInfoResponse)));
        }
        if (completedResponse.success && completedResponse.data) {
          setCompletedWorkflows(completedResponse.data.map(item => ({
            success: true,
            ...item
          } as WorkflowInfoResponse)));
        }
      } catch (error) {
        console.error('❌ 워크플로우 데이터 로드 오류:', error);
      } finally {
        setIsLoading(false);
      }
    };

    loadAllData();
  }, [userEmail]);

  const getCurrentWorkflows = (): WorkflowInfoResponse[] => {
    switch (activeTab) {
      case 'requested':
        return requestedWorkflows;
      case 'pending':
        return pendingWorkflows;
      case 'completed':
        return completedWorkflows;
      default:
        return [];
    }
  };

  // 필터링된 워크플로우 목록
  const filteredWorkflows = useMemo(() => {
    return getCurrentWorkflows();
  }, [activeTab, requestedWorkflows, pendingWorkflows, completedWorkflows]);

  const getStatusBadgeClass = (status: string): string => {
    const statusMap: Record<string, string> = {
      '대기': 'status-waiting',
      '검토중': 'status-reviewing',
      '검토완료': 'status-review-complete',
      '검토반려': 'status-review-rejected',
      '검토보류': 'status-review-hold',
      '결제중': 'status-payment',
      '결제완료': 'status-payment-complete',
      '전체반려': 'status-rejected'
    };
    return statusMap[status] || 'status-default';
  };

  const formatDate = (dateString: string): string => {
    try {
      const date = new Date(dateString);
      return date.toLocaleString('ko-KR', {
        year: 'numeric',
        month: '2-digit',
        day: '2-digit',
        hour: '2-digit',
        minute: '2-digit'
      });
    } catch {
      return dateString;
    }
  };

  const handleWorkflowClick = (workflow: WorkflowInfoResponse) => {
    // 워크플로우 상세 정보 모달 열기
    setSelectedWorkflow(workflow);
    setIsDetailModalOpen(true);
  };

  const handleActionClick = (workflow: WorkflowInfoResponse, type: 'review' | 'payment', step: number, e: React.MouseEvent) => {
    e.stopPropagation();
    setSelectedWorkflow(workflow);
    setActionType(type);
    setCurrentStep(step);
    setIsActionModalOpen(true);
  };

  const handleResubmit = (workflow: WorkflowInfoResponse, e: React.MouseEvent) => {
    e.stopPropagation();
    setSelectedWorkflow(workflow);
    setIsResubmitModalOpen(true);
  };
  
  const handleResubmitSuccess = async () => {
    // 모든 탭 데이터 새로고침
    const [requestedRes, pendingRes, completedRes] = await Promise.all([
      apiClient.getMyRequestedWorkflows(userEmail),
      apiClient.getMyPendingWorkflows({ userEmail }),
      apiClient.getCompletedWorkflows({ userEmail })
    ]);
    
    if (requestedRes.success && requestedRes.data) {
      setRequestedWorkflows(requestedRes.data.map(item => ({
        success: true,
        ...item
      } as WorkflowInfoResponse)));
    }
    if (pendingRes.success && pendingRes.data) {
      setPendingWorkflows(pendingRes.data.map(item => ({
        success: true,
        ...item
      } as WorkflowInfoResponse)));
    }
    if (completedRes.success && completedRes.data) {
      setCompletedWorkflows(completedRes.data.map(item => ({
        success: true,
        ...item
      } as WorkflowInfoResponse)));
    }
  };

  const handleActionSuccess = () => {
    // 액션 성공 시 모든 탭 데이터 갱신
    const loadAllData = async () => {
      setIsLoading(true);
      try {
        // 모든 탭의 데이터를 병렬로 로드
        const [requestedResponse, pendingResponse, completedResponse] = await Promise.all([
          apiClient.getMyRequestedWorkflows(userEmail),
          apiClient.getMyPendingWorkflows({
            userEmail
            // 상태 필터 제거: 검토중, 결재중 모두 포함
          }),
          apiClient.getCompletedWorkflows({
            userEmail
          })
        ]);

        if (requestedResponse.success && requestedResponse.data) {
          setRequestedWorkflows(requestedResponse.data.map(item => ({
            success: true,
            ...item
          } as WorkflowInfoResponse)));
        }
        if (pendingResponse.success && pendingResponse.data) {
          setPendingWorkflows(pendingResponse.data.map(item => ({
            success: true,
            ...item
          } as WorkflowInfoResponse)));
        }
        if (completedResponse.success && completedResponse.data) {
          setCompletedWorkflows(completedResponse.data.map(item => ({
            success: true,
            ...item
          } as WorkflowInfoResponse)));
        }
      } catch (error) {
        console.error('❌ 워크플로우 데이터 갱신 오류:', error);
      } finally {
        setIsLoading(false);
      }
    };
    loadAllData();
  };

  const getMyPendingStep = (workflow: WorkflowInfoResponse): { type: 'review' | 'payment'; step: number; status?: string } | null => {
    const userInfo = typeof window !== 'undefined' ? JSON.parse(localStorage.getItem('user') || '{}') : {};
    const email = userInfo.email || userEmail;
    
    // 검토 라인 확인 (대기 또는 보류 상태)
    const reviewStep = workflow.reviewLine.find(r => 
      r.email === email && (r.status === '대기' || r.status === '보류')
    );
    if (reviewStep) {
      return { type: 'review', step: reviewStep.step, status: reviewStep.status };
    }
    
    // 결재 라인 확인 (대기 또는 보류 상태)
    const paymentStep = workflow.paymentLine.find(p => 
      p.email === email && (p.status === '대기' || p.status === '보류')
    );
    if (paymentStep) {
      return { type: 'payment', step: paymentStep.step, status: paymentStep.status };
    }
    
    return null;
  };

  const getHeldStep = (workflow: WorkflowInfoResponse): { type: 'review' | 'payment'; step: number } | null => {
    // 보류된 단계 찾기 (요청자가 재개 가능)
    const reviewHeldStep = workflow.reviewLine.find(r => r.status === '보류');
    if (reviewHeldStep) {
      return { type: 'review', step: reviewHeldStep.step };
    }
    
    const paymentHeldStep = workflow.paymentLine.find(p => p.status === '보류');
    if (paymentHeldStep) {
      return { type: 'payment', step: paymentHeldStep.step };
    }
    
    return null;
  };

  const workflows = getCurrentWorkflows();

  const getTabLabel = (tab: TabType): string => {
    switch (tab) {
      case 'requested':
        return '내가 올린 결재';
      case 'pending':
        return '내가 결재해야 하는 것';
      case 'completed':
        return '결재 완료된 리스트';
      default:
        return '';
    }
  };

  const getTabCount = (tab: TabType): number => {
    switch (tab) {
      case 'requested':
        return requestedWorkflows.length;
      case 'pending':
        return pendingWorkflows.length;
      case 'completed':
        return completedWorkflows.length;
      default:
        return 0;
    }
  };

  return (
    <div className="workflow-management-container">
      {/* 결재 탭 선택 창 */}
      <div className="category-tabs-wrapper">
        <div className="tabs-header">
          <div className="new-tabs-container">
            <button
              className={`new-tab ${activeTab === 'requested' ? 'new-active' : ''}`}
              onClick={() => setActiveTab('requested')}
            >
              {getTabLabel('requested')} ({getTabCount('requested')})
            </button>
            <button
              className={`new-tab ${activeTab === 'pending' ? 'new-active' : ''}`}
              onClick={() => setActiveTab('pending')}
            >
              {getTabLabel('pending')} ({getTabCount('pending')})
            </button>
            <button
              className={`new-tab ${activeTab === 'completed' ? 'new-active' : ''}`}
              onClick={() => setActiveTab('completed')}
            >
              {getTabLabel('completed')} ({getTabCount('completed')})
            </button>
          </div>
          <div className="tag-create-wrapper" style={{ display: 'flex', gap: '8px' }}>
            {isAdmin && (
              <button 
                className="tag-create-toggle"
                onClick={() => setIsTemplateModalOpen(true)}
                style={{ background: 'var(--bg-medium)', color: 'var(--text-dark)' }}
              >
                템플릿 관리
              </button>
            )}
            <button 
              className="tag-create-toggle"
              onClick={() => {
                setSelectedDocument(null);
                setIsWorkflowModalOpen(true);
              }}
            >
              새 결재 요청
            </button>
          </div>
        </div>
      </div>

      <div className="workflow-content">
        {isLoading ? (
          <div className="loading-message">로딩 중...</div>
        ) : filteredWorkflows.length === 0 ? (
          <div className="empty-message">
            {activeTab === 'requested' && '올린 결재가 없습니다.'}
            {activeTab === 'pending' && '결재해야 할 문서가 없습니다.'}
            {activeTab === 'completed' && '완료된 결재가 없습니다.'}
          </div>
        ) : (
          <div className="workflow-list-section">
            <div
              ref={tableScrollRef}
              className="workflow-table-scroll"
              style={
                filteredWorkflows.length >= WORKFLOW_VIRTUAL_THRESHOLD
                  ? { height: 420, overflow: 'auto' }
                  : undefined
              }
              onScroll={
                filteredWorkflows.length >= WORKFLOW_VIRTUAL_THRESHOLD
                  ? (e) => setTableScrollTop(e.currentTarget.scrollTop)
                  : undefined
              }
            >
            <table className="workflow-table">
              <colgroup>
                <col className="col-number-width" />
                <col className="col-title-width" />
                <col className="col-author-width" />
                <col className="col-date-width" />
                <col className="col-status-width" />
                <col className="col-progress-width" />
              </colgroup>
              <thead>
                <tr>
                  <th className="col-number">결재번호</th>
                  <th className="col-title">문서이름</th>
                  <th className="col-author">요청자</th>
                  <th className="col-date">요청일시</th>
                  <th className="col-status">상태</th>
                  <th className="col-progress">진행상황</th>
                </tr>
              </thead>
              <tbody>
                {filteredWorkflows.length >= WORKFLOW_VIRTUAL_THRESHOLD ? (() => {
                  const totalHeight = filteredWorkflows.length * WORKFLOW_ROW_HEIGHT;
                  const startIndex = Math.max(0, Math.floor(tableScrollTop / WORKFLOW_ROW_HEIGHT) - WORKFLOW_VISIBLE_OVERSCAN);
                  const visibleCount = Math.ceil(420 / WORKFLOW_ROW_HEIGHT) + WORKFLOW_VISIBLE_OVERSCAN * 2;
                  const endIndex = Math.min(filteredWorkflows.length - 1, startIndex + visibleCount);
                  const visibleWorkflows = filteredWorkflows.slice(startIndex, endIndex + 1);
                  return (
                    <>
                      {startIndex > 0 && (
                        <tr aria-hidden style={{ height: startIndex * WORKFLOW_ROW_HEIGHT }}>
                          <td colSpan={6} style={{ padding: 0, border: 'none', lineHeight: 0 }} />
                        </tr>
                      )}
                      {visibleWorkflows.map((workflow) => {
                  const myStep = activeTab === 'pending' ? getMyPendingStep(workflow) : null;
                  const heldStep = activeTab === 'requested' && (workflow.workflowStatus === '검토보류' || workflow.workflowStatus === '결재보류') ? getHeldStep(workflow) : null;
                  const documentTitle = workflow.workflowDocumentTitle || workflow.attachedDocumentTitle || workflow.documentTitle || '제목 없음';
                  const reviewProgress = `${workflow.reviewLine.filter(r => r.status === '승인').length} / ${workflow.reviewLine.length}`;
                  const paymentProgress = `${workflow.paymentLine.filter(p => p.status === '승인').length} / ${workflow.paymentLine.length}`;
                  return (
                    <tr key={workflow.workflowId} className="workflow-row" style={{ height: WORKFLOW_ROW_HEIGHT }} onClick={() => handleWorkflowClick(workflow)}>
                      <td className="col-number">{workflow.workflowId}</td>
                      <td className="col-title"><div className="title-cell-inner"><span className="title-ellipsis">{documentTitle}</span></div></td>
                      <td className="col-author">{workflow.requesterName || workflow.requesterEmail}</td>
                      <td className="col-date">{formatDate(workflow.workflowRequestDate)}</td>
                      <td className="col-status"><span className={`status-badge ${getStatusBadgeClass(workflow.workflowStatus)}`}>{workflow.workflowStatus}</span></td>
                      <td className="col-progress">
                        <div className="progress-info">
                          <span className="progress-item">검토: {reviewProgress}</span>
                          <span className="progress-item">결재: {paymentProgress}</span>
                        </div>
                        {(activeTab === 'pending' && myStep) || (activeTab === 'requested' && heldStep) || (activeTab === 'requested' && (workflow.workflowStatus === '검토반려' || workflow.workflowStatus === '전체반려') && workflow.requesterEmail === userEmail) ? (
                          <div className="workflow-row-actions" onClick={(e) => e.stopPropagation()}>
                            {activeTab === 'pending' && myStep && (
                              <button className={`btn-action ${myStep.status === '보류' ? 'btn-resume' : 'btn-approve'}`} onClick={(e) => handleActionClick(workflow, myStep.type, myStep.step, e)} title={myStep.status === '보류' ? '보류된 결재 재개' : `${myStep.type === 'review' ? '검토' : '결재'} 처리`}>
                                {myStep.status === '보류' ? '▶️ 재개' : `${myStep.type === 'review' ? '검토' : '결재'} 처리`}
                              </button>
                            )}
                            {activeTab === 'requested' && heldStep && (
                              <button className="btn-action btn-resume" onClick={(e) => handleActionClick(workflow, heldStep.type, heldStep.step, e)} title="보류된 결재 재개">▶️ 재개</button>
                            )}
                            {activeTab === 'requested' && (workflow.workflowStatus === '검토반려' || workflow.workflowStatus === '전체반려') && workflow.requesterEmail === userEmail && (
                              <button className="btn-action btn-resubmit" onClick={(e) => handleResubmit(workflow, e)} title="반려된 결재 재제출">🔄 재제출</button>
                            )}
                          </div>
                        ) : null}
                      </td>
                    </tr>
                  );
                })}
                      {endIndex < filteredWorkflows.length - 1 && (
                        <tr aria-hidden style={{ height: (filteredWorkflows.length - endIndex - 1) * WORKFLOW_ROW_HEIGHT }}>
                          <td colSpan={6} style={{ padding: 0, border: 'none', lineHeight: 0 }} />
                        </tr>
                      )}
                    </>
                  );
                })() : filteredWorkflows.map((workflow) => {
                  const myStep = activeTab === 'pending' ? getMyPendingStep(workflow) : null;
                  const heldStep = activeTab === 'requested' && (workflow.workflowStatus === '검토보류' || workflow.workflowStatus === '결재보류') ? getHeldStep(workflow) : null;
                  const documentTitle = workflow.workflowDocumentTitle || 
                                       workflow.attachedDocumentTitle || 
                                       workflow.documentTitle || 
                                       '제목 없음';
                  const reviewProgress = `${workflow.reviewLine.filter(r => r.status === '승인').length} / ${workflow.reviewLine.length}`;
                  const paymentProgress = `${workflow.paymentLine.filter(p => p.status === '승인').length} / ${workflow.paymentLine.length}`;
                  
                  return (
                    <tr
                      key={workflow.workflowId}
                      className="workflow-row"
                      onClick={() => handleWorkflowClick(workflow)}
                    >
                      <td className="col-number">{workflow.workflowId}</td>
                      <td className="col-title">
                        <div className="title-cell-inner">
                          <span className="title-ellipsis">{documentTitle}</span>
                        </div>
                      </td>
                      <td className="col-author">{workflow.requesterName || workflow.requesterEmail}</td>
                      <td className="col-date">{formatDate(workflow.workflowRequestDate)}</td>
                      <td className="col-status">
                        <span className={`status-badge ${getStatusBadgeClass(workflow.workflowStatus)}`}>
                          {workflow.workflowStatus}
                        </span>
                      </td>
                      <td className="col-progress">
                        <div className="progress-info">
                          <span className="progress-item">검토: {reviewProgress}</span>
                          <span className="progress-item">결재: {paymentProgress}</span>
                        </div>
                        {(activeTab === 'pending' && myStep) || 
                         (activeTab === 'requested' && heldStep) ||
                         (activeTab === 'requested' && 
                          (workflow.workflowStatus === '검토반려' || workflow.workflowStatus === '전체반려') &&
                          workflow.requesterEmail === userEmail) ? (
                          <div className="workflow-row-actions" onClick={(e) => e.stopPropagation()}>
                            {activeTab === 'pending' && myStep && (
                              <button
                                className={`btn-action ${myStep.status === '보류' ? 'btn-resume' : 'btn-approve'}`}
                                onClick={(e) => handleActionClick(workflow, myStep.type, myStep.step, e)}
                                title={myStep.status === '보류' ? '보류된 결재 재개' : `${myStep.type === 'review' ? '검토' : '결재'} 처리`}
                              >
                                {myStep.status === '보류' ? '▶️ 재개' : `${myStep.type === 'review' ? '검토' : '결재'} 처리`}
                              </button>
                            )}
                            {activeTab === 'requested' && heldStep && (
                              <button
                                className="btn-action btn-resume"
                                onClick={(e) => handleActionClick(workflow, heldStep.type, heldStep.step, e)}
                                title="보류된 결재 재개"
                              >
                                ▶️ 재개
                              </button>
                            )}
                            {activeTab === 'requested' && 
                             (workflow.workflowStatus === '검토반려' || workflow.workflowStatus === '전체반려') &&
                             workflow.requesterEmail === userEmail && (
                              <button
                                className="btn-action btn-resubmit"
                                onClick={(e) => handleResubmit(workflow, e)}
                                title="반려된 결재 재제출"
                              >
                                🔄 재제출
                              </button>
                            )}
                          </div>
                        ) : null}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
            </div>
          </div>
        )}
      </div>
      
      <WorkflowRequestModal
        isOpen={isWorkflowModalOpen}
        onClose={() => {
          setIsWorkflowModalOpen(false);
          setSelectedDocument(null);
        }}
        documentId={selectedDocument?.id}
        documentTitle={selectedDocument?.title}
        onSuccess={(response: WorkflowRequestResponse) => {
          console.log('✅ 결재 요청 성공:', response);
          // 모든 탭 데이터 갱신
          Promise.all([
            apiClient.getMyRequestedWorkflows(userEmail),
            apiClient.getMyPendingWorkflows({ userEmail }),
            apiClient.getCompletedWorkflows({ userEmail })
          ]).then(([requestedRes, pendingRes, completedRes]) => {
            if (requestedRes.success && requestedRes.data) {
              setRequestedWorkflows(requestedRes.data.map(item => ({
                success: true,
                ...item
              } as WorkflowInfoResponse)));
            }
            if (pendingRes.success && pendingRes.data) {
              setPendingWorkflows(pendingRes.data.map(item => ({
                success: true,
                ...item
              } as WorkflowInfoResponse)));
            }
            if (completedRes.success && completedRes.data) {
              setCompletedWorkflows(completedRes.data.map(item => ({
                success: true,
                ...item
              } as WorkflowInfoResponse)));
            }
          });
        }}
      />

      <WorkflowActionModal
        isOpen={isActionModalOpen}
        onClose={() => {
          setIsActionModalOpen(false);
          setSelectedWorkflow(null);
        }}
        workflow={selectedWorkflow}
        actionType={actionType}
        currentStep={currentStep}
        userEmail={userEmail}
        userName={typeof window !== 'undefined' ? JSON.parse(localStorage.getItem('user') || '{}').name || '' : ''}
        onSuccess={handleActionSuccess}
      />

      <WorkflowDetailModal
        isOpen={isDetailModalOpen}
        onClose={() => {
          setIsDetailModalOpen(false);
          setSelectedWorkflow(null);
        }}
        workflow={selectedWorkflow}
      />
      
      <WorkflowResubmitModal
        isOpen={isResubmitModalOpen}
        onClose={() => {
          setIsResubmitModalOpen(false);
          setSelectedWorkflow(null);
        }}
        workflow={selectedWorkflow}
        onSuccess={handleResubmitSuccess}
      />
      
      <WorkflowTemplateModal
        isOpen={isTemplateModalOpen}
        onClose={() => setIsTemplateModalOpen(false)}
        isAdmin={isAdmin}
      />
    </div>
  );
};

export default WorkflowManagement;

