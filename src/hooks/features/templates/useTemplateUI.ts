/**
 * @file useTemplateUI.ts
 * @brief 템플릿 UI 관리 훅
 * @details 템플릿 목록, 검색, 필터링, CRUD 작업을 관리하는 커스텀 훅입니다.
 * @author Hot Potato Team
 * @date 2024
 */

import { useMemo, useCallback, useState, useEffect } from "react";
import {
    copyGoogleDocument,
    getSheetIdByName,
    checkSheetExists,
    createNewSheet,
    getSheetData,
    appendSheetData
} from "../../../utils/google/googleSheetUtils";
import { ENV_CONFIG } from "../../../config/environment";
import { apiClient } from "../../../utils/api/apiClient";
import { usePersonalTemplates } from "./usePersonalTemplates";
import type { CreateDocumentResponse, SharedTemplatesResponse } from "../../../types/api/apiResponses";
import { 
  addFavorite,
  removeFavorite,
  isFavorite as checkIsFavorite
} from "../../../utils/database/personalFavoriteManager";
import { initializePersonalConfigFile } from "../../../utils/database/personalConfigManager";
import { useNotification } from "../../ui/useNotification";

/**
 * @brief 템플릿 데이터 타입 정의
 * @details Google Sheets와 연동되는 템플릿 데이터의 구조를 정의합니다.
 */
export interface Template {
    rowIndex?: number;      // Google Sheet row index, optional for initial templates
    type: string;          // 템플릿 종류 (예: meeting, finance 등)
    title: string;         // 템플릿 제목
    description: string;   // 템플릿 설명
    tag: string;           // 카테고리 태그 (예: 회의, 재정 등)
    partTitle?: string;    // For filtering
    documentId?: string;   // Google Doc ID
    favoritesTag?: string; // 즐겨찾기 태그
    isPersonal?: boolean;  // 개인 템플릿 여부
    mimeType?: string;    // 파일 MIME 타입 (문서/스프레드시트 구분용)
}

/**
 * @brief 기본 템플릿 목록 (동적으로 로드됨)
 * @details 앱스크립트에서 hot_potato/문서/양식 폴더의 파일들을 가져와서 사용합니다.
 */
export const defaultTemplates: Template[] = [
    { type: "empty", title: "빈 문서", description: "아무것도 없는 빈 문서에서 시작합니다.", tag: "기본" },
];

/**
 * @brief 기본 템플릿 태그 목록
 * @details 기본 템플릿에서 추출한 고유한 태그들의 배열입니다.
 */
export const defaultTemplateTags = [...new Set(defaultTemplates.map(template => template.tag))];

/**
 * @brief 초기 템플릿 데이터 배열
 * @details 빈 배열로 초기화되는 템플릿 데이터입니다.
 */
export const initialTemplates: Template[] = [];

/**
 * @brief 템플릿 UI 관리 커스텀 훅
 * @details 템플릿 목록, 검색, 필터링, CRUD 작업을 관리하는 커스텀 훅입니다.
 * @param {Template[]} templates - 템플릿 목록
 * @param {Function} onPageChange - 페이지 변경 핸들러
 * @param {string} searchTerm - 검색어
 * @param {string} activeTab - 활성 탭
 * @returns {Object} 템플릿 관련 상태와 핸들러 함수들
 */
