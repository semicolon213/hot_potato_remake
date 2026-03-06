import { useState, useMemo, useEffect, useCallback } from "react";
import { useTemplateUI, defaultTemplates, defaultTemplateTags } from "../hooks/features/templates/useTemplateUI";
import type { Template } from "../hooks/features/templates/useTemplateUI";
import { ENV_CONFIG } from "../config/environment";
import { apiClient } from "../utils/api/apiClient";
import { useNotification } from "../hooks/ui/useNotification";
import { NotificationModal, ConfirmModal } from "../components/ui/NotificationModal";
import type { TagImpactCheckResponse, DeleteTagResponse, CreateDocumentResponse, TemplateInfo } from "../types/api/apiResponses";
import { 
    addTag as addPersonalTag,
    deleteTag as deletePersonalTag,
    updateTag as updatePersonalTag,
    fetchTags as fetchPersonalTags
} from "../utils/database/personalTagManager";
import { BiLoaderAlt } from "react-icons/bi";
import { FaFolderOpen, FaFile } from "react-icons/fa";
import EmailAutocomplete from "../components/ui/common/EmailAutocomplete";
import "../components/features/templates/TemplateUI.css";
import "../styles/pages/NewDocument.css";
import {
    DndContext,
    closestCorners,
    KeyboardSensor,
    PointerSensor,
    useSensor,
    useSensors,
} from '@dnd-kit/core';
import type { DragEndEvent } from '@dnd-kit/core';
import {
    arrayMove,
    SortableContext,
    sortableKeyboardCoordinates,
    rectSortingStrategy,
} from '@dnd-kit/sortable';
import type { TemplateData } from '../types/documents';

// UI Components
import {
    CategoryTabs,
    TemplateList,
  } from "../components/features/templates";
  import { SortableTemplateCard } from "../components/features/templates/SortableTemplateCard";
  import StudentDetailModal from "../components/ui/StudentDetailModal";

interface TemplatePageProps {
  onPageChange: (pageName: string) => void;
  tags: string[];
  addTag: (newTag: string) => void;
  deleteTag: (tagToDelete: string) => void;
  updateTag: (oldTag: string, newTag: string) => void;
  isTemplatesLoading?: boolean;
}

