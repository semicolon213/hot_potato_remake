import { logger } from '../../utils/logger';
/**
 * @file useAppState.ts
 * @brief 전역 애플리케이션 상태 관리 훅
 * @details 사용자 인증, 페이지 상태, 데이터 로딩 등을 관리하는 중앙화된 상태 관리 훅입니다.
 * @author Hot Potato Team
 * @date 2024
 */

import { useState, useEffect, useCallback } from 'react';
import type { User, PageType, Post, Event, DateRange, CustomPeriod, Student, Staff } from '../../types/app';
import type { Template } from '../features/templates/useTemplateUI';
import { initializeGoogleAPIOnce } from '../../utils/google/googleApiInitializer';
import {
    initializeSpreadsheetIds,
    fetchAnnouncements,
    fetchTemplates,
    fetchCalendarEvents,
    fetchAttendees
} from '../../utils/database/papyrusManager';
import { fetchTags as fetchPersonalTags } from '../../utils/database/personalTagManager';
import { ENV_CONFIG } from '../../config/environment';
import { tokenManager } from '../../utils/auth/tokenManager';
import { getDataSyncService } from '../../services/dataSyncService';
import { useDataSyncState } from './useDataSyncState';
import { apiClient } from '../../utils/api/apiClient';
import { useNotification } from '../ui/useNotification';
import { useAppDataStore } from '../../stores/appDataStore';
const log = logger.scope('hooks/core/useAppState');


/**
 * @brief 전역 애플리케이션 상태 관리 훅
 * @details 애플리케이션의 모든 상태를 중앙에서 관리하며, Google API 초기화와 데이터 로딩을 담당합니다.
 * @returns {Object} 애플리케이션 상태와 핸들러 함수들
 */