export function useTemplateUI(
    templates: Template[], 
    onPageChange: (pageName: string) => void,
    searchTerm: string,
    activeTab: string
) {
    const { showNotification } = useNotification();
    // 동적 템플릿 상태
  const [dynamicTemplates, setDynamicTemplates] = useState<Template[]>([]);
  const [isLoadingTemplates, setIsLoadingTemplates] = useState(false);
  const [templateError, setTemplateError] = useState<string | null>(null);
  
  // 개인 템플릿 훅 사용
  const { 
    personalTemplates, 
    isLoading: isLoadingPersonalTemplates, 
    error: personalTemplateError,
    convertToTemplates,
    togglePersonalTemplateFavorite,
    generateFileNameFromTemplate,
    loadPersonalTemplates
  } = usePersonalTemplates();
  
  // 권한 설정 모달 상태
  const [isPermissionModalOpen, setIsPermissionModalOpen] = useState(false);
  const [selectedTemplate, setSelectedTemplate] = useState<Template | null>(null);
  const [permissionType, setPermissionType] = useState<'private' | 'shared'>('private');
  const [selectedGroups, setSelectedGroups] = useState<string[]>([]);
  const [individualEmails, setIndividualEmails] = useState<string[]>([]);

  // 기본 템플릿 즐겨찾기 상태
  const [defaultTemplateFavorites, setDefaultTemplateFavorites] = useState<string[]>([]);
  const [isLoadingFavorites, setIsLoadingFavorites] = useState(false);

    // 동적 템플릿 로드 함수
    const testDriveApi = useCallback(async () => {
        try {
            console.log('🔧 Drive API 테스트 시작');
            const result = await apiClient.testDriveApi();
            console.log('🔧 Drive API 테스트 결과:', result);
            
            if (result && result.success) {
                console.log('✅ Drive API 연결 성공');
                return { success: true, message: 'Drive API 연결 성공' };
            } else {
                const errorMessage = result ? result.message : 'Drive API 테스트 실패';
                console.error('❌ Drive API 테스트 실패:', errorMessage);
                return { success: false, message: errorMessage };
            }
        } catch (error) {
            console.error('❌ Drive API 테스트 오류:', error);
            return { success: false, message: 'Drive API 테스트 중 오류가 발생했습니다' };
        }
    }, []);

    const testTemplateFolderDebug = useCallback(async () => {
        try {
            console.log('🔍 템플릿 폴더 디버깅 테스트 시작');
            const result = await apiClient.testTemplateFolderDebug();
            console.log('🔍 템플릿 폴더 디버깅 테스트 결과:', result);
            
            if (result && result.success) {
                console.log('✅ 디버깅 테스트 성공');
                return { success: true, message: '디버깅 테스트 성공', data: result };
            } else {
                const errorMessage = result ? result.message : '디버깅 테스트 실패';
                console.error('❌ 디버깅 테스트 실패:', errorMessage);
                return { success: false, message: errorMessage };
            }
        } catch (error) {
            console.error('❌ 디버깅 테스트 오류:', error);
            return { success: false, message: '디버깅 테스트 중 오류가 발생했습니다' };
        }
    }, []);

    const testSpecificFolder = useCallback(async () => {
        try {
            console.log('🔍 특정 폴더 ID 테스트 시작');
            const result = await apiClient.testSpecificFolder();
            console.log('🔍 특정 폴더 ID 테스트 결과:', result);
            
            if (result && result.success) {
                console.log('✅ 특정 폴더 테스트 성공');
                return { success: true, message: '특정 폴더 테스트 성공', data: result };
            } else {
                const errorMessage = result ? result.message : '특정 폴더 테스트 실패';
                console.error('❌ 특정 폴더 테스트 실패:', errorMessage);
                return { success: false, message: errorMessage };
            }
        } catch (error) {
            console.error('❌ 특정 폴더 테스트 오류:', error);
            return { success: false, message: '특정 폴더 테스트 중 오류가 발생했습니다' };
        }
    }, []);

    const loadDynamicTemplates = useCallback(async () => {
        setIsLoadingTemplates(true);
        setTemplateError(null);
        
        try {
            console.log('📄 동적 템플릿 로드 시작');
            
            // 캐시에서 먼저 확인
            const { getCacheManager } = await import('../../../utils/cache/cacheManager');
            const cacheManager = getCacheManager();
            const { generateCacheKey, getActionCategory } = await import('../../../utils/cache/cacheUtils');
            const action = 'getSharedTemplates';
            const category = getActionCategory(action);
            const cacheKey = generateCacheKey(category, action, {});
            
            // apiClient는 ApiResponse 형식으로 캐시에 저장하므로, ApiResponse 형식으로 조회
            interface ApiResponse<T> {
                success: boolean;
                data?: T;
                message?: string;
            }
            const cachedResponse = await cacheManager.get<ApiResponse<SharedTemplatesResponse>>(cacheKey);
            console.log('📄 캐시 키:', cacheKey);
            console.log('📄 캐시 응답:', cachedResponse);
            
            if (cachedResponse && cachedResponse.success && cachedResponse.data && Array.isArray(cachedResponse.data) && cachedResponse.data.length > 0) {
                console.log('📄 캐시에서 동적 템플릿 로드:', cachedResponse.data.length, '개');
                const processedTemplates = cachedResponse.data.map((t) => ({
                  type: t.id,
                  title: t.title,
                  description: t.description,
                  tag: t.tag || '기본',
                  documentId: t.id,
                  mimeType: t.mimeType || 'application/vnd.google-apps.document'
                }));
                setDynamicTemplates(processedTemplates);
                setIsLoadingTemplates(false);
                return;
            }
            
            // 캐시에 없으면 API 호출
            console.log('📄 캐시 미스 - API에서 동적 템플릿 로드');
            const result = await apiClient.getSharedTemplates();
            console.log('📄 API 응답:', result);
            
            if (result && result.success && result.data) {
                console.log('📄 동적 템플릿 로드 성공:', result.data);
                
                // 템플릿 데이터 그대로 사용 (JSON 파싱 제거)
                const templatesData = result.data as SharedTemplatesResponse;
                const processedTemplates = templatesData.map((t) => ({
                  type: t.id, // 문서 ID 사용
                  title: t.title,
                  description: t.description,
                  tag: t.tag || '기본',
                  documentId: t.id,
                  mimeType: t.mimeType || 'application/vnd.google-apps.document' // 파일 타입 포함
                }));
                
                setDynamicTemplates(processedTemplates);
            } else {
                const errorMessage = result ? result.message : 'API 응답이 null입니다';
                console.error('📄 동적 템플릿 로드 실패:', errorMessage);
                const createResponse = result as CreateDocumentResponse;
                console.error('📄 디버깅 정보:', createResponse.debug);
                setTemplateError(errorMessage || '템플릿을 불러올 수 없습니다');
            }
        } catch (error) {
            console.error('📄 동적 템플릿 로드 오류:', error);
            setTemplateError('템플릿을 불러오는 중 오류가 발생했습니다');
        } finally {
            setIsLoadingTemplates(false);
        }
    }, []);

    // 공유 템플릿 업로드 (관리자 전용 사용 예정)
    const uploadSharedTemplate = useCallback(async (file: File, meta: { title: string; description: string; tag: string; creatorEmail?: string; }) => {
      const toBase64 = (f: File) => new Promise<string>((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = () => resolve((reader.result as string).split(',')[1] || '');
        reader.onerror = reject;
        reader.readAsDataURL(f);
      });
      const base64 = await toBase64(file);
      const res = await apiClient.uploadSharedTemplate({
        fileName: file.name,
        fileMimeType: file.type || 'application/vnd.google-apps.document',
        fileContentBase64: base64,
        meta
      });
      if (res.success) await loadDynamicTemplates();
      return res;
    }, [loadDynamicTemplates]);

    // 컴포넌트 마운트 시 동적 템플릿 로드
    useEffect(() => {
        loadDynamicTemplates();
    }, [loadDynamicTemplates]);

    // 기본 템플릿 즐겨찾기 로드
    const loadDefaultTemplateFavorites = useCallback(async () => {
        setIsLoadingFavorites(true);
        try {
            console.log('⭐ 기본 템플릿 즐겨찾기 로드 시작');
            
            // 개인 설정 파일 초기화
            await initializePersonalConfigFile();
            
            // 기본 템플릿 즐겨찾기 목록 가져오기
            const { getFavoritesByType } = await import('../../../utils/database/personalFavoriteManager');
            const favorites = await getFavoritesByType('기본');
            
            setDefaultTemplateFavorites(favorites);
            console.log('✅ 기본 템플릿 즐겨찾기 로드 완료:', favorites.length + '개');
        } catch (error) {
            console.error('❌ 기본 템플릿 즐겨찾기 로드 오류:', error);
        } finally {
            setIsLoadingFavorites(false);
        }
    }, []);

    // 기본 템플릿 즐겨찾기 토글
    const toggleDefaultTemplateFavorite = useCallback(async (template: Template) => {
        try {
            console.log('⭐ 기본 템플릿 즐겨찾기 토글:', template);
            
            const favoriteData = {
                type: '기본' as const,
                favorite: template.title
            };

            const isCurrentlyFavorite = defaultTemplateFavorites.includes(template.title);
            
            if (isCurrentlyFavorite) {
                // 즐겨찾기 해제
                const success = await removeFavorite(favoriteData);
                if (success) {
                    setDefaultTemplateFavorites(prev => prev.filter(fav => fav !== template.title));
                    console.log('✅ 기본 템플릿 즐겨찾기 해제 완료');
                }
            } else {
                // 즐겨찾기 추가
                const success = await addFavorite(favoriteData);
                if (success) {
                    setDefaultTemplateFavorites(prev => [...prev, template.title]);
                    console.log('✅ 기본 템플릿 즐겨찾기 추가 완료');
                }
            }
        } catch (error) {
            console.error('❌ 기본 템플릿 즐겨찾기 토글 오류:', error);
        }
    }, [defaultTemplateFavorites]);

    // 컴포넌트 마운트 시 기본 템플릿 즐겨찾기 로드
    useEffect(() => {
        loadDefaultTemplateFavorites();
    }, [loadDefaultTemplateFavorites]);

    // 개인 템플릿을 일반 템플릿 형식으로 변환
    const convertedPersonalTemplates = useMemo(() => {
        return convertToTemplates(personalTemplates);
    }, [personalTemplates, convertToTemplates]);

    // 기본 템플릿과 동적 템플릿만 결합 (개인 템플릿은 별도 처리)
    const allDefaultTemplates = useMemo(() => {
        return [...defaultTemplates, ...dynamicTemplates];
    }, [dynamicTemplates]);

    // 필터링 및 정렬된 템플릿 목록을 계산 (searchTerm, filterOption, activeTab이 바뀔 때마다 재계산)
    const filteredTemplates = useMemo(() => {
        let result = templates;

        // 1) 탭(카테고리) 필터링
        if (activeTab !== "전체") result = result.filter((template) => template.tag === activeTab);

        // 2) 검색어 필터링
        if (searchTerm.trim())
            result = result.filter(
                (template) => template.title.includes(searchTerm) || template.description.includes(searchTerm)
            );

        return result;
    }, [templates, searchTerm, activeTab]);

    // 템플릿 사용 버튼 클릭 시 실행되는 함수
    const onUseTemplate = useCallback((type: string, title: string, role: string) => {
        console.log('📄 템플릿 사용 시작:', { type, title, role });
        
        const isDefault = allDefaultTemplates.some(t => t.type === type);
        
        // 템플릿 찾기 (type이 Google Doc ID이므로 title로도 검색)
        const foundTemplate = allDefaultTemplates.find(t => t.type === type || t.title === title);
        
        // 특별한 처리가 필요한 템플릿들 (스프레드시트 등)
        const specialTemplateUrls: { [key: string]: string } = {
            "fee_deposit_list": "https://docs.google.com/spreadsheets/d/1Detd9Qwc9vexjMTFYAPtISvFJ3utMx-96OxTVCth24w/edit?gid=0#gid=0",
        };

        // 스프레드시트 템플릿의 경우 기존 방식 사용 (URL 복사)
        if (specialTemplateUrls[type]) {
            window.open(specialTemplateUrls[type].replace('/edit', '/copy'), '_blank');
            return;
        }

        // URL인 경우 직접 열기
        if (type.startsWith('http')) {
            window.open(type, '_blank');
            return;
        }

        // 템플릿 정보를 모달에 전달하고 모달 열기 (tag 포함)
        const template: Template = {
            type,
            title,
            description: foundTemplate?.description || '',
            tag: foundTemplate?.tag || '기본',  // 템플릿의 tag 사용
            documentId: type.length > 20 ? type : undefined
        };
        
        setSelectedTemplate(template);
        setPermissionType('private'); // 기본값: 나만 보기
        setSelectedGroups([]);
        setIndividualEmails([]);
        setIsPermissionModalOpen(true);
    }, [onPageChange, allDefaultTemplates]);

    // 실제 문서 생성 함수 (모달에서 호출)
    const createDocument = useCallback(async () => {
        if (!selectedTemplate) return;

        const userInfo = JSON.parse(localStorage.getItem('user') || '{}');
        const creatorEmail = userInfo.email || '';

        if (!creatorEmail) {
            showNotification('사용자 정보를 찾을 수 없습니다. 다시 로그인해주세요.', 'error');
            return;
        }

        try {
            if (permissionType === 'private') {
                // 나만 보기: 프론트엔드에서 직접 Google Drive API 사용
                console.log('📄 개인 드라이브에 문서 생성:', selectedTemplate);
                
                if (selectedTemplate.documentId) {
                    // 커스텀 템플릿 복사 (태그 포함)
                    const copyResult = await copyGoogleDocument(selectedTemplate.documentId, selectedTemplate.title, selectedTemplate.tag);
                    if (copyResult && copyResult.webViewLink) {
                        window.open(copyResult.webViewLink, '_blank');
                        showNotification('문서가 개인 드라이브에 생성되었습니다!', 'success');
                    }
                } else {
                    // 기본 템플릿 (빈 문서 등) - Google Docs 새 문서 생성 URL 사용
                    try {
                        // Google Docs의 새 문서 생성 URL을 사용
                        const newDocUrl = 'https://docs.google.com/document/create';
                        window.open(newDocUrl, '_blank');
                        showNotification('새 문서가 생성되었습니다!', 'success');
                    } catch (error) {
                        console.error('📄 개인 문서 생성 오류:', error);
                        showNotification('문서 생성 중 오류가 발생했습니다.', 'error');
                    }
                }
            } else {
                // 권한 부여: 앱스크립트에 요청
                console.log('📄 권한 부여 문서 생성:', { selectedTemplate, selectedGroups, individualEmails });
                
                // 선택된 그룹들을 이메일로 변환
                const groupEmails = selectedGroups.map(groupKey => ENV_CONFIG.GROUP_EMAILS[groupKey as keyof typeof ENV_CONFIG.GROUP_EMAILS]); // ENV v2: VITE_GROUP_EMAIL 기반
                // 빈 이메일은 제외
                const validIndividualEmails = individualEmails.filter(email => email.trim() !== '');
                const allEditors = [...groupEmails, ...validIndividualEmails];
                
                console.log('📄 선택된 템플릿 정보:', {
                    title: selectedTemplate.title,
                    documentId: selectedTemplate.documentId,
                    type: selectedTemplate.type,
                    templateType: selectedTemplate.documentId || selectedTemplate.type,
                    tag: selectedTemplate.tag
                });
                
                const documentData = {
                    title: selectedTemplate.title,
                    templateType: selectedTemplate.documentId || selectedTemplate.type,
                    creatorEmail: creatorEmail,
                    editors: allEditors,
                    role: 'student', // 기본값으로 student 설정
                    tag: selectedTemplate.tag // 태그 추가
                };
                
                console.log('📄 API로 전송할 데이터:', documentData);
                
                const result = await apiClient.createDocument(documentData);

                if (result.success && result.data) {
                    const createDocResponse = result.data as CreateDocumentResponse;
                    window.open(createDocResponse.documentUrl, '_blank');
                    showNotification('문서가 생성되고 권한이 설정되었습니다!', 'success');
                } else {
                    showNotification('문서 생성에 실패했습니다: ' + (result.message || '알 수 없는 오류'), 'error');
                }
            }
        } catch (error) {
            console.error('📄 문서 생성 오류:', error);
            showNotification('문서 생성 중 오류가 발생했습니다.', 'error');
        } finally {
            // 모달 닫기
            setIsPermissionModalOpen(false);
            setSelectedTemplate(null);
        }
    }, [selectedTemplate, permissionType, selectedGroups, individualEmails]);

    // 모달 닫기 함수
    const closePermissionModal = useCallback(() => {
        setIsPermissionModalOpen(false);
        setSelectedTemplate(null);
        setPermissionType('private');
        setSelectedGroups([]);
        setIndividualEmails([]);
    }, []);

    // 훅에서 관리하는 상태, 함수들을 객체로 반환
    return {
        filteredTemplates, // 필터링/정렬된 템플릿 목록
        onUseTemplate,     // 템플릿 사용 함수
        allDefaultTemplates, // 모든 기본 템플릿 (정적 + 동적 + 개인)
        isLoadingTemplates: isLoadingTemplates || isLoadingPersonalTemplates, // 전체 템플릿 로딩 상태
        templateError: templateError || personalTemplateError, // 템플릿 로딩 오류
        loadDynamicTemplates, // 동적 템플릿 다시 로드 함수
        // 개인 템플릿 관련
        personalTemplates: convertedPersonalTemplates, // 개인 템플릿 목록
        isLoadingPersonalTemplates, // 개인 템플릿 로딩 상태
        personalTemplateError, // 개인 템플릿 오류
        togglePersonalTemplateFavorite, // 개인 템플릿 즐겨찾기 토글
        generateFileNameFromTemplate, // 파일명 생성 함수
        loadPersonalTemplates, // 개인 템플릿 다시 로드 함수
        // 기본 템플릿 즐겨찾기 관련
        defaultTemplateFavorites, // 기본 템플릿 즐겨찾기 목록
        isLoadingFavorites, // 즐겨찾기 로딩 상태
        toggleDefaultTemplateFavorite, // 기본 템플릿 즐겨찾기 토글
        testDriveApi, // Drive API 테스트 함수
        testTemplateFolderDebug, // 템플릿 폴더 디버깅 테스트 함수
        testSpecificFolder, // 특정 폴더 ID 테스트 함수
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
        createDocument,
        closePermissionModal,
        uploadSharedTemplate,
    };
}