function NewDocument({ 
    onPageChange, 
    tags, 
    addTag, 
    deleteTag, 
    updateTag, 
    isTemplatesLoading
}: TemplatePageProps) {
    
    // Lifted state for global search and filter
    const [searchTerm, setSearchTerm] = useState("");
    const [activeTab, setActiveTab] = useState("전체");
    
    // 기본 태그 상태 (Apps Script에서 로드)
    const [staticTags, setStaticTags] = useState<string[]>([]);
    const [isLoadingStaticTags, setIsLoadingStaticTags] = useState(false);
    
    // 관리자 여부 확인
    const userInfo = JSON.parse(localStorage.getItem('user') || '{}');
    const isAdminUser = userInfo?.is_admin === 'O' || userInfo?.isAdmin === true;
    
    // 알림 모달 훅
    const {
        notification,
        confirm,
        showNotification,
        hideNotification,
        showConfirm,
        hideConfirm,
        handleConfirm
    } = useNotification();
    
    // 기본 태그 추가 핸들러 (관리자 전용)
    const handleAddStaticTag = async (newTag: string) => {
        if (!isAdminUser) {
            showNotification('기본 태그는 관리자만 추가할 수 있습니다.', 'warning');
            return;
        }
        
        if (newTag && !staticTags.includes(newTag)) {
            try {
                const response = await apiClient.addStaticTag(newTag);
                if (response.success) {
                    // 기본 태그 목록 다시 로드
                    const updatedResponse = await apiClient.getStaticTags();
                    if (updatedResponse.success && updatedResponse.data) {
                        setStaticTags(updatedResponse.data);
                    }
                    showNotification('기본 태그가 추가되었습니다.', 'success');
                } else {
                    showNotification('기본 태그 추가에 실패했습니다: ' + (response.message || '알 수 없는 오류'), 'error');
                }
            } catch (error) {
                console.error('Error adding static tag:', error);
                showNotification('기본 태그 추가 중 오류가 발생했습니다.', 'error');
            }
        } else if (staticTags.includes(newTag)) {
            showNotification('이미 존재하는 기본 태그입니다.', 'warning');
        }
    };

    // 기본 태그 수정 핸들러 (관리자 전용)
    const handleUpdateStaticTag = async (oldTag: string, newTag: string) => {
        if (!isAdminUser) {
            showNotification('기본 태그는 관리자만 수정할 수 있습니다.', 'warning');
            return;
        }
        
        if (!oldTag || !newTag || oldTag === newTag) {
            return;
        }

        try {
            // 먼저 영향 받는 템플릿 목록 확인
            const checkResponse = await apiClient.updateStaticTag(oldTag, newTag, false);
            if (!checkResponse.success || !checkResponse.data) {
                showNotification('영향 받는 템플릿 확인 중 오류가 발생했습니다.', 'error');
                return;
            }
            
            const impactData = checkResponse.data as TagImpactCheckResponse;
            const affectedShared = impactData.affectedSharedTemplates || [];
            const affectedPersonal = impactData.affectedPersonalTemplates || [];
            const totalAffected = affectedShared.length + affectedPersonal.length;
            
            if (totalAffected > 0) {
                // 영향 받는 템플릿 목록 작성
                let templateList = '';
                if (affectedShared.length > 0) {
                    templateList += '\n\n[기본 템플릿]\n';
                    affectedShared.forEach((t: TemplateInfo) => {
                        templateList += `  • ${t.name}\n`;
                    });
                }
                if (affectedPersonal.length > 0) {
                    templateList += '\n[개인 템플릿]\n';
                    affectedPersonal.forEach((t: TemplateInfo) => {
                        templateList += `  • ${t.name}\n`;
                    });
                }
                
                const confirmMessage = `'${oldTag}' 태그를 '${newTag}'로 수정하면 다음 템플릿들의 태그도 함께 변경됩니다:${templateList}\n정말로 수정하시겠습니까?`;
                
                showConfirm(
                    confirmMessage,
                    async () => {
                        // 실제 수정 수행
                        const response = await apiClient.updateStaticTag(oldTag, newTag, true);
                        if (response.success) {
                            // 기본 태그 목록 다시 로드
                            const updatedResponse = await apiClient.getStaticTags();
                            if (updatedResponse.success && updatedResponse.data) {
                                setStaticTags(updatedResponse.data);
                            }
                            // 템플릿 목록 다시 로드 (태그 수정이 템플릿에 반영되었으므로)
                            await loadDynamicTemplates();
                            showNotification('기본 태그가 수정되었습니다.', 'success');
                        } else {
                            showNotification('기본 태그 수정에 실패했습니다: ' + (response.message || '알 수 없는 오류'), 'error');
                        }
                    },
                    { type: 'warning' }
                );
                return;
            }
            
            // 영향받는 템플릿이 없으면 바로 수정
            const response = await apiClient.updateStaticTag(oldTag, newTag, true);
            if (response.success) {
                // 기본 태그 목록 다시 로드
                const updatedResponse = await apiClient.getStaticTags();
                if (updatedResponse.success && updatedResponse.data) {
                    setStaticTags(updatedResponse.data);
                }
                // 템플릿 목록 다시 로드 (태그 수정이 템플릿에 반영되었으므로)
                await loadDynamicTemplates();
                showNotification('기본 태그가 수정되었습니다.', 'success');
            } else {
                showNotification('기본 태그 수정에 실패했습니다: ' + (response.message || '알 수 없는 오류'), 'error');
            }
        } catch (error) {
            console.error('Error updating static tag:', error);
            showNotification('기본 태그 수정 중 오류가 발생했습니다.', 'error');
        }
    };

    // 기본 태그 삭제 핸들러 (관리자 전용)
    const handleDeleteStaticTag = async (tagToDelete: string) => {
        if (!isAdminUser) {
            showNotification('기본 태그는 관리자만 삭제할 수 있습니다.', 'warning');
            return;
        }

        try {
            // 먼저 영향 받는 템플릿 목록 확인
            const checkResponse = await apiClient.deleteStaticTag(tagToDelete, false, false);
            if (!checkResponse.success || !checkResponse.data) {
                showNotification('영향 받는 템플릿 확인 중 오류가 발생했습니다.', 'error');
                return;
            }
            
            const impactData = checkResponse.data as TagImpactCheckResponse;
            const affectedShared = impactData.affectedSharedTemplates || [];
            const affectedPersonal = impactData.affectedPersonalTemplates || [];
            const totalAffected = affectedShared.length + affectedPersonal.length;
            
            if (totalAffected > 0) {
                // 영향 받는 템플릿 목록 작성
                let templateList = '';
                if (affectedShared.length > 0) {
                    templateList += '\n\n[기본 템플릿]\n';
                    affectedShared.forEach((t: TemplateInfo) => {
                        templateList += `  • ${t.name}\n`;
                    });
                }
                if (affectedPersonal.length > 0) {
                    templateList += '\n[개인 템플릿]\n';
                    affectedPersonal.forEach((t: TemplateInfo) => {
                        templateList += `  • ${t.name}\n`;
                    });
                }
                
                const confirmMessage = `'${tagToDelete}' 태그를 삭제하면 다음 템플릿들이 영향받습니다:${templateList}\n\n템플릿도 함께 삭제하시겠습니까?\n(취소를 누르면 개인 템플릿은 "기본" 태그로 변경됩니다)`;
                
                showConfirm(
                    confirmMessage,
                    async () => {
                        // 확인: 템플릿도 함께 삭제
                        const response = await apiClient.deleteStaticTag(tagToDelete, true, true);
                        if (response.success) {
                            const updatedResponse = await apiClient.getStaticTags();
                            if (updatedResponse.success && updatedResponse.data) {
                                setStaticTags(updatedResponse.data);
                            }
                            await loadDynamicTemplates();
                            
                            const deleteResponse = response.data as DeleteTagResponse;
                            if (deleteResponse) {
                                const deletedCount = (deleteResponse.deletedSharedTemplates || 0) + (deleteResponse.deletedPersonalTemplates || 0);
                                if (deletedCount > 0) {
                                    showNotification(`기본 태그가 삭제되었습니다.\n${deletedCount}개의 템플릿도 함께 삭제되었습니다.`, 'success');
                                } else {
                                    showNotification('기본 태그가 삭제되었습니다.', 'success');
                                }
                            } else {
                                showNotification('기본 태그가 삭제되었습니다.', 'success');
                            }
                        } else {
                            showNotification('기본 태그 삭제에 실패했습니다: ' + (response.message || '알 수 없는 오류'), 'error');
                        }
                    },
                    {
                        type: 'danger',
                        confirmText: '템플릿도 삭제',
                        cancelText: '태그만 삭제',
                        onCancel: async () => {
                            // 취소: 태그만 삭제 (개인 템플릿은 "기본"으로 변경)
                            const response = await apiClient.deleteStaticTag(tagToDelete, true, false);
                            if (response.success) {
                                const updatedResponse = await apiClient.getStaticTags();
                                if (updatedResponse.success && updatedResponse.data) {
                                    setStaticTags(updatedResponse.data);
                                }
                                await loadDynamicTemplates();
                                
                                const deleteResponse = response.data as DeleteTagResponse;
                                if (deleteResponse && deleteResponse.updatedPersonalTemplates && deleteResponse.updatedPersonalTemplates > 0) {
                                    showNotification(`기본 태그가 삭제되었습니다.\n${deleteResponse.updatedPersonalTemplates}개의 개인 템플릿이 "기본" 태그로 변경되었습니다.`, 'success');
                                } else {
                                    showNotification('기본 태그가 삭제되었습니다.', 'success');
                                }
                            } else {
                                showNotification('기본 태그 삭제에 실패했습니다: ' + (response.message || '알 수 없는 오류'), 'error');
                            }
                        }
                    }
                );
                return;
            } else {
                // 영향 받는 템플릿이 없으면 바로 삭제 확인
                showConfirm(
                    `기본 태그 "${tagToDelete}"를 삭제하시겠습니까?`,
                    async () => {
                        const response = await apiClient.deleteStaticTag(tagToDelete, true, false);
                        if (response.success) {
                            const updatedResponse = await apiClient.getStaticTags();
                            if (updatedResponse.success && updatedResponse.data) {
                                setStaticTags(updatedResponse.data);
                            }
                            showNotification('기본 태그가 삭제되었습니다.', 'success');
                        } else {
                            showNotification('기본 태그 삭제에 실패했습니다: ' + (response.message || '알 수 없는 오류'), 'error');
                        }
                    },
                    { type: 'warning' }
                );
            }
        } catch (error) {
            console.error('Error deleting static tag:', error);
            showNotification('기본 태그 삭제 중 오류가 발생했습니다.', 'error');
        }
    };

    // 개인 태그 추가 핸들러
    const handleAddTag = async (newTag: string) => {
        if (newTag && !tags.includes(newTag)) {
            try {
                const success = await addPersonalTag(newTag);
                if (success) {
                    // 태그 목록을 다시 로드
                    const updatedTags = await fetchPersonalTags();
                    setTags(updatedTags);
                } else {
                    console.log('태그 추가에 실패했습니다.');
                }
            } catch (error) {
                console.error('Error saving tag:', error);
                console.log('태그 저장 중 오류가 발생했습니다.');
            }
        }
    };

    // 개인 태그 삭제 핸들러
    const handleDeleteTag = async (tagToDelete: string) => {
        try {
            const { checkTagDeletionImpact } = await import('../utils/database/personalTagManager');
            
            // 태그 삭제 시 영향받는 개인 양식들 확인
            const impact = await checkTagDeletionImpact(tagToDelete);
            
            const confirmMessage = impact.affectedFiles.length > 0
                ? `'${tagToDelete}' 태그를 삭제하면 다음 개인 양식들도 함께 삭제됩니다:\n\n${impact.affectedFiles.map(file => `• ${file}`).join('\n')}\n\n정말로 삭제하시겠습니까?`
                : `'${tagToDelete}' 태그를 삭제하시겠습니까?`;
            
            showConfirm(
                confirmMessage,
                async () => {
                    const success = await deletePersonalTag(tagToDelete);
                    if (success) {
                        const updatedTags = await fetchPersonalTags();
                        setTags(updatedTags);
                        showNotification('태그가 삭제되었습니다.', 'success');
                    } else {
                        showNotification('태그 삭제에 실패했습니다.', 'error');
                    }
                },
                { type: 'warning' }
            );
        } catch (error) {
            console.error('Error deleting tag:', error);
            showNotification('태그 삭제 중 오류가 발생했습니다.', 'error');
        }
    };

    // 개인 태그 수정 핸들러
    const handleUpdateTag = async (oldTag: string, newTag: string) => {
        if (!oldTag || !newTag || oldTag === newTag) {
            return;
        }

        try {
            const { checkTagUpdateImpact, updatePersonalTemplateMetadata } = await import('../utils/database/personalTagManager');
            
            const impact = await checkTagUpdateImpact(oldTag, newTag);
            
            if (impact.affectedFiles.length > 0) {
                const affectedFilesList = impact.affectedFiles.map(file => `• ${file}`).join('\n');
                const confirmMessage = `'${oldTag}' 태그를 '${newTag}'로 수정하면 다음 개인 양식들의 파일명도 함께 변경됩니다:\n\n${affectedFilesList}\n\n정말로 수정하시겠습니까?`;
                
                showConfirm(
                    confirmMessage,
                    async () => {
                        const success = await updatePersonalTag(oldTag, newTag);
                        if (success) {
                            // 개인 템플릿 메타데이터 업데이트
                            await updatePersonalTemplateMetadata(oldTag, newTag);
                            
                            const updatedTags = await fetchPersonalTags();
                            setTags(updatedTags);
                            showNotification('태그가 수정되었습니다.', 'success');
                        } else {
                            showNotification('태그 수정에 실패했습니다.', 'error');
                        }
                    },
                    { type: 'warning' }
                );
                return;
            }

            // 영향받는 파일이 없으면 바로 수정
            const success = await updatePersonalTag(oldTag, newTag);
            if (success) {
                const updatedTags = await fetchPersonalTags();
                setTags(updatedTags);
                showNotification('태그가 수정되었습니다.', 'success');
            } else {
                showNotification('태그 수정에 실패했습니다.', 'error');
            }
        } catch (error) {
            console.error('Error updating tag:', error);
            showNotification('태그 수정 중 오류가 발생했습니다.', 'error');
        }
    };

    // 기본 템플릿 삭제 핸들러 (관리자 전용)
    const handleDeleteDefaultTemplate = async (template: Template) => {
        if (!isAdminUser) {
            showNotification('기본 템플릿 삭제는 관리자만 가능합니다.', 'warning');
            return;
        }
        
        // "빈 문서" 템플릿은 삭제 불가
        if (template.type === 'empty' || template.title === '빈 문서') {
            showNotification('빈 문서 템플릿은 삭제할 수 없습니다.', 'warning');
            return;
        }
        
        if (!template.documentId) {
            showNotification('템플릿을 찾을 수 없습니다.', 'error');
            return;
        }
        
        try {
            const response = await apiClient.deleteSharedTemplate(template.documentId);
            if (response.success) {
                // 템플릿 목록 다시 로드
                await loadDynamicTemplates();
                showNotification('기본 템플릿이 삭제되었습니다.', 'success');
            } else {
                showNotification('기본 템플릿 삭제에 실패했습니다: ' + (response.message || '알 수 없는 오류'), 'error');
            }
        } catch (error) {
            console.error('Error deleting default template:', error);
            showNotification('기본 템플릿 삭제 중 오류가 발생했습니다.', 'error');
        }
    };
    
    // 개인 템플릿 삭제 핸들러
    const handleDeletePersonalTemplate = async (template: Template) => {
        if (!template.documentId) {
            showNotification('템플릿을 찾을 수 없습니다.', 'error');
            return;
        }
        
        try {
            // Google Drive API로 파일 삭제
            await gapi.client.drive.files.delete({
                fileId: template.documentId
            });
            
            // 템플릿 목록 다시 로드 (페이지 새로고침 없이)
            if (loadPersonalTemplates) {
                await loadPersonalTemplates();
            }
            
            showNotification('개인 템플릿이 삭제되었습니다.', 'success');
        } catch (error) {
            console.error('Error deleting personal template:', error);
            showNotification('개인 템플릿 삭제 중 오류가 발생했습니다.', 'error');
        }
    };

    // 파일명 입력 모달 상태
    const [showFileNameModal, setShowFileNameModal] = useState(false);
    const [documentTitle, setDocumentTitle] = useState("");
    
    // 문서 생성 후 선택 모달 상태
    const [showAfterCreateModal, setShowAfterCreateModal] = useState(false);
    const [createdDocumentUrl, setCreatedDocumentUrl] = useState("");
    
    // 문서 생성 중 상태
    const [isCreating, setIsCreating] = useState(false);
    
    // 템플릿 생성 중 상태
    const [isCreatingTemplate, setIsCreatingTemplate] = useState(false);
    
    
    const openPermissionModal = () => {
        setShowFileNameModal(false);
        setIsPermissionModalOpen(true);
    };
    
    // 문서 생성 후 선택 모달 함수들
    const openDocument = () => {
        if (createdDocumentUrl) {
            window.open(createdDocumentUrl, '_blank');
        }
        setShowAfterCreateModal(false);
        setCreatedDocumentUrl("");
    };
    
    const goToDocumentManagement = () => {
        setShowAfterCreateModal(false);
        setCreatedDocumentUrl("");
        onPageChange('document_management');
    };
    
    const closeAfterCreateModal = () => {
        setShowAfterCreateModal(false);
        setCreatedDocumentUrl("");
    };
    
    // 실제 문서 생성 함수
    const createDocument = async () => {
        if (!selectedTemplate || !documentTitle.trim()) return;

        setIsCreating(true);

        const userInfo = JSON.parse(localStorage.getItem('user') || '{}');
        const creatorEmail = userInfo.email || '';

        if (!creatorEmail) {
            showNotification('사용자 정보를 찾을 수 없습니다. 다시 로그인해주세요.', 'error');
            setIsCreating(false);
            return;
        }

        try {
            if (permissionType === 'private') {
                // 나만 보기: 프론트엔드에서 직접 Google Drive API 사용
                console.log('📄 개인 드라이브에 문서 생성:', selectedTemplate);
                
                try {
                    // copyGoogleDocument 함수 import (내부에서 Google API 초기화 처리)
                    const { copyGoogleDocument } = await import('../utils/google/googleSheetUtils');
                    
                    // documentId가 있으면 복사, 없으면 빈 문서 생성
                    // 기본 템플릿도 documentId를 가질 수 있음 (동적 템플릿의 경우)
                    const templateDocumentId = selectedTemplate.documentId || (selectedTemplate.type && selectedTemplate.type.length > 20 ? selectedTemplate.type : null);
                    
                    if (templateDocumentId) {
                        // 템플릿 복사 (기본 템플릿 또는 개인 템플릿)
                        console.log('📄 템플릿 복사 시작:', { templateDocumentId, documentTitle, tag: selectedTemplate.tag });
                        const copyResult = await copyGoogleDocument(templateDocumentId, documentTitle, selectedTemplate.tag);
                        
                        if (copyResult && copyResult.webViewLink) {
                            window.open(copyResult.webViewLink, '_blank');
                            showNotification('문서가 개인 드라이브에 생성되었습니다!', 'success');
                            closePermissionModal();
                            setIsCreating(false);
                            return;
                        } else {
                            throw new Error('문서 복사에 실패했습니다. 템플릿 ID를 확인해주세요.');
                        }
                    } else {
                        // 빈 문서 생성 (documentId가 없는 경우)
                        console.log('📄 빈 문서 생성 (documentId 없음)');
                        // Google Docs의 새 문서 생성 URL을 사용
                        const newDocUrl = 'https://docs.google.com/document/create';
                        window.open(newDocUrl, '_blank');
                        showNotification('새 문서가 생성되었습니다!', 'success');
                        closePermissionModal();
                        setIsCreating(false);
                        return;
                    }
                } catch (error) {
                    console.error('📄 개인 문서 생성 오류:', error);
                    const errorMessage = error instanceof Error ? error.message : '알 수 없는 오류';
                    showNotification(`문서 생성 중 오류가 발생했습니다: ${errorMessage}`, 'error');
                    setIsCreating(false);
                    return;
                }
            }

            // 권한 부여 방식
            console.log('📄 권한 부여 문서 생성:', {
                selectedTemplate,
                selectedGroups,
                individualEmails
            });

            // 선택된 그룹들의 이메일 수집
            const groupEmails = selectedGroups.map(group => ENV_CONFIG.GROUP_EMAILS[group]).filter(Boolean); // ENV v2: VITE_GROUP_EMAIL 기반
            
            // 개별 이메일과 그룹 이메일 합치기 (생성자 이메일도 포함)
            const validIndividualEmails = individualEmails.filter(email => email && email.trim() !== '');
            const allEditors = [
                creatorEmail, // 생성자 이메일 명시적으로 포함
                ...groupEmails.filter(email => email && email.trim() !== ''), // 그룹 이메일
                ...validIndividualEmails // 개별 이메일
            ].filter((email, index, arr) => arr.indexOf(email) === index); // 중복 제거
            
            console.log('📄 권한 설정 상세 정보:', {
                creatorEmail,
                groupEmails,
                individualEmails,
                allEditors: allEditors,
                editorsCount: allEditors.length
            });

            // 기본 템플릿도 documentId를 가질 수 있음 (동적 템플릿의 경우)
            const templateDocumentId = selectedTemplate.documentId || (selectedTemplate.type && selectedTemplate.type.length > 20 ? selectedTemplate.type : null);
            
            console.log('선택된 템플릿 정보:', {
                title: selectedTemplate.title,
                documentId: selectedTemplate.documentId,
                type: selectedTemplate.type,
                templateDocumentId: templateDocumentId,
                templateType: templateDocumentId || selectedTemplate.type,
                tag: selectedTemplate.tag
            });
            
            const documentData = {
                title: documentTitle, // 사용자가 입력한 제목 사용
                templateType: templateDocumentId || selectedTemplate.type,
                creatorEmail: creatorEmail,
                editors: allEditors,
                role: 'student', // 기본값으로 student 설정
                tag: selectedTemplate.tag // 태그 추가
            };
            
            console.log('📄 API로 전송할 데이터:', documentData);
            
            const result = await apiClient.createDocument(documentData);

            if (result.success) {
                console.log('📄 문서 생성 성공:', result);
                
                // 디버그 정보 표시
                if (result.debug) {
                    console.log('🔍 디버그 정보:', result.debug);
                    console.log('📋 요청된 편집자:', result.debug.requestedEditors);
                    console.log('🔐 권한 설정 성공:', result.debug.permissionSuccess);
                    console.log('📝 권한 설정 메시지:', result.debug.permissionMessage);
                    console.log('✅ 권한 부여된 사용자:', result.debug.grantedUsers);
                    console.log('👥 현재 편집자 목록:', result.debug.currentEditors);
                    
                    // 메타데이터 디버깅 정보
                    console.log('📄 메타데이터 상태:', result.debug.metadataStatus);
                    console.log('📄 메타데이터 에러:', result.debug.metadataError);
                    console.log('📄 전달된 태그:', result.debug.tag);
                    console.log('📄 생성자 이메일:', result.debug.creatorEmail);
                    console.log('📄 문서 ID:', result.debug.documentId);
                    console.log('📄 실제 저장된 메타데이터:', result.debug.verifiedProperties);
                }
                
                // 권한 설정 결과 확인
                if (result.permissionResult) {
                    console.log('🔐 권한 설정 결과:', result.permissionResult);
                    if (result.permissionResult.successCount > 0) {
                        console.log(`✅ ${result.permissionResult.successCount}명에게 권한 부여 완료`);
                    }
                    if (result.permissionResult.failCount > 0) {
                        console.warn(`⚠️ ${result.permissionResult.failCount}명 권한 부여 실패`);
                    }
                }
                
                const createDocResponse = result.data as CreateDocumentResponse;
                setCreatedDocumentUrl(createDocResponse.documentUrl);
                closePermissionModal();
                // 문서 생성 후 자동으로 열기
                if (createDocResponse.documentUrl) {
                    window.open(createDocResponse.documentUrl, '_blank');
                }
                setIsCreating(false);
                
                // 메타데이터 상태 알림
                if (result.debug) {
                    if (result.debug.metadataStatus === 'success') {
                        console.log('✅ 메타데이터 저장 성공');
                    } else if (result.debug.metadataStatus === 'failed') {
                        console.warn('⚠️ 메타데이터 저장 실패:', result.debug.metadataError);
                        showNotification(`문서는 생성되었지만 메타데이터 저장에 실패했습니다: ${result.debug.metadataError}`, 'warning');
                    }
                }
            } else {
                console.error('📄 문서 생성 실패:', result);
                showNotification('문서 생성에 실패했습니다: ' + result.message, 'error');
                setIsCreating(false);
            }
        } catch (error) {
            console.error('📄 문서 생성 오류:', error);
            showNotification('문서 생성 중 오류가 발생했습니다.', 'error');
            setIsCreating(false);
        }
    };

    const [defaultTemplateItems, setDefaultTemplateItems] = useState<Template[]>([]);

    const sensors = useSensors(
        useSensor(PointerSensor, {
            activationConstraint: {
                distance: 8, // 8px 이상 이동해야 드래그 시작
            },
        }),
        useSensor(KeyboardSensor, {
            coordinateGetter: sortableKeyboardCoordinates,
        })
    );

    const handleDefaultDragEnd = (event: DragEndEvent) => {
        const { active, over } = event;
        if (active.id !== over.id) {
            setDefaultTemplateItems((items) => {
                const oldIndex = items.findIndex((item) => item.type === active.id);
                const newIndex = items.findIndex((item) => item.type === over.id);
                const newItems = arrayMove(items, oldIndex, newIndex);
                localStorage.setItem('defaultTemplateOrder', JSON.stringify(newItems.map(item => item.type)));
                return newItems;
            });
        }
    };

    // 시트 템플릿 제거로 인해 드래그 앤 드롭 비활성화
    const handleCustomDragEnd = (event: DragEndEvent) => {
        // 개인 템플릿은 드래그 앤 드롭 비활성화
        console.log('개인 템플릿은 드래그 앤 드롭을 지원하지 않습니다.');
    };

    // + 새 문서 모달 상태 추가 (3개 필드)
    const [showNewDocModal, setShowNewDocModal] = useState(false);
    const [newDocData, setNewDocData] = useState({
        title: "",
        description: "",
        tag: ""
    });
    
    // 새 템플릿 생성 방식 상태
    const [templateCreationMode, setTemplateCreationMode] = useState<'upload' | 'create'>('create');
    const [uploadedFile, setUploadedFile] = useState<File | null>(null);
    const [documentType, setDocumentType] = useState<'document' | 'spreadsheet'>('document');

    // Edit modal state
    const [showEditDocModal, setShowEditDocModal] = useState(false);
    const [editingTemplate, setEditingTemplate] = useState<Template | null>(null);
    const [originalTemplate, setOriginalTemplate] = useState<Template | null>(null);

    // 파일 업로드 처리
    const handleFileUpload = (event: React.ChangeEvent<HTMLInputElement>) => {
        const file = event.target.files?.[0];
        if (!file) return;

        // 파일 타입 검증 (docx, xlsx만 허용)
        const allowedTypes = [
            'application/vnd.openxmlformats-officedocument.wordprocessingml.document', // .docx
            'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet', // .xlsx
            'application/msword', // .doc
            'application/vnd.ms-excel' // .xls
        ];

        if (!allowedTypes.includes(file.type)) {
            showNotification('지원되는 파일 형식: .docx, .xlsx, .doc, .xls', 'warning');
            return;
        }

        setUploadedFile(file);
        console.log('📁 파일 업로드:', file.name, file.type);
    };

    // 새 템플릿 생성 (파일 업로드 또는 새로 만들기)
    const handleCreateNewTemplate = async () => {
        // 중복 클릭 방지
        if (isCreatingTemplate) return;
        
        if (!newDocData.title.trim() || !newDocData.description.trim()) {
            showNotification("제목과 설명을 입력해주세요.", 'warning');
            return;
        }

        setIsCreatingTemplate(true);
        
        // 생성 시작 시 즉시 모달 닫기 (데이터는 미리 복사)
        const templateData = { ...newDocData };
        const fileToUpload = uploadedFile; // 파일도 미리 복사
        const creationMode = templateCreationMode; // 모드도 미리 복사
        handleNewDocCancel();

        try {
            if (creationMode === 'upload' && fileToUpload) {
                // 파일 업로드 방식
                await handleFileUploadToDrive(fileToUpload, templateData);
            } else {
                // 새로 만들기 방식
                await handleCreateNewDocument(templateData);
            }

            showNotification('템플릿이 성공적으로 생성되었습니다!', 'success');
            
        } catch (error) {
            console.error('❌ 템플릿 생성 오류:', error);
            showNotification('템플릿 생성 중 오류가 발생했습니다.', 'error');
        } finally {
            setIsCreatingTemplate(false);
        }
    };

    // 파일을 Google Drive에 업로드
    const handleFileUploadToDrive = async (file: File, templateData: TemplateData) => {
        try {
            console.log('📁 파일을 Google Drive에 업로드 중...');
            
            // 파일명은 원본 그대로 사용 (사용자가 자유롭게 변경 가능)
            const fileName = templateData.title;
            
            // 개인 템플릿 폴더 찾기
            const folderId = await findPersonalTemplateFolder();
            if (!folderId) {
                throw new Error('개인 템플릿 폴더를 찾을 수 없습니다.');
            }

            // 파일을 FormData로 변환
            const formData = new FormData();
            formData.append('file', file);
            formData.append('name', fileName);
            formData.append('parents', folderId);

            // Google Drive API로 파일 업로드
            const response = await fetch(`https://www.googleapis.com/upload/drive/v3/files?uploadType=multipart&fields=id,name`, {
                method: 'POST',
                headers: {
                    'Authorization': `Bearer ${gapi.client.getToken().access_token}`
                },
                body: formData
            });

            if (!response.ok) {
                throw new Error('파일 업로드 실패');
            }

            const result = await response.json();
            console.log('✅ 파일 업로드 완료:', result);
            
            // 업로드된 파일에 메타데이터 추가
            try {
                const userInfo = JSON.parse(localStorage.getItem('user') || '{}');
                const creatorEmail = userInfo.email || '';
                
                        const metadataResponse = await fetch(`https://www.googleapis.com/drive/v3/files/${result.id}`, {
                    method: 'PATCH',
                    headers: {
                        'Authorization': `Bearer ${gapi.client.getToken().access_token}`,
                        'Content-Type': 'application/json'
                    },
                    body: JSON.stringify({
                        properties: {
                                    creatorEmail: creatorEmail,
                                    creator: creatorEmail, // 호환성 유지
                            createdDate: new Date().toLocaleString('ko-KR'),
                            tag: templateData.tag,
                            description: templateData.description
                        }
                    })
                });
                
                if (metadataResponse.ok) {
                    console.log('✅ 메타데이터 추가 완료');
                    
                    // 메타데이터 저장 확인
                    const verifyResponse = await fetch(`https://www.googleapis.com/drive/v3/files/${result.id}?fields=properties`, {
                        headers: {
                            'Authorization': `Bearer ${gapi.client.getToken().access_token}`
                        }
                    });
                    
                    if (verifyResponse.ok) {
                        const verifyData = await verifyResponse.json();
                        console.log('✅ 메타데이터 확인:', verifyData.properties);
                    }
                } else {
                    console.warn('⚠️ 메타데이터 추가 실패:', await metadataResponse.text());
                }
            } catch (metadataError) {
                console.warn('⚠️ 메타데이터 추가 오류:', metadataError);
            }
            
        } catch (error) {
            console.error('❌ 파일 업로드 오류:', error);
            throw error;
        }
    };

    // 새 문서 생성
    const handleCreateNewDocument = async (templateData: TemplateData) => {
        try {
            console.log('📄 새 문서 생성 중...', documentType);
            
            // 파일명은 원본 제목 그대로 사용 (사용자가 자유롭게 변경 가능)
            const fileName = templateData.title;
            
            // 개인 템플릿 폴더 찾기
            const folderId = await findPersonalTemplateFolder();
            if (!folderId) {
                throw new Error('개인 템플릿 폴더를 찾을 수 없습니다.');
            }

            let documentId: string;

            if (documentType === 'spreadsheet') {
                // 새 Google Sheets 스프레드시트 생성
                const response = await gapi.client.sheets.spreadsheets.create({
                    resource: {
                        properties: {
                            title: fileName
                        }
                    }
                });
                documentId = response.result.spreadsheetId!;
            } else {
                // 새 Google Docs 문서 생성 (Google Drive API 사용)
                const response = await gapi.client.drive.files.create({
                    resource: {
                        name: fileName,
                        mimeType: 'application/vnd.google-apps.document',
                        parents: [folderId] // 바로 폴더에 생성
                    },
                    fields: 'id'
                });
                documentId = response.result.id!;
            }

            if (documentId) {
                // 스프레드시트인 경우에만 폴더로 이동 (문서는 이미 폴더에 생성됨)
                if (documentType === 'spreadsheet') {
                    await gapi.client.drive.files.update({
                        fileId: documentId,
                        addParents: folderId,
                        removeParents: 'root'
                    });
                }

                console.log('✅ 새 문서 생성 완료:', documentId);
                
                // 생성된 문서에 메타데이터 추가
                try {
                    const userInfo = JSON.parse(localStorage.getItem('user') || '{}');
                    const creatorEmail = userInfo.email || '';
                    
                    const metadataResult = await gapi.client.drive.files.update({
                        fileId: documentId,
                        resource: {
                            properties: {
                                creatorEmail: creatorEmail,
                                creator: creatorEmail, // 호환성 유지
                                createdDate: new Date().toLocaleString('ko-KR'),
                                tag: templateData.tag,
                                description: templateData.description
                            }
                        }
                    });
                    
                    console.log('✅ 메타데이터 추가 완료:', metadataResult);
                    
                    // 메타데이터 저장 확인
                    const verifyResult = await gapi.client.drive.files.get({
                        fileId: documentId,
                        fields: 'properties'
                    });
                    console.log('✅ 메타데이터 확인:', verifyResult.result.properties);
                    
                } catch (metadataError) {
                    console.warn('⚠️ 메타데이터 추가 실패:', metadataError);
                }
                
                // 생성된 문서 바로 열기
                const fileResponse = await gapi.client.drive.files.get({
                    fileId: documentId,
                    fields: 'webViewLink'
                });
                
                if (fileResponse.result.webViewLink) {
                    window.open(fileResponse.result.webViewLink, '_blank');
                }
            }
            
        } catch (error) {
            console.error('❌ 새 문서 생성 오류:', error);
            throw error;
        }
    };

    // 개인 템플릿 폴더 찾기 함수
    const findPersonalTemplateFolder = async (): Promise<string | null> => {
        try {
            console.log('🔍 개인 템플릿 폴더 찾기/생성 시작');

            const rootFolderName = ENV_CONFIG.ROOT_FOLDER_NAME; // ENV v2: VITE_FOLER_NAME(ROOT) 기반
            const documentFolderName = ENV_CONFIG.DOCUMENT_FOLDER_NAME; // ENV v2: VITE_FOLER_NAME(DOCUMENT) 기반
            const personalTemplateFolderName = ENV_CONFIG.PERSONAL_TEMPLATE_FOLDER_NAME; // ENV v2: VITE_FOLER_NAME(P_TEMP) 기반

            // 1단계: 루트에서 루트 폴더 찾기 또는 생성
            let hotPotatoResponse = await gapi.client.drive.files.list({
                q: `'root' in parents and name='${rootFolderName}' and mimeType='application/vnd.google-apps.folder' and trashed=false`,
                fields: 'files(id,name)',
                spaces: 'drive',
                orderBy: 'name'
            });

            let hotPotatoFolder;
            if (!hotPotatoResponse.result.files || hotPotatoResponse.result.files.length === 0) {
                console.log(`📁 ${rootFolderName} 폴더를 찾을 수 없습니다. 생성합니다.`);
                const createResponse = await gapi.client.drive.files.create({
                    resource: {
                        name: rootFolderName,
                        mimeType: 'application/vnd.google-apps.folder',
                        parents: ['root']
                    },
                    fields: 'id,name'
                });
                hotPotatoFolder = { id: createResponse.result.id, name: createResponse.result.name };
                console.log(`✅ ${rootFolderName} 폴더 생성 완료:`, hotPotatoFolder.id);
            } else {
                hotPotatoFolder = hotPotatoResponse.result.files[0];
                console.log(`✅ ${rootFolderName} 폴더 찾음:`, hotPotatoFolder.id);
            }

            // 2단계: 루트 폴더에서 문서 폴더 찾기 또는 생성
            let documentResponse = await gapi.client.drive.files.list({
                q: `'${hotPotatoFolder.id}' in parents and name='${documentFolderName}' and mimeType='application/vnd.google-apps.folder' and trashed=false`,
                fields: 'files(id,name)',
                spaces: 'drive',
                orderBy: 'name'
            });

            let documentFolder;
            if (!documentResponse.result.files || documentResponse.result.files.length === 0) {
                console.log(`📁 ${documentFolderName} 폴더를 찾을 수 없습니다. 생성합니다.`);
                const createResponse = await gapi.client.drive.files.create({
                    resource: {
                        name: documentFolderName,
                        mimeType: 'application/vnd.google-apps.folder',
                        parents: [hotPotatoFolder.id]
                    },
                    fields: 'id,name'
                });
                documentFolder = { id: createResponse.result.id, name: createResponse.result.name };
                console.log(`✅ ${documentFolderName} 폴더 생성 완료:`, documentFolder.id);
            } else {
                documentFolder = documentResponse.result.files[0];
                console.log(`✅ ${documentFolderName} 폴더 찾음:`, documentFolder.id);
            }

            // 3단계: 문서 폴더에서 개인 양식 폴더 찾기 또는 생성
            let personalTemplateResponse = await gapi.client.drive.files.list({
                q: `'${documentFolder.id}' in parents and name='${personalTemplateFolderName}' and mimeType='application/vnd.google-apps.folder' and trashed=false`,
                fields: 'files(id,name)',
                spaces: 'drive',
                orderBy: 'name'
            });

            let personalTemplateFolder;
            if (!personalTemplateResponse.result.files || personalTemplateResponse.result.files.length === 0) {
                console.log(`📁 ${personalTemplateFolderName} 폴더를 찾을 수 없습니다. 생성합니다.`);
                const createResponse = await gapi.client.drive.files.create({
                    resource: {
                        name: personalTemplateFolderName,
                        mimeType: 'application/vnd.google-apps.folder',
                        parents: [documentFolder.id]
                    },
                    fields: 'id,name'
                });
                personalTemplateFolder = { id: createResponse.result.id, name: createResponse.result.name };
                console.log(`✅ ${personalTemplateFolderName} 폴더 생성 완료:`, personalTemplateFolder.id);
            } else {
                personalTemplateFolder = personalTemplateResponse.result.files[0];
                console.log(`✅ ${personalTemplateFolderName} 폴더 찾음:`, personalTemplateFolder.id);
            }

            return personalTemplateFolder.id;
        } catch (error) {
            console.error('❌ 개인 템플릿 폴더 찾기/생성 오류:', error);
            return null;
        }
    };

    // 모달 취소 처리
    const handleNewDocCancel = () => {
        setShowNewDocModal(false);
        setNewDocData({
            title: "",
            description: "",
            tag: ""
        });
        setTemplateCreationMode('create');
        setUploadedFile(null);
        setDocumentType('document');
    };

    // 관리자 전용: 기본(공유) 템플릿 업로드 모달
    const [showSharedUploadModal, setShowSharedUploadModal] = useState(false);
    const [sharedUploadFile, setSharedUploadFile] = useState<File | null>(null);
    const [sharedMeta, setSharedMeta] = useState({ title: '', description: '', tag: '' });
    const handleSharedFilePick = (e: React.ChangeEvent<HTMLInputElement>) => {
      const f = e.target.files?.[0] || null;
      setSharedUploadFile(f);
    };
    const resetSharedUpload = () => {
      setShowSharedUploadModal(false);
      setSharedUploadFile(null);
      setSharedMeta({ title: '', description: '', tag: '' });
    };

    // 입력값 변경 처리
    const handleInputChange = (field: string, value: string) => {
        setNewDocData(prev => ({
            ...prev,
            [field]: value
        }));
    };

    const handleEditInputChange = (field: string, value: string) => {
        if (editingTemplate) {
            setEditingTemplate({
                ...editingTemplate,
                [field]: value,
            });
        }
    };
    
    // 개인 템플릿 수정 함수
    const handleEditPersonalTemplate = (template: Template) => {
        console.log('📝 개인 템플릿 수정 시작:', template);
        setEditingTemplate(template);
        setOriginalTemplate(template);
        setShowEditDocModal(true);
    };

    // 개인 템플릿 정보 수정 (파일명 변경)
    const handleUpdatePersonalTemplate = async (templateId: string, updatedData: {
        name: string;
        fileType: string;
        description: string;
    }) => {
        try {
            console.log('📝 개인 템플릿 정보 수정:', { templateId, updatedData });
            
            // Google Drive API를 사용하여 파일명 변경
            const newFileName = `${updatedData.fileType} / ${updatedData.name} / ${updatedData.description}`;
            
            await gapi.client.drive.files.update({
                fileId: templateId,
                resource: {
                    name: newFileName
                }
            });
            
            console.log('✅ 개인 템플릿 정보 수정 완료');
            
            // 개인 템플릿 목록 다시 로드
            // useTemplateUI 훅에서 자동으로 로드되므로 별도 처리 불필요
            
        } catch (error) {
            console.error('❌ 개인 템플릿 정보 수정 오류:', error);
            throw error;
        }
    };

    // 개인 템플릿 내용 수정 (Google Docs/Sheets 열기)
    const handleEditPersonalTemplateContent = (templateId: string) => {
        try {
            console.log('📝 개인 템플릿 내용 수정:', templateId);
            
            // Google Drive에서 파일 정보 가져오기
            gapi.client.drive.files.get({
                fileId: templateId,
                fields: 'webViewLink'
            }).then(response => {
                if (response.result.webViewLink) {
                    window.open(response.result.webViewLink, '_blank');
                } else {
                    showNotification('문서를 열 수 없습니다.', 'error');
                }
            });
            
        } catch (error) {
            console.error('❌ 개인 템플릿 내용 수정 오류:', error);
            showNotification('문서를 열 수 없습니다.', 'error');
        }
    };

    const handleEditDocCancel = () => {
        setShowEditDocModal(false);
        setEditingTemplate(null);
        setOriginalTemplate(null);
    };

    const handleUpdateDocSubmit = async () => {
        if (editingTemplate && originalTemplate) {
            if (!editingTemplate.title.trim() || !editingTemplate.description.trim()) {
                showNotification("제목과 설명을 입력해주세요.", 'warning');
                return;
            }
            
            // 개인 템플릿인 경우
            if (editingTemplate.isPersonal && editingTemplate.documentId) {
                try {
                    await handleUpdatePersonalTemplate(editingTemplate.documentId, {
                        name: editingTemplate.title,
                        fileType: editingTemplate.tag,
                        description: editingTemplate.description
                    });
                    
                    // 모달 닫기
                    handleEditDocCancel();
                    
                    showNotification('개인 템플릿 정보가 수정되었습니다.', 'success');
                    
                } catch (error) {
                    showNotification('개인 템플릿 수정 중 오류가 발생했습니다.', 'error');
                }
            } else {
                // 공유(기본) 템플릿 메타 수정 (문서 내용 수정 아님, 관리자 전용)
                if (!isAdminUser) {
                    showNotification('기본 템플릿 수정은 관리자만 가능합니다.', 'warning');
                    return;
                }
                
                if (editingTemplate.documentId) {
                    try {
                        // 기본 태그인지 확인 (빈 문자열은 허용)
                        if (editingTemplate.tag && !staticTags.includes(editingTemplate.tag)) {
                            showNotification('기본 템플릿은 기본 태그만 사용할 수 있습니다.', 'warning');
                            return;
                        }
                        
                        const res = await apiClient.updateSharedTemplateMeta({
                            fileId: editingTemplate.documentId,
                            meta: {
                                title: editingTemplate.title,
                                description: editingTemplate.description,
                                tag: editingTemplate.tag,
                            }
                        });
                        if (res.success) {
                            // 기본 템플릿 목록 다시 로드
                            await loadDynamicTemplates();
                            handleEditDocCancel();
                            showNotification('기본 템플릿 정보가 수정되었습니다.', 'success');
                        } else {
                            showNotification('수정 실패: ' + (res.message || '알 수 없는 오류'), 'error');
                        }
                    } catch (e) {
                        console.error('기본 템플릿 수정 오류:', e);
                        showNotification('수정 중 오류가 발생했습니다.', 'error');
                    }
                } else {
                    handleEditDocCancel();
                }
            }
        }
    };

    // Get templates from the hook first
    const { 
        onUseTemplate,
        allDefaultTemplates,
        isLoadingTemplates,
        templateError,
        loadDynamicTemplates,
        // 개인 템플릿 관련
        personalTemplates,
        isLoadingPersonalTemplates,
        personalTemplateError,
        togglePersonalTemplateFavorite,
        loadPersonalTemplates,
        // 기본 템플릿 즐겨찾기 관련
        defaultTemplateFavorites,
        isLoadingFavorites,
        toggleDefaultTemplateFavorite,
        testDriveApi,
        testTemplateFolderDebug,
        testSpecificFolder,
        // 권한 설정 모달 관련
        isPermissionModalOpen,
        setIsPermissionModalOpen,
        selectedTemplate,
        setSelectedTemplate,
        permissionType,
        setPermissionType,
        selectedGroups,
        setSelectedGroups,
        individualEmails,
        setIndividualEmails,
        closePermissionModal,
        uploadSharedTemplate,
    } = useTemplateUI([], onPageChange, searchTerm, activeTab); // 빈 배열로 시트 템플릿 제거

    // 파일명 입력 모달 함수들 (useTemplateUI 호출 이후에 정의)
    const openFileNameModal = useCallback((template: Template) => {
        console.log('📝 파일명 모달 열기:', template);
        if (!template) {
            console.error('❌ 템플릿이 없습니다!');
            return;
        }
        setSelectedTemplate(template);
        setDocumentTitle("");
        setShowFileNameModal(true);
        console.log('📝 모달 상태 설정 완료:', { showFileNameModal: true, selectedTemplate: template });
    }, [setSelectedTemplate]);
    
    const closeFileNameModal = useCallback(() => {
        setShowFileNameModal(false);
        setDocumentTitle("");
        setSelectedTemplate(null);
    }, [setSelectedTemplate]);
    
    // 모달 상태 디버깅
    useEffect(() => {
        console.log('📝 모달 상태:', { showFileNameModal, selectedTemplate: selectedTemplate?.title });
    }, [showFileNameModal, selectedTemplate]);

    // 기본 태그 로드 (Apps Script에서)
    useEffect(() => {
        const loadStaticTags = async () => {
            setIsLoadingStaticTags(true);
            try {
                console.log('🏷️ 기본 태그 로드 시작...');
                const response = await apiClient.getStaticTags();
                if (response.success && response.data) {
                    setStaticTags(response.data);
                    console.log('✅ 기본 태그 로드 완료:', response.data.length, '개');
                } else {
                    console.warn('⚠️ 기본 태그 로드 실패:', response.message);
                    setStaticTags([]);
                }
            } catch (error) {
                console.error('❌ 기본 태그 로드 오류:', error);
                setStaticTags([]);
            } finally {
                setIsLoadingStaticTags(false);
            }
        };
        loadStaticTags();
    }, []);

    // 동적 템플릿이 로드되면 기본 템플릿 목록 업데이트
    useEffect(() => {
        if (allDefaultTemplates.length > 0) {
            const storedDefaultOrder = localStorage.getItem('defaultTemplateOrder');
            if (storedDefaultOrder) {
                const orderedIds = JSON.parse(storedDefaultOrder);
                const orderedTemplates = orderedIds.map((id: string) => allDefaultTemplates.find(t => t.type === id)).filter(Boolean);
                setDefaultTemplateItems(orderedTemplates as Template[]);
            } else {
                setDefaultTemplateItems(allDefaultTemplates);
            }
        }
    }, [allDefaultTemplates]);

    // --- Filtering Logic ---

    // 1. Filter Default Templates
    const filteredDefaultTemplates = defaultTemplateItems.filter(template => {
        if (activeTab !== "전체" && template.tag !== activeTab) {
            return false;
        }
        if (searchTerm && !template.title.toLowerCase().includes(searchTerm.toLowerCase()) && !template.description.toLowerCase().includes(searchTerm.toLowerCase())) {
            return false;
        }
        return true;
    });

    // 2. Filter Personal Templates
    const filteredPersonalTemplates = personalTemplates.filter(template => {
        if (activeTab !== "전체" && template.tag !== activeTab) {
            return false;
        }
        if (searchTerm && !template.title.toLowerCase().includes(searchTerm.toLowerCase()) && !template.description.toLowerCase().includes(searchTerm.toLowerCase())) {
            return false;
        }
        return true;
    });

    // 시트 템플릿 제거로 인해 customTemplateItems 관련 useEffect 제거

    // 즐겨찾기 로직 (개인 템플릿용)
    const handleToggleFavorite = useCallback(async (toggledTemplate: Template) => {
        if (toggledTemplate.isPersonal) {
            // 개인 템플릿의 경우 파일명을 업데이트
            try {
                // PersonalTemplateData 형식으로 변환
                const personalTemplateData = {
                    id: toggledTemplate.documentId || toggledTemplate.type,
                    name: toggledTemplate.title,
                    modifiedTime: '',
                    isPersonal: true,
                    tag: toggledTemplate.tag,
                    description: toggledTemplate.description,
                    fileType: toggledTemplate.tag,
                    isFavorite: !!toggledTemplate.favoritesTag
                };
                
                const result = await togglePersonalTemplateFavorite(personalTemplateData);
                if (result.success) {
                    console.log('✅ 개인 템플릿 즐겨찾기 업데이트 성공');
                } else {
                    console.error('❌ 개인 템플릿 즐겨찾기 업데이트 실패:', result.error);
                    showNotification('즐겨찾기 업데이트에 실패했습니다: ' + result.error, 'error');
                }
            } catch (error) {
                console.error('❌ 개인 템플릿 즐겨찾기 토글 오류:', error);
                showNotification('즐겨찾기 업데이트 중 오류가 발생했습니다.', 'error');
            }
        } else {
            // 기본 템플릿은 즐겨찾기 기능 비활성화
            console.log('기본 템플릿은 즐겨찾기 기능을 지원하지 않습니다.');
        }
    }, [togglePersonalTemplateFavorite]);

    const handleUseTemplateClick = useCallback((typeOrTemplate: string | Template, title?: string) => {
        // 템플릿 객체가 직접 전달된 경우
        if (typeOrTemplate && typeof typeOrTemplate === 'object' && !Array.isArray(typeOrTemplate) && 'title' in typeOrTemplate) {
            const template = typeOrTemplate as Template;
            console.log('📄 템플릿 객체 직접 전달:', template);
            openFileNameModal(template);
            return;
        }
        
        // 문자열로 전달된 경우 (기존 방식)
        const type = typeOrTemplate as string;
        console.log('📄 템플릿 사용 클릭:', { type, title, personalTemplates: personalTemplates.length, defaultTemplateItems: defaultTemplateItems.length, allDefaultTemplates: allDefaultTemplates.length });
        console.log('📄 개인 템플릿 목록:', personalTemplates.map(t => ({ title: t.title, type: t.type })));
        console.log('📄 기본 템플릿 목록:', defaultTemplateItems.map(t => ({ title: t.title, type: t.type })));
        console.log('📄 전체 기본 템플릿 목록:', allDefaultTemplates.map(t => ({ title: t.title, type: t.type })));
        
        // 개인 템플릿의 경우 documentId를 찾아서 전달
        let template = personalTemplates.find(t => t.title === title || t.type === type);
        
        if (template) {
            console.log('📄 개인 템플릿 사용:', template);
            openFileNameModal(template);
            return;
        }
        
        // 기본 템플릿의 경우 - defaultTemplateItems에서 먼저 찾기
        template = defaultTemplateItems.find(t => t.type === type || t.title === title);
        
        if (template) {
            console.log('📄 기본 템플릿 사용 (defaultTemplateItems):', template);
            openFileNameModal(template);
            return;
        }
        
        // allDefaultTemplates에서도 찾기
        template = allDefaultTemplates.find(t => t.type === type || t.title === title);
        
        if (template) {
            console.log('📄 기본 템플릿 사용 (allDefaultTemplates):', template);
            openFileNameModal(template);
            return;
        }
        
        console.warn('⚠️ 템플릿을 찾을 수 없습니다:', { type, title });
        showNotification(`템플릿을 찾을 수 없습니다.\n타입: ${type}\n제목: ${title}`, 'error');
    }, [personalTemplates, defaultTemplateItems, allDefaultTemplates, openFileNameModal]);

    // 올바른 순서로 태그를 정렬합니다: 기본 태그를 먼저, 그 다음 커스텀 태그를 표시합니다.
    const orderedTags = useMemo(() => {
        // 실제 기본 태그 (Apps Script에서 로드) 사용
        const staticTagSet = new Set(staticTags);
        const customTags = tags.filter(tag => !staticTagSet.has(tag));
        return [...staticTags, ...customTags];
    }, [staticTags, tags]);

    return (
        <div className="document-management-container">
            {/* Top Level Controls */}
            <CategoryTabs 
                activeTab={activeTab} 
                setActiveTab={setActiveTab} 
                tags={orderedTags} 
                managedTags={tags}
                staticTags={staticTags}
                defaultTags={defaultTemplateTags}
                isAdmin={isAdminUser}
                addTag={handleAddTag} 
                deleteTag={handleDeleteTag} 
                updateTag={handleUpdateTag}
                addStaticTag={handleAddStaticTag}
                deleteStaticTag={handleDeleteStaticTag}
                updateStaticTag={handleUpdateStaticTag}
                onShowNotification={showNotification}
                onShowConfirm={showConfirm}
            />

            {/* Side-by-Side Layout */}
            <div className="new-document-layout">
                {/* Left Sidebar: Default Templates */}
                <div className="layout-sidebar">
                    <div className="template-section">
                        <div className="section-title section-title-with-action">
                            <span>기본 템플릿</span>
                            {isAdminUser && (
                              <button
                                type="button"
                                className="section-action-btn"
                                onClick={() => setShowSharedUploadModal(true)}
                                title="템플릿 업로드"
                              >
                                템플릿 업로드
                              </button>
                            )}
                        </div>
                        {templateError && !templateError.includes('개인 템플릿') && (
                            <div className="template-error-message">
                                <div className="error-content">
                                    <span className="error-text">{templateError}</span>
                                </div>
                                <div className="error-actions">
                                    <button 
                                        className="error-action-btn retry-btn"
                                        onClick={loadDynamicTemplates}
                                    >
                                        다시 시도
                                    </button>
                                    <button 
                                        className="error-action-btn debug-btn"
                                        onClick={async () => {
                                            const result = await testDriveApi();
                                            showNotification(result.message, result.success ? 'success' : 'error');
                                        }}
                                    >
                                        Drive API 테스트
                                    </button>
                                    <button 
                                        className="error-action-btn debug-btn"
                                        onClick={async () => {
                                            const result = await testTemplateFolderDebug();
                                            if (result.success && result.data) {
                                                const debugInfo = result.data.debugInfo || [];
                                                showNotification(`디버깅 결과:\n${debugInfo.join('\n')}`, 'info');
                                            } else {
                                                showNotification(result.message, 'error');
                                            }
                                        }}
                                    >
                                        폴더 디버깅
                                    </button>
                                    <button 
                                        className="error-action-btn debug-btn"
                                        onClick={async () => {
                                            const result = await testSpecificFolder();
                                            if (result.success && result.data) {
                                                const debugInfo = result.data.debugInfo || [];
                                                showNotification(`특정 폴더 테스트 결과:\n${debugInfo.join('\n')}`, 'info');
                                            } else {
                                                showNotification(result.message, 'error');
                                            }
                                        }}
                                    >
                                        특정 폴더 테스트
                                    </button>
                                </div>
                            </div>
                        )}
                        <DndContext
                            sensors={sensors}
                            collisionDetection={closestCorners}
                            onDragEnd={handleDefaultDragEnd}
                        >
                            <SortableContext
                                items={filteredDefaultTemplates.map(t => t.type)}
                                strategy={rectSortingStrategy}
                            >
                                <div className="new-templates-container">
                                    {isLoadingTemplates ? (
                                        <div className="loading-cell" style={{ gridColumn: '1 / -1' }}>
                                            <BiLoaderAlt className="spinner" />
                                            <span>로딩 중...</span>
                                        </div>
                                    ) : (
                                        <>
                                            {filteredDefaultTemplates.map(template => (
                                                <SortableTemplateCard
                                                    key={template.type}
                                                    id={template.type}
                                                    template={template}
                                                    onUse={handleUseTemplateClick}
                                                    onDelete={() => {}}
                                                    onDeleteTemplate={isAdminUser ? handleDeleteDefaultTemplate : undefined}
                                                    onEdit={isAdminUser ? (t)=>{
                                                      // 공유 템플릿 메타 수정 모달 열기
                                                      setEditingTemplate({ ...t });
                                                      setOriginalTemplate({ ...t });
                                                      setShowEditDocModal(true);
                                                    } : undefined}
                                                    isFixed={!isAdminUser}
                                                    defaultTags={defaultTemplateTags} // Pass defaultTemplateTags
                                                    onToggleFavorite={toggleDefaultTemplateFavorite} // 기본 템플릿 즐겨찾기 토글
                                                    isFavorite={defaultTemplateFavorites.includes(template.title)} // 즐겨찾기 상태
                                                    isAdmin={isAdminUser}
                                                />
                                            ))}
                                        </>
                                    )}
                                </div>
                            </SortableContext>
                        </DndContext>
                    </div>
                </div>

                {/* Right Main Area: Personal Templates */}
                <div className="layout-main">
                    <div className="template-section">
                        <h2 className="section-title section-title-with-action">
                            <span>개인 템플릿</span>
                            <button
                                type="button"
                                className="section-action-btn"
                                onClick={() => setShowNewDocModal(true)}
                            >
                                새 템플릿
                            </button>
                        </h2>
                        {(personalTemplateError || (templateError && templateError.includes('개인 템플릿'))) && (
                            <div className="template-error-message personal-template-error">
                                <div className="error-content">
                                    <div className="error-text-group">
                                        <strong>개인 템플릿 오류:</strong>
                                        <span className="error-text">{personalTemplateError || templateError}</span>
                                    </div>
                                </div>
                                {templateError && templateError.includes('개인 템플릿') && (
                                    <div className="error-actions">
                                        <button 
                                            className="error-action-btn retry-btn"
                                            onClick={loadDynamicTemplates}
                                        >
                                            다시 시도
                                        </button>
                                        <button 
                                            className="error-action-btn debug-btn"
                                            onClick={async () => {
                                                const result = await testDriveApi();
                                                showNotification(result.message, result.success ? 'success' : 'error');
                                            }}
                                        >
                                            Drive API 테스트
                                        </button>
                                        <button 
                                            className="error-action-btn debug-btn"
                                            onClick={async () => {
                                                const result = await testTemplateFolderDebug();
                                                if (result.success && result.data) {
                                                    const debugInfo = result.data.debugInfo || [];
                                                    showNotification(`디버깅 결과:\n${debugInfo.join('\n')}`, 'info');
                                                } else {
                                                    showNotification(result.message, 'error');
                                                }
                                            }}
                                        >
                                            폴더 디버깅
                                        </button>
                                        <button 
                                            className="error-action-btn debug-btn"
                                            onClick={async () => {
                                                const result = await testSpecificFolder();
                                                if (result.success && result.data) {
                                                    const debugInfo = result.data.debugInfo || [];
                                                    showNotification(`특정 폴더 테스트 결과:\n${debugInfo.join('\n')}`, 'info');
                                                } else {
                                                    showNotification(result.message, 'error');
                                                }
                                            }}
                                        >
                                            특정 폴더 테스트
                                        </button>
                                    </div>
                                )}
                            </div>
                        )}
                        {!isLoadingPersonalTemplates && !isTemplatesLoading && filteredPersonalTemplates.length === 0 ? (
                            <div className="no-personal-templates-message">
                                <p>현재 개인 템플릿이 없습니다</p>
                            </div>
                        ) : (
                            <DndContext
                                sensors={sensors}
                                collisionDetection={closestCorners}
                                onDragEnd={handleCustomDragEnd}
                            >
                                <SortableContext
                                    items={filteredPersonalTemplates.map(t => t.type)}
                                    strategy={rectSortingStrategy}
                                >
                                    <TemplateList
                                        templates={filteredPersonalTemplates}
                                        onUseTemplate={handleUseTemplateClick}
                                        onDeleteTemplate={handleDeletePersonalTemplate} // 개인 템플릿 삭제 함수
                                        onEditTemplate={handleEditPersonalTemplate} // 개인 템플릿 수정 함수
                                        onEditPersonal={handleEditPersonalTemplate} // 개인 템플릿 수정 함수
                                        defaultTags={defaultTemplateTags} // Pass defaultTemplateTags
                                        onToggleFavorite={handleToggleFavorite} // Pass down the function
                                        isLoading={isTemplatesLoading || isLoadingPersonalTemplates}
                                        isAdmin={isAdminUser}
                                    />
                                </SortableContext>
                            </DndContext>
                        )}
                    </div>
                </div>

            </div>
            {/* 새 문서 모달 - 개선된 UI */}
            {showNewDocModal && (
                <div className="document-modal-overlay" onClick={handleNewDocCancel}>
                <div className={`document-modal-content ${templateCreationMode === 'upload' ? 'has-file-upload' : ''}`} onClick={(e) => e.stopPropagation()}>
                        <div className="document-modal-header">
                            <div className="header-left">
                                <h2>새 문서 만들기</h2>
                            </div>
                            <button className="document-modal-close" onClick={handleNewDocCancel}>
                                <span>&times;</span>
                            </button>
                        </div>
                        
                        <div className="document-modal-body">
                            {/* 템플릿 생성 방식 선택 */}
                            <div className="form-section">
                                <div className="form-group-large">
                                    <div className="creation-mode-selector">
                                        <button 
                                            className={`mode-button ${templateCreationMode === 'create' ? 'active' : ''}`}
                                            onClick={() => setTemplateCreationMode('create')}
                                        >
                                            새로 만들기
                                        </button>
                                        <button 
                                            className={`mode-button ${templateCreationMode === 'upload' ? 'active' : ''}`}
                                            onClick={() => setTemplateCreationMode('upload')}
                                        >
                                            파일 업로드
                                        </button>
                                    </div>
                                </div>
                            </div>

                            {/* 파일 업로드 섹션 */}
                            {templateCreationMode === 'upload' && (
                                <div className="form-section">
                                    <div className="form-group-large">
                                        <div className="file-upload-area">
                                            <input
                                                id="file-upload"
                                                type="file"
                                                accept=".docx,.xlsx,.doc,.xls"
                                                onChange={handleFileUpload}
                                                className="file-input"
                                            />
                                            <div className="file-upload-display" onClick={() => document.getElementById('file-upload')?.click()}>
                                                {uploadedFile ? (
                                                    <div className="uploaded-file">
                                                        <FaFile className="file-icon" />
                                                        <span className="file-name">{uploadedFile.name}</span>
                                                        <span className="file-size">({(uploadedFile.size / 1024 / 1024).toFixed(2)} MB)</span>
                                                    </div>
                                                ) : (
                                                    <div className="upload-placeholder">
                                                        <FaFolderOpen className="upload-icon" />
                                                        <span className="upload-text">파일을 선택하거나 여기에 드래그하세요</span>
                                                        <span className="upload-hint">지원 형식: .docx, .xlsx, .doc, .xls</span>
                                                    </div>
                                                )}
                                            </div>
                                        </div>
                                    </div>
                                </div>
                            )}

                            {/* 문서 타입 선택 섹션 (새로 만들기 모드) */}
                            {templateCreationMode === 'create' && (
                                <div className="form-section">
                                    <div className="form-group-large">
                                        <div className="document-type-selector">
                                            <button 
                                                className={`type-button ${documentType === 'document' ? 'active' : ''}`}
                                                onClick={() => setDocumentType('document')}
                                            >
                                                문서 (Google Docs)
                                            </button>
                                            <button 
                                                className={`type-button ${documentType === 'spreadsheet' ? 'active' : ''}`}
                                                onClick={() => setDocumentType('spreadsheet')}
                                            >
                                                스프레드시트 (Google Sheets)
                                            </button>
                                        </div>
                                    </div>
                                </div>
                            )}

                            <div className="form-section">
                                <div className="form-group-large">
                                    <input
                                        id="doc-title"
                                        type="text"
                                        className="form-input-large"
                                        placeholder="제목"
                                        value={newDocData.title}
                                        onChange={(e) => handleInputChange("title", e.target.value)}
                                        autoFocus
                                    />
                                </div>
                                <div className="form-group-large">
                                    <textarea
                                        id="doc-description"
                                        className="form-textarea-large"
                                        rows={3}
                                        placeholder="설명"
                                        value={newDocData.description}
                                        onChange={(e) => handleInputChange("description", e.target.value)}
                                    />
                                </div>
                                <div className="form-group-large">
                                    <select
                                        id="doc-tag"
                                        className="form-select-large"
                                        value={newDocData.tag || ""}
                                        onChange={(e) => handleInputChange("tag", e.target.value)}
                                    >
                                        <option value="">카테고리 선택 안 함</option>
                                        {(orderedTags.length > 0 ? orderedTags : ['기본']).map(tag => (
                                            <option key={tag} value={tag}>{tag}</option>
                                        ))}
                                    </select>
                                </div>
                            </div>
                        </div>

                        <div className="document-modal-actions">
                            <button type="button" className="action-btn cancel-btn" onClick={handleNewDocCancel}>
                                <span>취소</span>
                            </button>
                            <button 
                                type="button" 
                                className="action-btn save-btn" 
                                onClick={handleCreateNewTemplate}
                                disabled={isCreatingTemplate || !newDocData.title.trim() || (templateCreationMode === 'upload' && !uploadedFile)}
                            >
                                <span>{isCreatingTemplate ? '생성 중...' : '생성'}</span>
                            </button>
                        </div>
                    </div>
                </div>
            )}

            {/* Edit Document Modal */}
            {showEditDocModal && editingTemplate && (
                <div className="modal-overlay" onClick={handleEditDocCancel}>
                    <div className="modal-content" onClick={(e) => e.stopPropagation()}>
                        <div className="modal-header">
                            <h2>정보 수정</h2>
                            <button className="modal-close" onClick={handleEditDocCancel}>
                                &times;
                            </button>
                        </div>
                        <div className="modal-body">
                            <div className="form-group">
                                <label htmlFor="edit-doc-title">제목</label>
                                <input
                                    id="edit-doc-title"
                                    type="text"
                                    className="modal-input"
                                    value={editingTemplate.title}
                                    onChange={(e) => handleEditInputChange("title", e.target.value)}
                                    autoFocus
                                />
                            </div>
                            <div className="form-group">
                                <label htmlFor="edit-doc-description">상세정보</label>
                                <textarea
                                    id="edit-doc-description"
                                    className="modal-textarea"
                                    value={editingTemplate.description}
                                    onChange={(e) => handleEditInputChange("description", e.target.value)}
                                    rows={3}
                                />
                            </div>
                            <div className="form-group">
                                <label htmlFor="edit-doc-tag">태그</label>
                                <select
                                    id="edit-doc-tag"
                                    className="modal-input"
                                    value={editingTemplate.tag || ""}
                                    onChange={(e) => handleEditInputChange("tag", e.target.value)}
                                >
                                    <option value="">선택 안 함</option>
                                    {/* 기본 템플릿은 기본 태그만, 개인 템플릿은 모든 태그 선택 가능 */}
                                    {(editingTemplate.isPersonal 
                                        ? orderedTags 
                                        : (staticTags.length > 0 ? staticTags : ['기본'])
                                    ).map(tag => (
                                        <option key={tag} value={tag}>{tag}</option>
                                    ))}
                                </select>
                            </div>
                        </div>
                        <div className="modal-footer">
                            {/* 개인 템플릿만 양식 내용 수정 가능 */}
                            {editingTemplate.isPersonal && editingTemplate.documentId && (
                                <button 
                                    className="modal-button secondary" 
                                    onClick={() => {
                                        handleEditPersonalTemplateContent(editingTemplate.documentId);
                                        // 모달은 닫지 않음 - 사용자가 양식 내용 수정 후 정보도 수정할 수 있도록
                                    }}
                                >
                                    양식 내용 수정
                                </button>
                            )}
                            {/* 기본 템플릿은 관리자만 수정 가능 (양식 내용 수정 불가) */}
                            {!editingTemplate.isPersonal && !isAdminUser && (
                                <div className="modal-info-text" style={{ color: '#666', fontSize: '12px', marginRight: 'auto' }}>
                                    기본 템플릿 수정은 관리자만 가능합니다.
                                </div>
                            )}
                            <div className="modal-button-group">
                                <button className="modal-button cancel" onClick={handleEditDocCancel}>
                                    취소
                                </button>
                                <button 
                                    className="modal-button confirm" 
                                    onClick={handleUpdateDocSubmit}
                                    disabled={!editingTemplate.isPersonal && !isAdminUser}
                                >
                                    저장
                                </button>
                            </div>
                        </div>
                    </div>
                </div>
            )}

            {/* 파일명 입력 모달 */}
            {showFileNameModal && selectedTemplate && (
                <div className="filename-modal-overlay" onClick={closeFileNameModal}>
                    <div className="filename-modal-content" onClick={(e) => e.stopPropagation()}>
                        <div className="filename-modal-header">
                            <div className="header-left">
                                <h2>파일명 입력</h2>
                            </div>
                            <button className="filename-modal-close" onClick={closeFileNameModal}>
                                <span>&times;</span>
                            </button>
                        </div>
                        
                        <div className="filename-modal-body">
                            <div className="template-info">
                                <div className="template-details">
                                    <h3>{selectedTemplate.title}</h3>
                                    <p>템플릿을 사용하여 문서를 생성합니다</p>
                                </div>
                            </div>

                            <div className="filename-section">
                                <div className="form-group-large">
                                    <input
                                        id="filename-input"
                                        type="text"
                                        className="form-input-large"
                                        placeholder="예) 2024년 1월 정기회의록"
                                        value={documentTitle}
                                        onChange={(e) => setDocumentTitle(e.target.value)}
                                        autoFocus
                                    />
                                </div>
                            </div>
                        </div>

                        <div className="filename-modal-actions">
                            <button type="button" className="action-btn cancel-btn" onClick={closeFileNameModal}>
                                <span>취소</span>
                            </button>
                            <button 
                                type="button" 
                                className="action-btn save-btn" 
                                onClick={openPermissionModal}
                                disabled={!documentTitle.trim()}
                            >
                                <span>다음 단계</span>
                            </button>
                        </div>
                    </div>
                </div>
            )}

            {/* 관리자 전용: 기본 템플릿 업로드 모달 */}
            {showSharedUploadModal && (
              <div className="document-modal-overlay" onClick={resetSharedUpload}>
                <div className="document-modal-content has-file-upload" onClick={(e)=>e.stopPropagation()}>
                  <div className="document-modal-header">
                    <div className="header-left">
                      <h2>기본 템플릿 업로드</h2>
                    </div>
                    <button className="document-modal-close" onClick={resetSharedUpload}><span>&times;</span></button>
                  </div>
                  <div className="document-modal-body">
                    <div className="form-section">
                      <div className="form-group-large">
                        <div className="file-upload-area">
                          <input id="shared-file" type="file" accept=".doc,.docx,.xls,.xlsx" className="file-input" onChange={handleSharedFilePick} />
                          <div className="file-upload-display" onClick={() => document.getElementById('shared-file')?.click()}>
                            {sharedUploadFile ? (
                              <div className="uploaded-file">
                                <FaFile className="file-icon" />
                                <span className="file-name">{sharedUploadFile.name}</span>
                                <span className="file-size">({(sharedUploadFile.size/1024/1024).toFixed(2)} MB)</span>
                              </div>
                            ) : (
                              <div className="upload-placeholder">
                                <FaFolderOpen className="upload-icon" />
                                <span className="upload-text">파일을 선택하거나 여기에 드래그하세요</span>
                                <span className="upload-hint">지원 형식: .docx, .xlsx, .doc, .xls</span>
                              </div>
                            )}
                          </div>
                        </div>
                      </div>
                    </div>
                    <div className="form-section">
                      <div className="form-group-large">
                        <input className="form-input-large" placeholder="제목" value={sharedMeta.title} onChange={(e)=>setSharedMeta({...sharedMeta, title: e.target.value})} />
                      </div>
                      <div className="form-group-large">
                        <textarea className="form-textarea-large" rows={3} placeholder="설명" value={sharedMeta.description} onChange={(e)=>setSharedMeta({...sharedMeta, description: e.target.value})} />
                      </div>
                      <div className="form-group-large">
                        <select className="form-select-large" value={sharedMeta.tag || ""} onChange={(e)=>setSharedMeta({...sharedMeta, tag: e.target.value})}>
                          <option value="">카테고리 선택 안 함</option>
                          {/* 기본 템플릿은 기본 태그만 선택 가능 */}
                          {(staticTags.length > 0 ? staticTags : ['기본']).map(tag => (<option key={tag} value={tag}>{tag}</option>))}
                        </select>
                      </div>
                    </div>
                  </div>
                  <div className="document-modal-actions">
                    <button type="button" className="action-btn cancel-btn" onClick={resetSharedUpload}><span>취소</span></button>
                    <button type="button" className="action-btn save-btn" disabled={!sharedUploadFile || !sharedMeta.title || !sharedMeta.tag} onClick={async ()=>{
                      if(!sharedUploadFile) return; 
                      const res = await uploadSharedTemplate(sharedUploadFile, { ...sharedMeta, creatorEmail: userInfo.email });
                      if(res.success){
                        showNotification('업로드 완료', 'success');
                        resetSharedUpload();
                      } else {
                        showNotification('업로드 실패: ' + (res.message||'알 수 없는 오류'), 'error');
                      }
                    }}>
                      <span>업로드</span>
                    </button>
                  </div>
                </div>
              </div>
            )}

            {/* 권한 설정 모달 - 개선된 UI */}
            {isPermissionModalOpen && selectedTemplate && (
                <div className="permission-modal-overlay" onClick={closePermissionModal}>
                    <div className="permission-modal-content" onClick={(e) => e.stopPropagation()}>
                        <div className="permission-modal-header">
                            <div className="header-left">
                                <h2>🔐 문서 생성 설정</h2>
                                <p className="header-subtitle">문서 접근 권한을 설정해주세요</p>
                            </div>
                            <button className="permission-modal-close" onClick={closePermissionModal}>
                                <span>&times;</span>
                            </button>
                        </div>
                        
                        <div className="permission-modal-body">
                            <div className="template-info">
                                <div className="template-icon">📄</div>
                                <div className="template-details">
                                    <h3>{selectedTemplate.title}</h3>
                                    <p>문서를 생성합니다</p>
                                </div>
                            </div>

                            <div className="permission-section">
                                <h4 className="section-title">문서 접근 권한</h4>
                                <div className="permission-options">
                                    <button
                                        type="button"
                                        className={`permission-option ${permissionType === 'private' ? 'active' : ''}`}
                                        onClick={() => setPermissionType('private')}
                                    >
                                        <div className="option-icon">🔒</div>
                                        <div className="option-content">
                                            <div className="option-title">나만 보기</div>
                                            <div className="option-desc">개인 문서로 생성</div>
                                        </div>
                                    </button>
                                    <button
                                        type="button"
                                        className={`permission-option ${permissionType === 'shared' ? 'active' : ''}`}
                                        onClick={() => setPermissionType('shared')}
                                    >
                                        <div className="option-icon">👥</div>
                                        <div className="option-content">
                                            <div className="option-title">권한 부여</div>
                                            <div className="option-desc">다른 사용자와 공유</div>
                                        </div>
                                    </button>
                                </div>
                            </div>

                            {permissionType === 'shared' && (
                                <div className="sharing-options">
                                    <h4 className="section-title">공유 설정</h4>
                                    
                                    <div className="group-permissions-section">
                                        <h5 className="subsection-title">그룹 권한</h5>
                                        <div className="group-permissions">
                                            {Object.entries(ENV_CONFIG.GROUP_EMAILS).map(([key, email]) => (
                                                <label key={key} className="group-permission-item">
                                                    <input
                                                        type="checkbox"
                                                        checked={selectedGroups.includes(key)}
                                                        onChange={(e) => {
                                                            if (e.target.checked) {
                                                                setSelectedGroups([...selectedGroups, key]);
                                                            } else {
                                                                setSelectedGroups(selectedGroups.filter(group => group !== key));
                                                            }
                                                        }}
                                                    />
                                                    <span className="checkbox-custom"></span>
                                                    <span className="group-name">
                                                        {key === 'STUDENT' && '학생'}
                                                        {key === 'COUNCIL' && '집행부'}
                                                        {key === 'PROFESSOR' && '교수'}
                                                        {key === 'ADJUNCT_PROFESSOR' && '겸임교원'}
                                                        {key === 'ASSISTANT' && '조교'}
                                                    </span>
                                                </label>
                                            ))}
                                        </div>
                                    </div>

                                    <div className="individual-emails-section">
                                        <h5 className="subsection-title">개별 이메일</h5>
                                        <div className="individual-emails">
                                            {individualEmails.map((email, index) => (
                                                <div key={index} className="email-input-group">
                                                    <EmailAutocomplete
                                                        value={email}
                                                        onChange={(value) => {
                                                            const newEmails = [...individualEmails];
                                                            newEmails[index] = value;
                                                            setIndividualEmails(newEmails);
                                                        }}
                                                        placeholder="이름이나 이메일을 입력하세요"
                                                        className="email-input"
                                                    />
                                                    <button
                                                        type="button"
                                                        onClick={() => {
                                                            const newEmails = individualEmails.filter((_, i) => i !== index);
                                                            setIndividualEmails(newEmails);
                                                        }}
                                                        className="remove-email-btn"
                                                        title="이메일 제거"
                                                    >
                                                        ×
                                                    </button>
                                                </div>
                                            ))}
                                            <button
                                                type="button"
                                                onClick={() => setIndividualEmails([...individualEmails, ''])}
                                                className="add-email-btn"
                                            >
                                                <span>+</span> 이메일 추가
                                            </button>
                                        </div>
                                    </div>
                                </div>
                            )}
                        </div>

                        <div className="permission-modal-actions">
                            <button type="button" className="action-btn cancel-btn" onClick={closePermissionModal}>
                                <span>취소</span>
                            </button>
                            <button 
                                type="button" 
                                className="action-btn save-btn" 
                                onClick={createDocument}
                                disabled={isCreating}
                            >
                                <span>{isCreating ? '문서 생성중...' : '📄 문서 생성'}</span>
                            </button>
                        </div>
                    </div>
                </div>
            )}

            {/* 문서 생성 후 선택 모달 */}
            {showAfterCreateModal && (
                <div className="after-create-modal-overlay" onClick={closeAfterCreateModal}>
                    <div className="after-create-modal-content" onClick={(e) => e.stopPropagation()}>
                        <div className="after-create-modal-header">
                            <div className="header-left">
                                <h2>🎉 문서 생성 완료!</h2>
                                <p className="header-subtitle">문서가 성공적으로 생성되었습니다</p>
                            </div>
                            <button className="after-create-modal-close" onClick={closeAfterCreateModal}>
                                <span>&times;</span>
                            </button>
                        </div>
                        
                        <div className="after-create-modal-body">
                            <div className="success-info">
                                <div className="success-icon">✅</div>
                                <div className="success-details">
                                    <h3>{documentTitle}</h3>
                                    <p>문서가 Google Drive에 저장되었습니다</p>
                                </div>
                            </div>

                            <div className="action-options">
                                <h4 className="options-title">다음에 무엇을 하시겠습니까?</h4>
                                <div className="option-buttons">
                                    <button 
                                        type="button" 
                                        className="option-btn primary-btn" 
                                        onClick={openDocument}
                                    >
                                        <div className="option-icon">📄</div>
                                        <div className="option-content">
                                            <div className="option-title">문서 바로 보기</div>
                                            <div className="option-desc">새 탭에서 문서를 열어 편집합니다</div>
                                        </div>
                                    </button>
                                    
                                    <button 
                                        type="button" 
                                        className="option-btn secondary-btn" 
                                        onClick={goToDocumentManagement}
                                    >
                                        <div className="option-icon">📁</div>
                                        <div className="option-content">
                                            <div className="option-title">문서관리로 이동</div>
                                            <div className="option-desc">문서관리에서 생성된 문서를 확인합니다</div>
                                        </div>
                                    </button>
                                </div>
                            </div>
                        </div>

                        <div className="after-create-modal-actions">
                            <button type="button" className="action-btn cancel-btn" onClick={closeAfterCreateModal}>
                                <span>닫기</span>
                            </button>
                        </div>
                    </div>
                </div>
            )}

            {/* 알림 모달 */}
            <NotificationModal
                isOpen={notification.isOpen}
                message={notification.message}
                type={notification.type}
                onClose={hideNotification}
                duration={notification.duration}
            />

            {/* 확인 모달 */}
            <ConfirmModal
                isOpen={confirm.isOpen}
                message={confirm.message}
                title={confirm.title}
                confirmText={confirm.confirmText}
                cancelText={confirm.cancelText}
                type={confirm.type}
                onConfirm={handleConfirm}
                onCancel={hideConfirm}
                onCancelAction={confirm.onCancelAction}
            />
        </div>
    );
}

export default NewDocument;