export const useAppState = () => {
    const { showNotification } = useNotification();
    
    // User authentication state
    const [user, setUser] = useState<User | null>(null);
    const [isLoading, setIsLoading] = useState(true);
    const [isGapiReady, setIsGapiReady] = useState(false);
    
    const dataSync = useDataSyncState();
    const {
      isInitializingData,
      setIsInitializingData,
      dataSyncProgress,
      setDataSyncProgress,
      lastSyncTime,
      setLastSyncTime,
      hasInitialized,
      setHasInitialized,
      dataSyncServiceRef,
    } = dataSync;

    // Original app state (액세스 토큰은 App에서 tokenManager 단일 소스로 관리)
    const [currentPage, setCurrentPage] = useState<PageType>("dashboard");
    const [customTemplates, setCustomTemplates] = useState<Template[]>([]);
    const [isTemplatesLoading, setIsTemplatesLoading] = useState(true);
    const [tags, setTags] = useState<string[]>([]);

    const { announcements, setAnnouncements, calendarEvents, setCalendarEvents } = useAppDataStore();
    const [selectedAnnouncement, setSelectedAnnouncement] = useState<Post | null>(null);
    const [isGoogleAuthenticatedForAnnouncements, setIsGoogleAuthenticatedForAnnouncements] = useState(false);
    const [isAnnouncementsLoading, setIsAnnouncementsLoading] = useState(false);
    const [announcementSpreadsheetId, setAnnouncementSpreadsheetId] = useState<string | null>(null);
    const [hotPotatoDBSpreadsheetId, setHotPotatoDBSpreadsheetId] = useState<string | null>(null);
    const [studentSpreadsheetId, setStudentSpreadsheetId] = useState<string | null>(null);
    const [staffSpreadsheetId, setStaffSpreadsheetId] = useState<string | null>(null);
    const [calendarProfessorSpreadsheetId, setCalendarProfessorSpreadsheetId] = useState<string | null>(null);
    const [calendarCouncilSpreadsheetId, setCalendarCouncilSpreadsheetId] = useState<string | null>(null);
    const [calendarADProfessorSpreadsheetId, setCalendarADProfessorSpreadsheetId] = useState<string | null>(null);
    const [calendarSuppSpreadsheetId, setCalendarSuppSpreadsheetId] = useState<string | null>(null);
    const [calendarStudentSpreadsheetId, setCalendarStudentSpreadsheetId] = useState<string | null>(null);
    const [activeCalendarSpreadsheetId, setActiveCalendarSpreadsheetId] = useState<string | null>(null);
    const [searchTerm, setSearchTerm] = useState("");

    const [isCalendarLoading, setIsCalendarLoading] = useState(false);
    const [semesterStartDate, setSemesterStartDate] = useState(new Date());
    const [finalExamsPeriod, setFinalExamsPeriod] = useState<DateRange>({ start: null, end: null });
    const [midtermExamsPeriod, setMidtermExamsPeriod] = useState<DateRange>({ start: null, end: null });
    const [gradeEntryPeriod, setGradeEntryPeriod] = useState<DateRange>({ start: null, end: null });
    const [customPeriods, setCustomPeriods] = useState<CustomPeriod[]>([]);

    // State for Attendees
    const [students, setStudents] = useState<Student[]>([]);
    const [staff, setStaff] = useState<Staff[]>([]);

    // 환경변수에서 시트 이름 가져오기 (ENV v2에서 DEFAULT_SHEET_NAME로 매핑됨)
    const announcementSheetName = ENV_CONFIG.ANNOUNCEMENT_SHEET_NAME;
    const calendarSheetName = ENV_CONFIG.CALENDAR_SHEET_NAME;

    // 로그인 상태 확인 및 초기화
    useEffect(() => {
        const initApp = async () => {
            const savedUser = localStorage.getItem('user');
            // tokenManager를 통해 토큰 가져오기 (만료 체크 포함)
            const savedToken = tokenManager.get();
            const savedSearchTerm = localStorage.getItem('searchTerm');

            // URL 파라미터에서 페이지 상태 복원 (리팩터링 전 방식)
            const urlParams = new URLSearchParams(window.location.search);
            const pageFromUrl = urlParams.get('page');
            if (pageFromUrl) {
                // log.debug('URL에서 페이지 상태 복원:', pageFromUrl);
                setCurrentPage(pageFromUrl as PageType);
            } else {
                // URL에 페이지 파라미터가 없으면 기본값 사용
                setCurrentPage("dashboard");
            }

            // 선택된 공지사항 상태 복원
            const savedSelectedAnnouncement = localStorage.getItem('selectedAnnouncement');
            if (savedSelectedAnnouncement) {
                try {
                    setSelectedAnnouncement(JSON.parse(savedSelectedAnnouncement));
                } catch (e) {
                    log.error("Failed to parse saved selected announcement:", e);
                    localStorage.removeItem('selectedAnnouncement');
                }
            }

            // 검색어 상태 복원
            if (savedSearchTerm) {
                // log.debug('검색어 상태 복원:', savedSearchTerm);
                setSearchTerm(savedSearchTerm);
            }

            // 토큰이 유효하고 사용자 정보가 있으면 로그인 상태 복원 (토큰은 tokenManager에 있음)
            if (savedUser && savedToken) {
                const userData = JSON.parse(savedUser);
                setUser(userData);

                // 승인된 사용자인 경우 데이터 초기화
                if (userData.isApproved) {
                    // log.debug('새로고침 후 사용자 상태 복원 - 데이터 로딩 시작');

                    try {
                        // log.debug("Google API 초기화 시작");
                        await initializeGoogleAPIOnce(hotPotatoDBSpreadsheetId);

                        // 스프레드시트 ID들 초기화
                        const spreadsheetIds = await initializeSpreadsheetIds();

                        // 스프레드시트 ID들 상태 업데이트
                        setAnnouncementSpreadsheetId(spreadsheetIds.announcementSpreadsheetId);
                        setCalendarProfessorSpreadsheetId(spreadsheetIds.calendarProfessorSpreadsheetId);
                        setCalendarCouncilSpreadsheetId(spreadsheetIds.calendarCouncilSpreadsheetId);
                        setCalendarADProfessorSpreadsheetId(spreadsheetIds.calendarADProfessorSpreadsheetId);
                        setCalendarSuppSpreadsheetId(spreadsheetIds.calendarSuppSpreadsheetId);
                        setCalendarStudentSpreadsheetId(spreadsheetIds.calendarStudentSpreadsheetId);
                        setHotPotatoDBSpreadsheetId(spreadsheetIds.hotPotatoDBSpreadsheetId);
                        setStudentSpreadsheetId(spreadsheetIds.studentSpreadsheetId);
                        setStaffSpreadsheetId(spreadsheetIds.staffSpreadsheetId);

                        setIsGapiReady(true);
                        setIsGoogleAuthenticatedForAnnouncements(true);

                        // log.debug("새로고침 후 Papyrus DB 연결 완료");
                    } catch (error) {
                        log.error("Error during refresh initialization", error);
                        // Google API 초기화 실패해도 계속 진행
                        setIsGapiReady(true);
                        setIsGoogleAuthenticatedForAnnouncements(true);
                    }
                }
            }

            setIsLoading(false);
        };

        initApp();
    }, []);

    // 페이지 상태는 URL 파라미터로 관리되므로 localStorage 저장 불필요

    // 검색어 상태 변경 시 localStorage에 저장
    useEffect(() => {
        if (searchTerm) {
            localStorage.setItem('searchTerm', searchTerm);
        } else {
            localStorage.removeItem('searchTerm');
        }
    }, [searchTerm]);

    // DataSyncService 초기화 및 apiClient에 주입
    useEffect(() => {
        const dataSyncService = dataSyncServiceRef.current;
        apiClient.setDataSyncService(dataSyncService);
        
        // 주기적 백그라운드 동기화 시작 (스마트 갱신)
        dataSyncService.startPeriodicSync();
        
        // 현재 페이지 설정
        dataSyncService.setCurrentPage(currentPage);
        
        // 정리 함수
        return () => {
            dataSyncService.stopPeriodicSync();
        };
    }, []);

    // 페이지 변경 시 DataSyncService에 알림
    useEffect(() => {
        const dataSyncService = dataSyncServiceRef.current;
        dataSyncService.setCurrentPage(currentPage);
    }, [currentPage]);

    // 사용자 로그인 시 ID가 준비되면 앱을 표시하고 나머지 데이터는 백그라운드에서 로드
    useEffect(() => {
        if (user && user.isApproved && !isLoading && !isInitializingData && !hasInitialized) {
            const initAndFetch = async () => {
                setIsInitializingData(true);
                setDataSyncProgress({ current: 0, total: 0, message: '데이터 로딩 중...' });

                try {
                    await initializeGoogleAPIOnce(hotPotatoDBSpreadsheetId);

                    const dataSyncService = dataSyncServiceRef.current;

                    const categoryLabels: Record<string, string> = {
                        announcements: '공지사항',
                        calendar: '캘린더',
                        documents: '문서',
                        templates: '템플릿',
                        tags: '태그',
                        workflow: '워크플로우',
                        students: '학생',
                        staff: '교직원',
                        attendees: '참석자',
                        users: '사용자',
                        accounting: '회계'
                    };

                    const spreadsheetIds = await initializeSpreadsheetIds();

                    setAnnouncementSpreadsheetId(spreadsheetIds.announcementSpreadsheetId);
                    setCalendarProfessorSpreadsheetId(spreadsheetIds.calendarProfessorSpreadsheetId);
                    setCalendarCouncilSpreadsheetId(spreadsheetIds.calendarCouncilSpreadsheetId);
                    setCalendarADProfessorSpreadsheetId(spreadsheetIds.calendarADProfessorSpreadsheetId);
                    setCalendarSuppSpreadsheetId(spreadsheetIds.calendarSuppSpreadsheetId);
                    setCalendarStudentSpreadsheetId(spreadsheetIds.calendarStudentSpreadsheetId);
                    setHotPotatoDBSpreadsheetId(spreadsheetIds.hotPotatoDBSpreadsheetId);
                    setStudentSpreadsheetId(spreadsheetIds.studentSpreadsheetId);
                    setStaffSpreadsheetId(spreadsheetIds.staffSpreadsheetId);

                    setIsGapiReady(true);
                    setIsGoogleAuthenticatedForAnnouncements(true);
                    setHasInitialized(true);
                    setIsInitializingData(false);

                    await dataSyncService.initializeDataFull(user, (progress) => {
                        const label = progress.category ? categoryLabels[progress.category] : undefined;
                        const message =
                            progress.message ||
                            (label ? `${label} 데이터를 로딩 중입니다...` : '데이터 로딩 중...');

                        setDataSyncProgress({
                            current: progress.current,
                            total: progress.total,
                            message
                        });
                    });

                    setLastSyncTime(dataSyncService.getLastSyncTime());
                    showNotification('준비되었습니다. 핵심 데이터가 로드되었습니다.', 'success');
                    // 2단계(문서/학생·교직원 등)는 백그라운드에서 로드
                    void dataSyncService.initializePhase2(user, (progress) => {
                        const label = progress.category ? categoryLabels[progress.category] : undefined;
                        const message = progress.message || (label ? `${label} 데이터를 로딩 중입니다...` : '백그라운드 동기화 중...');
                        setDataSyncProgress({ current: progress.current, total: progress.total, message });
                    }).then(() => {
                        setLastSyncTime(dataSyncService.getLastSyncTime());
                    });
                } catch (error) {
                    log.error("Error during login initialization", error);
                    const errorMessage = error instanceof Error ? error.message : '알 수 없는 오류';
                    setIsGapiReady(false);
                    setIsGoogleAuthenticatedForAnnouncements(false);
                    setHasInitialized(true);
                    setIsInitializingData(false);
                    showNotification(`데이터 초기화 중 오류가 발생했습니다: ${errorMessage}`, 'error', 5000);
                }
            };

            initAndFetch();
        }
    }, [user, isLoading, isInitializingData, hasInitialized]);

    // 사용자 유형에 따라 활성 캘린더 스프레드시트 ID 설정
    useEffect(() => {
        if (user && user.userType) {
            let targetId: string | null = null;
            switch (user.userType) {
                case 'professor':
                    targetId = calendarProfessorSpreadsheetId;
                    break;
                case 'student':
                    targetId = calendarStudentSpreadsheetId;
                    break;
                case 'council':
                    targetId = calendarCouncilSpreadsheetId;
                    break;
                case 'ADprofessor':
                    targetId = calendarADProfessorSpreadsheetId;
                    break;
                case 'supp':
                case 'support': // 호환성을 위해 둘 다 지원
                    targetId = calendarSuppSpreadsheetId;
                    break;
                default:
                    log.warn("Unknown userType");
                    targetId = calendarStudentSpreadsheetId;
                    break;
            }
            setActiveCalendarSpreadsheetId(targetId);
        } else {
            setActiveCalendarSpreadsheetId(null);
        }
    }, [user, calendarProfessorSpreadsheetId, calendarStudentSpreadsheetId, calendarCouncilSpreadsheetId, calendarADProfessorSpreadsheetId, calendarSuppSpreadsheetId]);

    // 데이터 로드 useEffect들
    useEffect(() => {
        if (isGapiReady && announcementSpreadsheetId && user?.studentId && user?.userType) {
            const loadAnnouncements = async () => {
                setIsAnnouncementsLoading(true);
                try {
                    const announcementsData = await fetchAnnouncements(user.studentId, user.userType);
                    setAnnouncements(announcementsData);
                } catch (error) {
                    log.error('Error loading announcements:', error);
                } finally {
                    setIsAnnouncementsLoading(false);
                }
            };
            loadAnnouncements();
        }
    }, [isGapiReady, announcementSpreadsheetId, user?.studentId, user?.userType]);

    useEffect(() => {
        if (isGapiReady && (calendarProfessorSpreadsheetId || calendarStudentSpreadsheetId || calendarCouncilSpreadsheetId || calendarADProfessorSpreadsheetId || calendarSuppSpreadsheetId)) {
            const loadCalendarEvents = async () => {
                setIsCalendarLoading(true);
                try {
                    const events = await fetchCalendarEvents();
                    setCalendarEvents(events);
                } catch (error) {
                    log.error('Error loading calendar events:', error);
                } finally {
                    setIsCalendarLoading(false);
                }
            };
            loadCalendarEvents();
        }
    }, [isGapiReady, calendarProfessorSpreadsheetId, calendarStudentSpreadsheetId, calendarCouncilSpreadsheetId, calendarADProfessorSpreadsheetId, calendarSuppSpreadsheetId]);

    useEffect(() => {
        if (isGapiReady) {
            const fetchTemplateData = async () => {
                try {
                    const [templates, tags] = await Promise.all([
                        fetchTemplates(),
                        fetchPersonalTags()
                    ]);

                    setCustomTemplates(templates);
                    setTags(tags);
                } catch (error) {
                    log.error("Error during template data fetch", error);
                } finally {
                    setIsTemplatesLoading(false);
                }
            };
            fetchTemplateData();
        }
    }, [isGapiReady]);

    useEffect(() => {
        if (isGapiReady && studentSpreadsheetId && staffSpreadsheetId) {
            const loadAttendees = async () => {
                try {
                    const { students, staff } = await fetchAttendees();
                    setStudents(students);
                    setStaff(staff);
                } catch (error) {
                    log.error('Error loading attendees:', error);
                }
            };
            loadAttendees();
        }
    }, [isGapiReady, studentSpreadsheetId, staffSpreadsheetId]);

    /**
     * @brief 모든 상태 초기화 함수
     * @details 로그아웃 또는 계정 전환 시 모든 상태를 초기화합니다.
     */
    const resetAllState = useCallback(() => {

        // 사용자 상태 초기화 (토큰은 App에서 tokenManager.clear()로 제거)
        setUser(null);
        setCurrentPage("dashboard");
        setSearchTerm("");

        // 템플릿 상태 초기화
        setCustomTemplates([]);
        setTags([]);
        setIsTemplatesLoading(true);

        // 공지사항 상태 초기화
        setAnnouncements([]);
        setSelectedAnnouncement(null);
        setIsGoogleAuthenticatedForAnnouncements(false);
        setIsAnnouncementsLoading(false);
        setAnnouncementSpreadsheetId(null);

        // 캘린더 상태 초기화
        setCalendarEvents([]);
        setIsCalendarLoading(false);
        setSemesterStartDate(null);
        setFinalExamsPeriod(null);
        setMidtermExamsPeriod(null);
        setGradeEntryPeriod(null);
        setCustomPeriods([]);
        setCalendarProfessorSpreadsheetId(null);
        setCalendarStudentSpreadsheetId(null);

        // 스프레드시트 ID 상태 초기화
        setHotPotatoDBSpreadsheetId(null);
        setStudentSpreadsheetId(null);
        setStaffSpreadsheetId(null);

        // 참석자 상태 초기화
        setStudents([]);
        setStaff([]);

        // Google API 상태 초기화
        setIsGapiReady(false);

        // DataSyncService 관련 상태 초기화
        setIsInitializingData(false);
        setDataSyncProgress({ current: 0, total: 0, message: '' });
        setLastSyncTime(null);
        setHasInitialized(false);
    }, []);

    // 수동 데이터 갱신 함수
    const handleRefreshAllData = useCallback(async () => {
        if (!user) return;
        
        setIsInitializingData(true);
        setDataSyncProgress({ current: 0, total: 0, message: '갱신 중...' });
        
        try {
            const dataSyncService = dataSyncServiceRef.current;
            await dataSyncService.refreshAllData((progress) => {
                setDataSyncProgress({
                    current: progress.current,
                    total: progress.total,
                    message: progress.message || ''
                });
            });
            
            const lastSync = dataSyncService.getLastSyncTime();
            setLastSyncTime(lastSync);
            showNotification('데이터 갱신이 완료되었습니다.', 'success');
        } catch (error) {
            log.error('전체 데이터 갱신 실패:', error);
            const errorMessage = error instanceof Error ? error.message : '알 수 없는 오류';
            showNotification(`데이터 갱신에 실패했습니다: ${errorMessage}`, 'error', 5000);
            throw error;
        } finally {
            setIsInitializingData(false);
        }
    }, [user, showNotification]);

    return {
        // User state
        user,
        setUser,
        isLoading,
        isGapiReady,
        
        // DataSyncService 관련 상태
        isInitializingData,
        dataSyncProgress,
        lastSyncTime,
        handleRefreshAllData,

        // Page state
        currentPage,
        setCurrentPage,
        searchTerm,
        setSearchTerm,

        // Template state
        customTemplates,
        setCustomTemplates,
        isTemplatesLoading,
        tags,
        setTags,

        // Announcements state
        announcements,
        setAnnouncements,
        selectedAnnouncement,
        setSelectedAnnouncement,
        isGoogleAuthenticatedForAnnouncements,
        setIsGoogleAuthenticatedForAnnouncements,
        isAnnouncementsLoading,
        setIsAnnouncementsLoading,
        announcementSpreadsheetId,

        // Calendar state
        calendarEvents,
        setCalendarEvents,
        isCalendarLoading,
        setIsCalendarLoading,
        semesterStartDate,
        setSemesterStartDate,
        finalExamsPeriod,
        setFinalExamsPeriod,
        midtermExamsPeriod,
        setMidtermExamsPeriod,
        gradeEntryPeriod,
        setGradeEntryPeriod,
        customPeriods,
        setCustomPeriods,
        calendarProfessorSpreadsheetId,
        calendarCouncilSpreadsheetId,
        calendarADProfessorSpreadsheetId,
        calendarSuppSpreadsheetId,
        calendarStudentSpreadsheetId,
        activeCalendarSpreadsheetId,

        // Attendees state
        students,
        staff,

        // Other spreadsheet IDs
        hotPotatoDBSpreadsheetId,
        studentSpreadsheetId,
        staffSpreadsheetId,

        // Constants
        announcementSheetName,
        calendarSheetName,

        // State reset function
        resetAllState
    };
};
