/**
 * @file papyrusManager.ts
 * @brief Papyrus DB 관리 유틸리티
 * @details papyrus-db npm 패키지를 사용하여 Google 스프레드시트와 상호작용하는 중앙화된 유틸리티 모듈입니다.
 * @author Hot Potato Team
 * @date 2024
 */

import {getSheetData, append, update} from 'papyrus-db';
import {deleteRow} from 'papyrus-db/dist/sheets/delete';
import {ENV_CONFIG} from '../../config/environment';
import {apiClient} from '../api/apiClient';
import {tokenManager} from '../auth/tokenManager';
import {getCacheManager} from '../cache/cacheManager';
import {getDataSyncService} from '../../services/dataSyncService';
import {generateCacheKey, getCacheTTL, getActionCategory} from '../cache/cacheUtils';
import type {StaffMember, Committee as CommitteeType} from '../../types/features/staff';
import type {SpreadsheetIdsResponse, AnnouncementsResponse, AnnouncementItem, StudentIssue} from '../../types/api/apiResponses';

// 헬퍼 함수들
const addRow = async (spreadsheetId: string, sheetName: string, data: Record<string, unknown>) => {
    await append(spreadsheetId, sheetName, data);
};

const updateRow = async (spreadsheetId: string, sheetName: string, key: string, data: Record<string, unknown>) => {
    await update(spreadsheetId, sheetName, key, data);
};

// papyrus-db에 Google API 인증 설정
const setupPapyrusAuth = () => {
    if (window.gapi && window.gapi.client) {
        // papyrus-db가 gapi.client를 사용하도록 설정
        window.papyrusAuth = {
            client: window.gapi.client
        };
    }
};
import type {Post, Event, DateRange, CustomPeriod, Student, Staff} from '../../types/app';
import type {Template} from '../../hooks/features/templates/useTemplateUI';

// 스프레드시트 ID들을 저장할 변수들
let hotPotatoDBSpreadsheetId: string | null = null;
let announcementSpreadsheetId: string | null = null;
let calendarProfessorSpreadsheetId: string | null = null;
let calendarCouncilSpreadsheetId: string | null = null;
let calendarADProfessorSpreadsheetId: string | null = null;
let calendarSuppSpreadsheetId: string | null = null;
let calendarStudentSpreadsheetId: string | null = null;
let studentSpreadsheetId: string | null = null;
let staffSpreadsheetId: string | null = null;
let accountingFolderId: string | null = null;

/**
 * @brief 스프레드시트 ID 전역 변수 초기화
 * @details 로그아웃 또는 계정 전환 시 모든 스프레드시트 ID를 초기화합니다.
 */
// 회계 폴더 ID 접근 함수
export const getAccountingFolderId = (): string | null => {
    return accountingFolderId;
};

export const clearSpreadsheetIds = (): void => {
    hotPotatoDBSpreadsheetId = null;
    announcementSpreadsheetId = null;
    calendarProfessorSpreadsheetId = null;
    calendarStudentSpreadsheetId = null;
    calendarCouncilSpreadsheetId = null;
    calendarADProfessorSpreadsheetId = null;
    calendarSuppSpreadsheetId = null;
    studentSpreadsheetId = null;
    staffSpreadsheetId = null;
    accountingFolderId = null;
    console.log('🧹 스프레드시트 ID 전역 변수 초기화 완료');
};

/**
 * @brief 드라이브 루트에 있는 프로젝트 루트 폴더 ID 조회
 * @returns {Promise<string | null>} 루트 폴더 ID 또는 null
 */
const getProjectRootFolderId = async (): Promise<string | null> => {
    if (!window.gapi?.client) return null;
    const rootFolderName = ENV_CONFIG.ROOT_FOLDER_NAME || 'hot_potato_remake';
    const safeName = rootFolderName.replace(/\\/g, '\\\\').replace(/'/g, "\\'");
    const response = await window.gapi.client.drive.files.list({
        q: `'root' in parents and name='${safeName}' and mimeType='application/vnd.google-apps.folder' and trashed=false`,
        fields: 'files(id, name)'
    });
    if (response.result.files && response.result.files.length > 0) {
        return response.result.files[0].id;
    }
    return null;
};

/**
 * @brief 스프레드시트 ID 찾기 함수 (드라이브 루트의 프로젝트 루트 폴더 하위에서만 검색)
 * @param {string} name - 찾을 스프레드시트의 이름
 * @returns {Promise<string | null>} 스프레드시트 ID 또는 null
 */
export const findSpreadsheetById = async (name: string): Promise<string | null> => {
    try {
        if (!window.gapi || !window.gapi.client) {
            console.warn(`Google API가 초기화되지 않았습니다. 스프레드시트 '${name}' 검색을 건너뜁니다.`);
            return null;
        }

        const token = tokenManager.get();
        if (!token) {
            console.warn(`Google API 인증 토큰이 없거나 만료되었습니다. 스프레드시트 '${name}' 검색을 건너뜁니다.`);
            return null;
        }

        try {
            window.gapi.client.setToken({ access_token: token });
        } catch (tokenError) {
            console.warn(`토큰 설정 실패:`, tokenError);
        }

        let attempts = 0;
        const maxAttempts = 3;

        while (attempts < maxAttempts) {
            try {
                console.log(`스프레드시트 '${name}' 검색 중 (프로젝트 루트 폴더 하위)... (시도 ${attempts + 1}/${maxAttempts})`);

                const rootFolderId = await getProjectRootFolderId();
                if (!rootFolderId) {
                    console.warn(`❌ 프로젝트 루트 폴더('${ENV_CONFIG.ROOT_FOLDER_NAME || 'hot_potato_remake'}')를 드라이브 루트에서 찾을 수 없습니다.`);
                    return null;
                }

                const safeName = name.replace(/\\/g, '\\\\').replace(/'/g, "\\'");
                const response = await window.gapi.client.drive.files.list({
                    q: `'${rootFolderId}' in parents and name='${safeName}' and mimeType='application/vnd.google-apps.spreadsheet' and trashed=false`,
                    fields: 'files(id, name)'
                });

                if (response.result.files && response.result.files.length > 0) {
                    const fileId = response.result.files[0].id;
                    return fileId;
                }

                // 루트 폴더 직하위에 없으면 하위 폴더들에서 재귀 검색 (SpreadsheetUtils 동작과 동일)
                const folderResponse = await window.gapi.client.drive.files.list({
                    q: `'${rootFolderId}' in parents and mimeType='application/vnd.google-apps.folder' and trashed=false`,
                    fields: 'files(id, name)'
                });
                const subFolders = folderResponse.result.files || [];
                for (const folder of subFolders) {
                    const subResponse = await window.gapi.client.drive.files.list({
                        q: `'${folder.id}' in parents and name='${safeName}' and mimeType='application/vnd.google-apps.spreadsheet' and trashed=false`,
                        fields: 'files(id, name)'
                    });
                    if (subResponse.result.files && subResponse.result.files.length > 0) {
                        return subResponse.result.files[0].id;
                    }
                }

                console.warn(`❌ 프로젝트 루트 폴더 하위에서 이름이 '${name}'인 스프레드시트를 찾을 수 없습니다.`);
                return null;
            } catch (apiError) {
                attempts++;
                console.error(`API 호출 실패 (${attempts}/${maxAttempts}):`, apiError);
                if (attempts >= maxAttempts) {
                    console.error(`❌ 스프레드시트 '${name}' 검색 실패:`, apiError);
                    return null;
                }
                await new Promise(resolve => setTimeout(resolve, 2000));
            }
        }

        return null;
    } catch (error) {
        console.warn(`Error searching for ${name} spreadsheet:`, error);
        return null;
    }
};

// 초기화 중복 방지
let isInitializing = false;
let initializationPromise: Promise<any> | null = null;

/**
 * @brief 스프레드시트 ID들 초기화 (Apps Script를 통한 일괄 조회)
 */
export const initializeSpreadsheetIds = async (): Promise<{
    announcementSpreadsheetId: string | null;
    calendarProfessorSpreadsheetId: string | null;
    calendarCouncilSpreadsheetId: string | null;
    calendarADProfessorSpreadsheetId: string | null;
    calendarSuppSpreadsheetId: string | null;
    calendarStudentSpreadsheetId: string | null;
    hotPotatoDBSpreadsheetId: string | null;
    studentSpreadsheetId: string | null;
    staffSpreadsheetId: string | null;
    accountingFolderId: string | null;
}> => {
    // 이미 초기화 중이면 기존 Promise 반환
    if (isInitializing && initializationPromise) {
        console.log('📊 스프레드시트 ID 초기화가 이미 진행 중입니다. 기존 요청을 재사용합니다.');
        return initializationPromise;
    }

    isInitializing = true;
    console.log('📊 스프레드시트 ID 초기화 시작 (Apps Script 방식)...');

    initializationPromise = (async () => {
        try {
        // 환경변수에서 스프레드시트 이름 목록 가져오기 (user_setting은 개인 설정 파일로 분리)
        const spreadsheetNames = [
            ENV_CONFIG.ANNOUNCEMENT_SPREADSHEET_NAME,           // ENV v2: NOTICE_SPREADSHEET_NAME 매핑
            ENV_CONFIG.CALENDAR_PROFESSOR_SPREADSHEET_NAME,
            ENV_CONFIG.CALENDAR_STUDENT_SPREADSHEET_NAME,
            ENV_CONFIG.CALENDAR_COUNCIL_SPREADSHEET_NAME,
            ENV_CONFIG.CALENDAR_ADPROFESSOR_SPREADSHEET_NAME,   // ENV v2: CALENDAR_ADJ_PROFESSOR_SPREADSHEET_NAME 매핑
            ENV_CONFIG.CALENDAR_SUPP_SPREADSHEET_NAME,          // ENV v2: CALENDAR_ASSISTANT_SPREADSHEET_NAME 매핑
            ENV_CONFIG.STUDENT_SPREADSHEET_NAME,
            ENV_CONFIG.STAFF_SPREADSHEET_NAME
        ];

        console.log('📋 조회할 스프레드시트 이름들:', spreadsheetNames);

        // Apps Script에 일괄 조회 요청
        const response = await apiClient.getSpreadsheetIds(spreadsheetNames);

        if (!response.success || !response.data) {
            console.error('❌ 스프레드시트 ID 조회 실패:', response.message || '알 수 없는 오류');
            // 개인 설정 파일은 별도로 초기화 시도
            const {findPersonalConfigFile} = await import('./personalConfigManager');
            const personalConfigId = await findPersonalConfigFile().catch(() => null);

            return {
                announcementSpreadsheetId: null,
                calendarProfessorSpreadsheetId: null,
                calendarStudentSpreadsheetId: null,
                calendarCouncilSpreadsheetId: null,
                calendarADProfessorSpreadsheetId: null,
                calendarSuppSpreadsheetId: null,
                hotPotatoDBSpreadsheetId: personalConfigId, // 개인 설정 파일 ID
                studentSpreadsheetId: null,
                staffSpreadsheetId: null,
                accountingFolderId: null
            };
        }

        const ids = response.data as SpreadsheetIdsResponse;

        // 찾지 못한 스프레드시트가 있으면 경고
        if (response.notFound && response.notFound.length > 0) {
            console.warn('⚠️ 찾지 못한 스프레드시트:', response.notFound);
        }

        // 결과 매핑 (user_setting은 개인 설정 파일로 별도 초기화, ENV v2 키 기준)
        const announcementId = ids[ENV_CONFIG.ANNOUNCEMENT_SPREADSHEET_NAME] || null;
        const calendarProfessorId = ids[ENV_CONFIG.CALENDAR_PROFESSOR_SPREADSHEET_NAME] || null;
        const calendarStudentId = ids[ENV_CONFIG.CALENDAR_STUDENT_SPREADSHEET_NAME] || null;
        const calendarCouncilId = ids[ENV_CONFIG.CALENDAR_COUNCIL_SPREADSHEET_NAME] || null;
        const calendarADProfessorId = ids[ENV_CONFIG.CALENDAR_ADPROFESSOR_SPREADSHEET_NAME] || null;
        const calendarSuppId = ids[ENV_CONFIG.CALENDAR_SUPP_SPREADSHEET_NAME] || null;
        const studentId = ids[ENV_CONFIG.STUDENT_SPREADSHEET_NAME] || null;
        const staffId = ids[ENV_CONFIG.STAFF_SPREADSHEET_NAME] || null;

        // 개인 설정 파일 ID와 회계 폴더 ID 병렬 조회 (서로 독립)
        const [personalConfigId, accountingFolderResponse] = await Promise.all([
          (async () => {
            const { findPersonalConfigFile } = await import('./personalConfigManager');
            return findPersonalConfigFile();
          })(),
          apiClient.request('getAccountingFolderId', {})
        ]);
        const accountingId = accountingFolderResponse.success && accountingFolderResponse.data?.accountingFolderId
            ? accountingFolderResponse.data.accountingFolderId
            : null;

        // 전역 변수 업데이트
        announcementSpreadsheetId = announcementId;
        calendarProfessorSpreadsheetId = calendarProfessorId;
        calendarCouncilSpreadsheetId = calendarCouncilId;
        calendarADProfessorSpreadsheetId = calendarADProfessorId;
        calendarSuppSpreadsheetId = calendarSuppId;
        calendarStudentSpreadsheetId = calendarStudentId;
        hotPotatoDBSpreadsheetId = personalConfigId; // 개인 설정 파일 ID로 설정
        studentSpreadsheetId = studentId;
        staffSpreadsheetId = staffId;
        accountingFolderId = accountingId;

        console.log('✅ 스프레드시트 ID 초기화 완료:', {
            announcement: !!announcementId,
            calendarProfessor: !!calendarProfessorId,
            calendarCouncil: !!calendarCouncilId,
            calendarADProfessor: !!calendarADProfessorId,
            calendarSupp: !!calendarSuppId,
            calendarStudent: !!calendarStudentId,
            hotPotatoDB: !!personalConfigId,
            student: !!studentId,
            staff: !!staffId,
            accountingFolder: !!accountingId
        });

        return {
            announcementSpreadsheetId: announcementId,
            calendarProfessorSpreadsheetId: calendarProfessorId,
            calendarCouncilSpreadsheetId: calendarCouncilId,
            calendarADProfessorSpreadsheetId: calendarADProfessorId,
            calendarSuppSpreadsheetId: calendarSuppId,
            calendarStudentSpreadsheetId: calendarStudentId,
            hotPotatoDBSpreadsheetId: personalConfigId, // 개인 설정 파일 ID
            studentSpreadsheetId: studentId,
            staffSpreadsheetId: staffId,
            accountingFolderId: accountingId
        };
    } catch (error) {
        console.error('❌ 스프레드시트 ID 초기화 중 오류:', error);
        console.warn('⚠️ 일부 기능이 제한될 수 있습니다.');
        // 개인 설정 파일은 별도로 초기화 시도
        const {findPersonalConfigFile} = await import('./personalConfigManager');
        const personalConfigId = await findPersonalConfigFile().catch(() => null);

        // 회계 폴더 ID는 에러 시에도 null로 반환
        return {
            announcementSpreadsheetId: null,
            calendarProfessorSpreadsheetId: null,
            calendarCouncilSpreadsheetId: null,
            calendarADProfessorSpreadsheetId: null,
            calendarSuppSpreadsheetId: null,
            calendarStudentSpreadsheetId: null,
            hotPotatoDBSpreadsheetId: personalConfigId, // 개인 설정 파일 ID
            studentSpreadsheetId: null,
            staffSpreadsheetId: null,
            accountingFolderId: null
        };
        } finally {
            isInitializing = false;
            initializationPromise = null;
        }
    })();

    return initializationPromise;
};

// 공지사항 관련 함수들 (앱스크립트 API 사용)
export const fetchAnnouncements = async (userId: string, userType: string): Promise<Post[]> => {
    try {
        if (!announcementSpreadsheetId) {
            console.warn('Announcement spreadsheet ID not found');
            return [];
        }

        if (!userId || !userType) {
            console.warn('User ID or User Type not provided');
            return [];
        }

        console.log(`Fetching announcements via Apps Script API for user: ${userId}, type: ${userType}`);
        
        const response = await apiClient.request('getAnnouncements', {
            spreadsheetName: ENV_CONFIG.ANNOUNCEMENT_SPREADSHEET_NAME, // ENV v2: NOTICE_SPREADSHEET_NAME에서 온 공지 스프레드시트명
            userId: userId,
            userType: userType
        });

        if (!response.success) {
            console.warn('Failed to fetch announcements:', response.message);
            return [];
        }

        // 앱스크립트 응답 구조: response.announcements 또는 response.data.announcements
        const announcementsResponse = response as AnnouncementsResponse;
        const announcementsData = announcementsResponse.announcements || announcementsResponse.data?.announcements || [];
        const announcements = announcementsData.map((ann: AnnouncementItem) => {
            // ID를 문자열로 통일 (앱스크립트에서 숫자로 올 수 있음)
            const announcementId = String(ann.id || ann.no_notice || '');
            return {
                id: announcementId,
                author: ann.writer_notice || '',
                writer_id: String(ann.writer_id || ''),
                writer_email: ann.writer_email || '',
                title: ann.title_notice || '',
                content: ann.content_notice || '',
                date: ann.date || new Date().toISOString().slice(0, 10),
                views: parseInt(ann.view_count || '0', 10),
                likes: 0,
                file_notice: ann.file_notice || '',
                access_rights: ann.access_rights || '',
                fix_notice: ann.fix_notice || '',
                isPinned: ann.fix_notice === 'O'
            };
        });

        console.log(`Loaded ${announcements.length} announcements`);
        return announcements;
    } catch (error) {
        console.error('Error fetching announcements:', error);
        return [];
    }
};

// [MERGE] File 1의 dataURLtoBlob 헬퍼 함수
const dataURLtoBlob = (dataurl: string) => {
    const arr = dataurl.split(',');
    const mime = arr[0].match(/:(.*?);/)?.[1];
    const bstr = atob(arr[1]);
    let n = bstr.length;
    const u8arr = new Uint8Array(n);
    while (n--) {
        u8arr[n] = bstr.charCodeAt(n);
    }
    return new Blob([u8arr], {type: mime});
};

// [MERGE] File 2의 uploadFileToDrive 헬퍼 함수
const uploadFileToDrive = async (file: File): Promise<{ name: string, url: string }> => {
    const token = tokenManager.get();
    if (!token) {
        throw new Error('Google Access Token not found or expired');
    }

    const folderId = '1nXDKPPjHZVQu_qqng4O5vu1sSahDXNpD'; // TODO: 환경변수로 분리 검토 (하드코딩된 Drive 폴더 ID)

    const fileMetadata = {
        name: file.name,
        parents: [folderId]
    };

    const form = new FormData();
    form.append('metadata', new Blob([JSON.stringify(fileMetadata)], {type: 'application/json'}));
    form.append('file', file);

    const uploadResponse = await fetch('https://www.googleapis.com/upload/drive/v3/files?uploadType=multipart', {
        method: 'POST',
        headers: new Headers({'Authorization': 'Bearer ' + token}),
        body: form,
    });

    const uploadedFile = await uploadResponse.json();

    if (uploadedFile.id) {
        const fileId = uploadedFile.id;

        await window.gapi.client.drive.permissions.create({
            fileId: fileId,
            resource: {
                role: 'reader',
                type: 'anyone'
            }
        });

        const fileInfo = await window.gapi.client.drive.files.get({
            fileId: fileId,
            fields: 'webViewLink'
        });

        return {name: file.name, url: fileInfo.result.webViewLink};
    } else {
        console.error('File upload failed:', uploadedFile);
        throw new Error('File upload failed');
    }
};

// 공지사항 작성 (앱스크립트 API 사용)
export const addAnnouncement = async (announcementSpreadsheetId: string, postData: {
    title: string;
    content: string;
    author: string;
    writer_id: string;
    writerEmail: string; // 작성자 이메일 (암호화용)
    attachments: File[];
    accessRights?: { individual?: string[]; groups?: string[] }; // 권한 설정
    isPinned?: boolean;
    userType?: string;
}): Promise<void> => {
    try {
        if (!announcementSpreadsheetId) {
            throw new Error('Announcement spreadsheet ID not found');
        }

        if (!postData.writerEmail) {
            throw new Error('Writer email is required');
        }

        setupPapyrusAuth();
        const token = tokenManager.get();
        if (!token) {
            throw new Error('Google Access Token not found or expired');
        }
        
        try {
            window.gapi.client.setToken({access_token: token});
        } catch (tokenError) {
            console.error('Failed to set GAPI token:', tokenError);
            throw new Error('Failed to set GAPI token');
        }

        let processedContent = postData.content;

        // Base64 이미지 처리 (프론트엔드에서 처리)
        const imgRegex = /<img src="(data:image\/[^;]+;base64,[^"]+)"[^>]*>/g;
        let match;
        const uploadPromises = [];

        while ((match = imgRegex.exec(postData.content)) !== null) {
            const fullImgTag = match[0]; // The entire <img ...> tag
            const base64Src = match[1]; // The base64 data URL
            const blob = dataURLtoBlob(base64Src);
            const folderId = '1nXDKPPjHZVQu_qqng4O5vu1sSahDXNpD'; // TODO: 환경변수로 분리 검토 (하드코딩된 Drive 폴더 ID)

            const fileMetadata = {
                name: `announcement-image-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
                parents: [folderId]
            };

            const form = new FormData();
            form.append('metadata', new Blob([JSON.stringify(fileMetadata)], {type: 'application/json'}));
            form.append('file', blob);

            const uploadPromise = fetch('https://www.googleapis.com/upload/drive/v3/files?uploadType=multipart', {
                method: 'POST',
                headers: new Headers({'Authorization': 'Bearer ' + token}),
                body: form,
            })
                .then(response => response.json())
                .then(async uploadedFile => {
                    if (uploadedFile.id) {
                        const fileId = uploadedFile.id;
                        // Make the file publicly readable
                        await window.gapi.client.drive.permissions.create({
                            fileId: fileId,
                            resource: {
                                role: 'reader',
                                type: 'anyone'
                            }
                        });

                        // Get the thumbnailLink for a potentially better-performing URL
                        const fileInfo = await window.gapi.client.drive.files.get({
                            fileId: fileId,
                            fields: 'thumbnailLink, webContentLink'
                        });
                        
                        // Prioritize thumbnailLink, fallback to webContentLink
                        const permanentUrl = fileInfo.result.thumbnailLink || fileInfo.result.webContentLink;

                        if (permanentUrl) {
                            // The thumbnailLink might be sized, remove the sizing parameter for flexibility
                            const baseUrl = permanentUrl.split('=s')[0];
                            return { oldTag: fullImgTag, newUrl: baseUrl };
                        } else {
                            console.error('webContentLink and thumbnailLink not found for file:', fileId);
                            return { oldTag: fullImgTag, newUrl: null };
                        }
                    } else {
                        console.error('File upload failed:', uploadedFile);
                        return { oldTag: fullImgTag, newUrl: null };
                    }
                });
            uploadPromises.push(uploadPromise);
        }

        const uploadedImages = await Promise.all(uploadPromises);
        uploadedImages.forEach(image => {
            if (image.newUrl) {
                // Replace the entire old <img> tag with a new one that only has the src
                const newImgTag = `<img src="${image.newUrl}">`;
                processedContent = processedContent.replace(image.oldTag, newImgTag);
            }
        });

        // 첨부파일 업로드 (프론트엔드에서 처리)
        let fileInfos: { name: string, url: string }[] = [];
        if (postData.attachments && postData.attachments.length > 0) {
            for (const file of postData.attachments) {
                const fileInfo = await uploadFileToDrive(file);
                fileInfos.push(fileInfo);
            }
        }

        // 첨부파일 링크를 컨텐츠에 추가
        let finalContent = processedContent;
        if (fileInfos.length > 0) {
            const attachmentLinks = fileInfos.map(info => `<p>첨부파일: <a href="${info.url}" target="_blank">${info.name}</a></p>`).join('\n');
            finalContent = `${processedContent}\n\n${attachmentLinks}`;
        }

        // file_notice JSON 문자열
        const fileNotice = fileInfos.length > 0 ? JSON.stringify(fileInfos) : '';

        // 낙관적 업데이트: 캐시에 먼저 추가 (임시 ID 사용)
        const tempId = `temp_${Date.now()}`;
        const cacheKeys = [
            generateCacheKey('announcements', 'getAnnouncements', { userId: postData.writer_id, userType: postData.userType || 'student' }),
            generateCacheKey('announcements', 'fetchAnnouncements', { userId: postData.writer_id, userType: postData.userType || 'student' }),
            'announcements:getAnnouncements:*',
            'announcements:fetchAnnouncements:*'
        ];
        
        const newPost: Post = {
            id: tempId,
            author: postData.author,
            writer_id: postData.writer_id,
            writer_email: postData.writerEmail,
            title: postData.title,
            content: finalContent,
            date: new Date().toISOString().slice(0, 10),
            views: 0,
            likes: 0,
            file_notice: fileNotice,
            access_rights: postData.accessRights ? JSON.stringify(postData.accessRights) : '',
            fix_notice: postData.isPinned ? 'O' : '',
            isPinned: postData.isPinned || false
        };
        
        let rollback: (() => Promise<void>) | null = null;
        try {
            rollback = await apiClient.optimisticUpdate<Post[]>('createAnnouncement', cacheKeys, (cachedData) => {
                if (!cachedData || !Array.isArray(cachedData)) {
                    return [newPost];
                }
                // 새 공지사항을 맨 앞에 추가
                return [newPost, ...cachedData];
            });
        } catch (optimisticError) {
            console.warn('⚠️ 낙관적 업데이트 실패 (계속 진행):', optimisticError);
        }

        // 앱스크립트 API 호출
        let response;
        try {
            response = await apiClient.request('createAnnouncement', {
                spreadsheetName: ENV_CONFIG.ANNOUNCEMENT_SPREADSHEET_NAME, // ENV v2: NOTICE_SPREADSHEET_NAME 매핑
                writerEmail: postData.writerEmail,
                writerName: postData.author,
                title: postData.title,
                content: finalContent,
                fileNotice: fileNotice,
                accessRights: postData.accessRights,
                isPinned: postData.isPinned || false
            });
        } catch (apiError) {
            // API 실패 시 롤백
            if (rollback) {
                await rollback();
            }
            throw apiError;
        }

        if (!response.success) {
            // API 실패 시 롤백
            if (rollback) {
                await rollback();
            }
            throw new Error(response.message || '공지사항 작성에 실패했습니다.');
        }

        console.log('공지사항이 성공적으로 저장되었습니다.');

        // 고정 공지 요청 (isPinned가 true이고 fix_notice가 '-'가 아닌 경우)
        if (postData.isPinned && response.data?.announcementId) {
            await apiClient.request('requestPinnedAnnouncement', {
                spreadsheetName: ENV_CONFIG.ANNOUNCEMENT_SPREADSHEET_NAME, // ENV v2: NOTICE_SPREADSHEET_NAME 매핑
                announcementId: response.data.announcementId,
                userId: postData.writer_id
            });
        }

    } catch (error) {
        console.error('Error saving announcement:', error);
        throw error;
    }
};

export const requestPinnedAnnouncementApproval = async (postData: { title: string; author: string; writer_id: string; userType: string; }) => {
    return apiClient.request('requestPinnedAnnouncementApproval', postData);
};

export const incrementViewCount = async (announcementId: string): Promise<void> => {
    try {
        if (!announcementSpreadsheetId) {
            console.warn('Announcement spreadsheet ID not found');
            return;
        }

        const response = await apiClient.request('incrementAnnouncementView', {
            spreadsheetName: ENV_CONFIG.ANNOUNCEMENT_SPREADSHEET_NAME, // ENV v2: NOTICE_SPREADSHEET_NAME 매핑
            announcementId: announcementId
        });

        if (!response.success) {
            console.warn('Failed to increment view count:', response.message);
        } else {
            console.log(`View count for announcement ${announcementId} updated`);
        }
    } catch (error) {
        console.error('Error incrementing view count:', error);
        // 조회수 증가는 중요하지 않으므로 에러를 throw하지 않음
    }
};

export const updateAnnouncement = async (announcementId: string, userId: string, postData: { 
    title: string; 
    content: string; 
    attachments: File[]; 
    existingAttachments: { name: string, url: string }[]; 
    accessRights?: { individual?: string[]; groups?: string[] };
    isPinned?: boolean; 
}): Promise<void> => {
    try {
        if (!announcementSpreadsheetId) {
            throw new Error('Announcement spreadsheet ID not found');
        }

        if (!userId) {
            throw new Error('User ID is required');
        }

        setupPapyrusAuth();
        const token = tokenManager.get();
        if (!token) {
            throw new Error('Google Access Token not found or expired');
        }
        
        try {
            window.gapi.client.setToken({access_token: token});
        } catch (tokenError) {
            console.error('Failed to set GAPI token:', tokenError);
            throw new Error('Failed to set GAPI token');
        }

        // 1. Upload new files
        let newFileInfos: { name: string, url: string }[] = [];
        if (postData.attachments && postData.attachments.length > 0) {
            for (const file of postData.attachments) {
                const fileInfo = await uploadFileToDrive(file);
                newFileInfos.push(fileInfo);
            }
        }

        // 2. Combine with existing files
        const allFileInfos = [...postData.existingAttachments, ...newFileInfos];

        // 3. Create new content and file_notice
        const attachmentRegex = /<p>첨부파일:.*?<\/p>/gs;
        const cleanContent = postData.content.replace(attachmentRegex, '').trim();

        let finalContent = cleanContent;
        if (allFileInfos.length > 0) {
            const attachmentLinks = allFileInfos.map(info => `<p>첨부파일: <a href="${info.url}" target="_blank">${info.name}</a></p>`).join('\n');
            finalContent = `${cleanContent}\n\n${attachmentLinks}`;
        }

        const fileNotice = allFileInfos.length > 0 ? JSON.stringify(allFileInfos) : '';

        // 4. 낙관적 업데이트: 캐시에 먼저 반영
        const cacheKeys = [
            generateCacheKey('announcements', 'getAnnouncements', { userId, userType: 'student' }),
            generateCacheKey('announcements', 'getAnnouncements', { userId, userType: 'professor' }),
            generateCacheKey('announcements', 'getAnnouncements', { userId, userType: 'council' }),
            generateCacheKey('announcements', 'fetchAnnouncements', { userId, userType: 'student' }),
            generateCacheKey('announcements', 'fetchAnnouncements', { userId, userType: 'professor' }),
            generateCacheKey('announcements', 'fetchAnnouncements', { userId, userType: 'council' }),
            'announcements:getAnnouncements:*',
            'announcements:fetchAnnouncements:*'
        ];
        
        let rollback: (() => Promise<void>) | null = null;
        try {
            rollback = await apiClient.optimisticUpdate<Post[]>('updateAnnouncement', cacheKeys, (cachedData) => {
                if (!cachedData || !Array.isArray(cachedData)) return cachedData;
                return cachedData.map(post => {
                    if (post.id === announcementId) {
                        return {
                            ...post,
                            title: postData.title,
                            content: cleanContent, // 첨부파일 링크 제외한 깨끗한 내용
                            file_notice: fileNotice,
                            access_rights: postData.accessRights ? JSON.stringify(postData.accessRights) : post.access_rights,
                            fix_notice: postData.isPinned ? 'O' : (post.fix_notice || ''),
                            isPinned: postData.isPinned || false
                        };
                    }
                    return post;
                });
            });
        } catch (optimisticError) {
            console.warn('⚠️ 낙관적 업데이트 실패 (계속 진행):', optimisticError);
        }

        // 5. 앱스크립트 API 호출
        let response;
        try {
            response = await apiClient.request('updateAnnouncement', {
                spreadsheetName: ENV_CONFIG.ANNOUNCEMENT_SPREADSHEET_NAME, // ENV v2: NOTICE_SPREADSHEET_NAME 매핑
                announcementId: announcementId,
                userId: userId,
                title: postData.title,
                content: finalContent,
                fileNotice: fileNotice,
                accessRights: postData.accessRights,
                isPinned: postData.isPinned
            });
        } catch (apiError) {
            // API 실패 시 롤백
            if (rollback) {
                await rollback();
            }
            throw apiError;
        }

        // 고정 공지 요청 처리 (isPinned가 true이고 기존에 요청하지 않은 경우)
        if (postData.isPinned && response.success) {
            try {
                await apiClient.request('requestPinnedAnnouncement', {
                    spreadsheetName: ENV_CONFIG.ANNOUNCEMENT_SPREADSHEET_NAME, // ENV v2: NOTICE_SPREADSHEET_NAME 매핑
                    announcementId: announcementId,
                    userId: userId
                });
            } catch (error) {
                console.error('고정 공지 요청 오류:', error);
                // 고정 공지 요청 실패해도 수정은 성공한 것으로 처리
            }
        }

        if (!response.success) {
            // API 실패 시 롤백
            if (rollback) {
                await rollback();
            }
            throw new Error(response.message || '공지사항 수정에 실패했습니다.');
        }

        console.log('Announcement updated successfully');
    } catch (error) {
        console.error('Error updating announcement:', error);
        throw error;
    }
};

export const deleteAnnouncement = async (spreadsheetId: string, announcementId: string, userId: string): Promise<void> => {
    try {
        if (!announcementSpreadsheetId) {
            throw new Error('Announcement spreadsheet ID not found');
        }

        if (!userId) {
            throw new Error('User ID is required');
        }

        // 낙관적 업데이트: 캐시에서 먼저 제거
        const cacheKeys = [
            generateCacheKey('announcements', 'getAnnouncements', { userId, userType: 'student' }),
            generateCacheKey('announcements', 'getAnnouncements', { userId, userType: 'professor' }),
            generateCacheKey('announcements', 'getAnnouncements', { userId, userType: 'council' }),
            generateCacheKey('announcements', 'fetchAnnouncements', { userId, userType: 'student' }),
            generateCacheKey('announcements', 'fetchAnnouncements', { userId, userType: 'professor' }),
            generateCacheKey('announcements', 'fetchAnnouncements', { userId, userType: 'council' }),
            'announcements:getAnnouncements:*',
            'announcements:fetchAnnouncements:*'
        ];
        
        let rollback: (() => Promise<void>) | null = null;
        try {
            rollback = await apiClient.optimisticUpdate<Post[]>('deleteAnnouncement', cacheKeys, (cachedData) => {
                if (!cachedData || !Array.isArray(cachedData)) return cachedData;
                return cachedData.filter(post => post.id !== announcementId);
            });
        } catch (optimisticError) {
            console.warn('⚠️ 낙관적 업데이트 실패 (계속 진행):', optimisticError);
        }

        // API 호출
        let response;
        try {
            response = await apiClient.request('deleteAnnouncement', {
                spreadsheetName: ENV_CONFIG.ANNOUNCEMENT_SPREADSHEET_NAME, // ENV v2: NOTICE_SPREADSHEET_NAME 매핑
                announcementId: announcementId,
                userId: userId
            });
        } catch (apiError) {
            // API 실패 시 롤백
            if (rollback) {
                await rollback();
            }
            throw apiError;
        }

        if (!response.success) {
            // API 실패 시 롤백
            if (rollback) {
                await rollback();
            }
            throw new Error(response.message || '공지사항 삭제에 실패했습니다.');
        }

        console.log(`Announcement with ID ${announcementId} deleted successfully.`);
    } catch (error) {
        console.error('Error deleting announcement:', error);
        throw error;
    }
};

// 템플릿 관련 함수들 (document_template 시트 방식 제거됨 - 폴더 기반 템플릿만 사용)
export const fetchTemplates = async (): Promise<Template[]> => [];
export const fetchTags = async (): Promise<string[]> => [];

/** @deprecated document_template 시트 방식 제거됨. 폴더 기반 템플릿만 사용. */
export const addTemplate = async (_newDocData: { title: string; description: string; tag: string; }): Promise<void> => {};

/** @deprecated document_template 시트 방식 제거됨. */
export const deleteTemplate = async (_rowIndex: number): Promise<void> => {};

/** @deprecated document_template 시트 방식 제거됨. */
export const updateTemplate = async (
    _rowIndex: number,
    _newDocData: { title: string; description: string; tag: string; },
    _documentId: string
): Promise<void> => {};

/** @deprecated document_template 시트 방식 제거됨. */
export const updateTemplateFavorite = async (_rowIndex: number, _favoriteStatus: string | undefined): Promise<void> => {};

// 캘린더 관련 함수들
export const fetchCalendarEvents = async (): Promise<Event[]> => {
    const cacheManager = getCacheManager();
    const action = 'fetchCalendarEvents';
    const category = getActionCategory(action);
    const cacheKey = generateCacheKey(category, action, {});
    
    // 캐시에서 먼저 확인
    const cachedData = await cacheManager.get<Event[]>(cacheKey);
    if (cachedData) {
        console.log('📅 캐시에서 캘린더 이벤트 로드:', cachedData.length, '개');
        return cachedData;
    }

    const allCalendarIds = [
        calendarProfessorSpreadsheetId,
        calendarStudentSpreadsheetId,
        calendarCouncilSpreadsheetId,
        calendarADProfessorSpreadsheetId,
        calendarSuppSpreadsheetId
    ].filter((id): id is string => !!id); // Filter out null/undefined IDs and assert type

    if (allCalendarIds.length === 0) {
        console.log('No calendar spreadsheet IDs are available.');
        return [];
    }

    try {
        console.log('📅 캘린더 이벤트 로드 시작 (캐시 미스)...');
        const allEvents: Event[] = [];
        
        for (const spreadsheetId of allCalendarIds) {
            try {
                console.log(`Fetching calendar events from spreadsheet: ${spreadsheetId}`);
                const data = await getSheetData(spreadsheetId, ENV_CONFIG.CALENDAR_SHEET_NAME); // ENV v2: DEFAULT_SHEET_NAME 기반 캘린더 시트명

                if (data && data.values && data.values.length > 1) {
                    const events = data.values.slice(1).map((row: string[], index: number) => ({
                        id: `${spreadsheetId}-${row[0] || index}`,
                        title: row[1] || '',
                        startDate: row[2] || '',
                        endDate: row[3] || '',
                        description: row[4] || '',
                        colorId: row[5] || '',
                        startDateTime: row[6] || '',
                        endDateTime: row[7] || '',
                        type: row[8] || '',
                        rrule: row[9] || '',
                        attendees: row[10] || '',
                    }));
                    allEvents.push(...events);
                }
            } catch (error: any) {
                // 403 오류는 권한 문제이므로 경고만 출력하고 계속 진행
                if (error?.status === 403 || error?.code === 403) {
                    console.warn(`⚠️ 스프레드시트 ${spreadsheetId}에 접근 권한이 없습니다.`);
                } else {
                    console.error(`Error fetching events from spreadsheet ${spreadsheetId}:`, error);
                }
                // Continue to next spreadsheet even if one fails
            }
        }

        console.log('📅 전체 캘린더 이벤트 로드 완료:', allEvents.length, '개');
        
        // 캐시에 저장
        const ttl = getCacheTTL(action);
        await cacheManager.set(cacheKey, allEvents, ttl);
        console.log('📅 캘린더 이벤트 캐시 저장 완료 (TTL:', ttl / 1000 / 60, '분)');
        
        return allEvents;
    } catch (error) {
        console.error('Error fetching calendar events from Google Sheets:', error);
        return [];
    }
};

export const addCalendarEvent = async (spreadsheetId: string, eventData: Omit<Event, 'id'>, userType: string): Promise<void> => {
    try {
        if (!spreadsheetId) {
            throw new Error('Calendar spreadsheet ID not found');
        }

        const data = await getSheetData(spreadsheetId, ENV_CONFIG.CALENDAR_SHEET_NAME); // ENV v2: DEFAULT_SHEET_NAME 기반 캘린더 시트명
        const existingIds = data && data.values ? data.values.slice(1).map(row => row[0]).filter(id => id && id.includes('-cal-')).map(id => parseInt(id.split('-').pop() || '0', 10)).filter(num => !isNaN(num)) : [];
        const maxId = existingIds.length > 0 ? Math.max(...existingIds) : 0;
        const newEventId = `${userType}-cal-${maxId + 1}`;

        const newEventForSheet = [
            newEventId,
            eventData.title,
            eventData.startDate,
            eventData.endDate,
            eventData.description || '',
            eventData.colorId || '',
            eventData.startDateTime || '',
            eventData.endDateTime || '',
            eventData.type || '',
            eventData.rrule || '',
            eventData.attendees || ''
        ];

        // 낙관적 업데이트: 캐시에 먼저 추가
        const fullEventId = `${spreadsheetId}-${newEventId}`;
        const cacheKeys = [
            generateCacheKey('calendar', 'fetchCalendarEvents', { spreadsheetId }),
            'calendar:fetchCalendarEvents:*'
        ];
        
        const newEvent: Event = {
            id: fullEventId,
            ...eventData
        };
        
        let rollback: (() => Promise<void>) | null = null;
        try {
            rollback = await apiClient.optimisticUpdate<Event[]>('addCalendarEvent', cacheKeys, (cachedData) => {
                if (!cachedData || !Array.isArray(cachedData)) {
                    return [newEvent];
                }
                return [...cachedData, newEvent];
            });
        } catch (optimisticError) {
            console.warn('⚠️ 낙관적 업데이트 실패 (계속 진행):', optimisticError);
        }

        // API 호출
        try {
            await append(spreadsheetId, ENV_CONFIG.CALENDAR_SHEET_NAME, [newEventForSheet]);
            console.log('일정이 성공적으로 추가되었습니다.');
        } catch (apiError) {
            // API 실패 시 롤백
            if (rollback) {
                await rollback();
            }
            throw apiError;
        }
        
        // 성공 시 캐시 무효화 및 백그라운드 갱신 (서버 데이터로 동기화)
        try {
            const dataSyncService = getDataSyncService();
            await dataSyncService.invalidateAndRefresh(cacheKeys);
        } catch (cacheError) {
            console.warn('⚠️ 캐시 무효화 실패 (계속 진행):', cacheError);
        }
    } catch (error) {
        console.error('Error saving calendar event to Google Sheet:', error);
        throw error;
    }
};

export const updateCalendarEvent = async (spreadsheetId: string, eventId: string, eventData: Omit<Event, 'id'>): Promise<void> => {
    try {
        if (!spreadsheetId) {
            throw new Error('Calendar spreadsheet ID not found');
        }

        // Find the row index for the eventId
        const data = await getSheetData(spreadsheetId, ENV_CONFIG.CALENDAR_SHEET_NAME);
        if (!data || !data.values) {
            throw new Error('Could not find calendar data');
        }

        const sheetEventId = eventId.substring(spreadsheetId.length + 1);
        let rowIndex = data.values.findIndex((row: string[]) => row[0] === sheetEventId);

        // Fallback for older ID format that might not be composite
        if (rowIndex === -1) {
            rowIndex = data.values.findIndex((row: string[]) => row[0] === eventId);
        }

        if (rowIndex === -1) {
            throw new Error(`Event with ID ${eventId} not found in sheet.`);
        }

        const newRowData = [
            data.values[rowIndex][0], // Keep original ID
            eventData.title,
            eventData.startDate,
            eventData.endDate,
            eventData.description || '',
            eventData.colorId || '',
            eventData.startDateTime || '',
            eventData.endDateTime || '',
            eventData.type || '',
            eventData.rrule || '',
            eventData.attendees || ''
        ];

        // 낙관적 업데이트: 캐시에 먼저 반영
        const cacheKeys = [
            generateCacheKey('calendar', 'fetchCalendarEvents', { spreadsheetId }),
            'calendar:fetchCalendarEvents:*'
        ];
        
        let rollback: (() => Promise<void>) | null = null;
        try {
            rollback = await apiClient.optimisticUpdate<Event[]>('updateCalendarEvent', cacheKeys, (cachedData) => {
                if (!cachedData || !Array.isArray(cachedData)) return cachedData;
                return cachedData.map(event => {
                    if (event.id === eventId) {
                        return {
                            ...event,
                            ...eventData
                        };
                    }
                    return event;
                });
            });
        } catch (optimisticError) {
            console.warn('⚠️ 낙관적 업데이트 실패 (계속 진행):', optimisticError);
        }

        // API 호출
        try {
            await update(spreadsheetId, ENV_CONFIG.CALENDAR_SHEET_NAME, `A${rowIndex + 1}:K${rowIndex + 1}`, [newRowData]);
            console.log('일정이 성공적으로 업데이트되었습니다.');
        } catch (apiError) {
            // API 실패 시 롤백
            if (rollback) {
                await rollback();
            }
            throw apiError;
        }
        
        // 성공 시 캐시 무효화 및 백그라운드 갱신 (서버 데이터로 동기화)
        try {
            const dataSyncService = getDataSyncService();
            await dataSyncService.invalidateAndRefresh(cacheKeys);
        } catch (cacheError) {
            console.warn('⚠️ 캐시 무효화 실패 (계속 진행):', cacheError);
        }
    } catch (error) {
        console.error('Error updating calendar event in Google Sheet:', error);
        throw error;
    }
};

export const deleteCalendarEvent = async (spreadsheetId: string, eventId: string): Promise<void> => {
  try {
    if (!spreadsheetId) {
      throw new Error('Calendar spreadsheet ID not found');
    }

    const data = await getSheetData(spreadsheetId, ENV_CONFIG.CALENDAR_SHEET_NAME);
    if (!data || !data.values) {
      throw new Error('Could not find calendar data');
    }

    const sheetEventId = eventId.substring(spreadsheetId.length + 1);
    let rowIndex = data.values.findIndex((row: string[]) => row[0] === sheetEventId);

    if (rowIndex === -1) {
      rowIndex = data.values.findIndex((row: string[]) => row[0] === eventId);
    }

    if (rowIndex === -1) {
      throw new Error(`Event with ID ${eventId} not found in sheet.`);
    }

    // 낙관적 업데이트: 캐시에서 먼저 제거
    const cacheKeys = [
        generateCacheKey('calendar', 'fetchCalendarEvents', { spreadsheetId }),
        'calendar:fetchCalendarEvents:*'
    ];
    
    let rollback: (() => Promise<void>) | null = null;
    try {
        rollback = await apiClient.optimisticUpdate<Event[]>('deleteCalendarEvent', cacheKeys, (cachedData) => {
            if (!cachedData || !Array.isArray(cachedData)) return cachedData;
            return cachedData.filter(event => event.id !== eventId);
        });
    } catch (optimisticError) {
        console.warn('⚠️ 낙관적 업데이트 실패 (계속 진행):', optimisticError);
    }

    // API 호출
    try {
        const sheetId = 0; // Assuming the first sheet
        await deleteRow(spreadsheetId, sheetId, rowIndex);
        console.log('일정이 성공적으로 삭제되었습니다.');
    } catch (apiError) {
        // API 실패 시 롤백
        if (rollback) {
            await rollback();
        }
        throw apiError;
    }
    
    // 성공 시 캐시 무효화 및 백그라운드 갱신 (서버 데이터로 동기화)
    try {
        const dataSyncService = getDataSyncService();
        await dataSyncService.invalidateAndRefresh(cacheKeys);
    } catch (cacheError) {
        console.warn('⚠️ 캐시 무효화 실패 (계속 진행):', cacheError);
    }
  } catch (error) {
    console.error('Error deleting calendar event from Google Sheet:', error);
    throw error;
  }
};

// 학생 관련 함수들
export const fetchStudents = async (spreadsheetId?: string): Promise<Student[]> => {
    const cacheManager = getCacheManager();
    const action = 'fetchStudents';
    const category = getActionCategory(action);
    const targetSpreadsheetId = spreadsheetId || studentSpreadsheetId;
    const cacheKey = generateCacheKey(category, action, { spreadsheetId: targetSpreadsheetId });
    
    // 캐시에서 먼저 확인
    const cachedData = await cacheManager.get<Student[]>(cacheKey);
    if (cachedData) {
        console.log('👥 캐시에서 학생 목록 로드 (복호화 완료):', cachedData.length, '명');
        return cachedData;
    }

    try {
        if (!targetSpreadsheetId) {
            console.warn('Student spreadsheet ID not found');
            return [];
        }

        console.log(`👥 학생 목록 로드 시작 (캐시 미스): ${targetSpreadsheetId}, sheet: ${ENV_CONFIG.STUDENT_SHEET_NAME}`);
        const data = await getSheetData(targetSpreadsheetId, ENV_CONFIG.STUDENT_SHEET_NAME); // ENV v2: INFO_SHEET_NAME 기반 학생 시트명
        console.log('Students data received:', data);

        if (!data || !data.values || data.values.length <= 1) {
            console.log('No students data or insufficient rows');
            return [];
        }

        // 먼저 암호화된 데이터를 파싱
        const rawStudents = data.values.slice(1).map((row: string[]) => ({
            no_student: row[0] || '', // 'no' 컬럼을 'no_student'로 매핑
            name: row[1] || '',
            address: row[2] || '',
            phone_num: row[3] || '', // 암호화된 연락처
            grade: row[4] || '',
            state: row[5] || '',
            council: row[6] || '',
            flunk: row[7] || '', // 유급 필드 (H열)
            grad_year: row[8] || '', // 졸업 연도 (I열, 없으면 빈 값)
            grad_term: row[9] || '', // 졸업 회차 (J열, 전기/후기)
            advanced: row[10] || '', // 진학 여부 (K열, O면 진학)
        }));

        console.log(`👥 학생 목록 파싱 완료: ${rawStudents.length}명, 일괄 복호화 시작...`);
        
        // 일괄 복호화 (1회 API 호출)
        const encryptedPhones = rawStudents.map((s) => s.phone_num || '');
        const decryptedPhones = await decryptValuesBatch(encryptedPhones);
        const decryptedStudents: Student[] = rawStudents.map((student, i) => ({
            ...student,
            phone_num: decryptedPhones[i] ?? student.phone_num
        }));

        console.log(`👥 학생 목록 복호화 완료: ${decryptedStudents.length}명 (1회 일괄 호출)`);
        
        // 복호화된 데이터를 캐시에 저장
        const ttl = getCacheTTL(action);
        await cacheManager.set(cacheKey, decryptedStudents, ttl);
        console.log('👥 학생 목록 캐시 저장 완료 (복호화된 데이터, TTL:', ttl / 1000 / 60, '분)');
        
        return decryptedStudents;
    } catch (error) {
        console.error('Error fetching students from Google Sheet:', error);
        return [];
    }
};

export const deleteStudent = async (spreadsheetId: string, studentNo: string): Promise<void> => {
    try {
        const targetSpreadsheetId = spreadsheetId || studentSpreadsheetId;
        if (!targetSpreadsheetId) {
            throw new Error('Student spreadsheet ID not found');
        }

        setupPapyrusAuth();

        const sheetName = ENV_CONFIG.STUDENT_SHEET_NAME; // ENV v2: INFO_SHEET_NAME 기반 학생 시트명

        // Get sheet metadata to find the correct sheetId
        const spreadsheet = await window.gapi.client.sheets.spreadsheets.get({
            spreadsheetId: targetSpreadsheetId,
        });

        const sheet = spreadsheet.result.sheets.find(
            (s) => s.properties.title === sheetName
        );

        if (!sheet || sheet.properties.sheetId === undefined) {
            throw new Error(`시트 '${sheetName}'을(를) 찾을 수 없거나 sheetId가 없습니다.`);
        }
        const sheetId = sheet.properties.sheetId;

        const data = await getSheetData(targetSpreadsheetId, sheetName);

        if (!data || !data.values || data.values.length === 0) {
            throw new Error('Sheet data not found');
        }

        const rowIndex = data.values.findIndex(row => row[0] === studentNo);

        if (rowIndex === -1) {
            throw new Error('Student not found in the sheet');
        }

        await deleteRow(targetSpreadsheetId, sheetId, rowIndex);

        console.log(`Student with number ${studentNo} deleted successfully.`);

    } catch (error) {
        console.error('Error deleting student:', error);
        throw error;
    }
};

export const fetchStaff = async (): Promise<Staff[]> => {
    const cacheManager = getCacheManager();
    const action = 'fetchStaff';
    const category = getActionCategory(action);
    const cacheKey = generateCacheKey(category, action, {});
    
    // 캐시에서 먼저 확인
    const cachedData = await cacheManager.get<Staff[]>(cacheKey);
    if (cachedData) {
        console.log('👨‍💼 캐시에서 교직원 목록 로드:', cachedData.length, '명');
        return cachedData;
    }

    try {
        if (!studentSpreadsheetId) {
            console.warn('Student spreadsheet ID not found');
            return [];
        }

        console.log('👨‍💼 교직원 목록 로드 시작 (캐시 미스)...');
        const data = await getSheetData(studentSpreadsheetId, ENV_CONFIG.STUDENT_SHEET_NAME);

        if (!data || !data.values || data.values.length <= 1) {
            return [];
        }

        const staff = data.values.slice(1).map((row: string[]) => ({
            no: row[0] || '',
            pos: row[1] || '',
            name: row[2] || '',
            tel: row[3] || '',
            phone: row[4] || '',
            email: row[5] || '',
            date: row[6] || '',
            note: row[7] || '',
        }));

        console.log(`👨‍💼 교직원 목록 로드 완료: ${staff.length}명`);
        
        // 캐시에 저장
        const ttl = getCacheTTL(action);
        await cacheManager.set(cacheKey, staff, ttl);
        console.log('👨‍💼 교직원 목록 캐시 저장 완료 (TTL:', ttl / 1000 / 60, '분)');
        
        return staff;
    } catch (error) {
        console.error('Error fetching staff from Google Sheet:', error);
        return [];
    }
};

export const fetchAttendees = async (): Promise<{ students: Student[], staff: Staff[] }> => {
    const cacheManager = getCacheManager();
    const action = 'fetchAttendees';
    const category = getActionCategory(action);
    const cacheKey = generateCacheKey(category, action, {});
    
    // 캐시에서 먼저 확인
    const cachedData = await cacheManager.get<{ students: Student[], staff: Staff[] }>(cacheKey);
    if (cachedData) {
        console.log('👥 캐시에서 참석자 목록 로드:', cachedData.students.length, '명 학생,', cachedData.staff.length, '명 교직원');
        return cachedData;
    }

    try {
        console.log('👥 참석자 목록 로드 시작 (캐시 미스)...');
        const [students, staff] = await Promise.all([
            fetchStudents(),
            fetchStaffFromPapyrus(staffSpreadsheetId || '')
        ]);
        
        const result = {students, staff};
        console.log('👥 참석자 목록 로드 완료:', students.length, '명 학생,', staff.length, '명 교직원');
        
        // 캐시에 저장
        const ttl = getCacheTTL(action);
        await cacheManager.set(cacheKey, result, ttl);
        console.log('👥 참석자 목록 캐시 저장 완료 (TTL:', ttl / 1000 / 60, '분)');
        
        return result;
    } catch (error) {
        console.error('Error fetching attendees:', error);
        return {students: [], staff: []};
    }
};

// 학생 이슈 타입 정의
export interface StudentIssue {
  id: string;
  no_member: string;
  date_issue: string;
  type_issue: string;
  level_issue: string;
  content_issue: string;
}

// 학생 이슈 관련 함수들
export const fetchStudentIssues = async (studentNo: string): Promise<StudentIssue[]> => {
    const cacheManager = getCacheManager();
    const action = 'fetchStudentIssues';
    const category = getActionCategory(action);
    const cacheKey = generateCacheKey(category, action, { studentNo });
    
    // 캐시에서 먼저 확인
    const cachedData = await cacheManager.get<StudentIssue[]>(cacheKey);
    if (cachedData) {
        console.log('📋 캐시에서 학생 이슈 로드:', cachedData.length, '개');
        return cachedData;
    }

    try {
        if (!studentSpreadsheetId) {
            console.warn('Student spreadsheet ID not found');
            return [];
        }

        console.log(`📋 학생 이슈 로드 시작 (캐시 미스): ${studentNo}`);
        const data = await getSheetData(studentSpreadsheetId, ENV_CONFIG.STUDENT_ISSUE_SHEET_NAME); // ENV v2: ISSUE_SHEET_NAME 기반 학생 이슈 시트명

        if (!data || !data.values || data.values.length <= 1) {
            return [];
        }

        const issues = data.values.slice(1)
            .filter(row => row[0] === studentNo)
            .map((row, index) => ({
                id: `issue_${index}`,
                no_member: row[0] || '',
                date_issue: row[1] || '',
                type_issue: row[2] || '',
                level_issue: row[3] || '',
                content_issue: row[4] || ''
            }));

        console.log(`📋 학생 이슈 로드 완료: ${issues.length}개`);
        
        // 캐시에 저장
        const ttl = getCacheTTL(action);
        await cacheManager.set(cacheKey, issues, ttl);
        console.log('📋 학생 이슈 캐시 저장 완료 (TTL:', ttl / 1000 / 60, '분)');
        
        return issues;
    } catch (error) {
        console.error('Error fetching student issues:', error);
        return [];
    }
};

export const addStudentIssue = async (
    spreadsheetId: string,
    issueData: {
        no_member: string;
        date_issue: string;
        type_issue: string;
        level_issue: string;
        content_issue: string;
    }
): Promise<void> => {
    try {
        if (!spreadsheetId) {
            throw new Error('Student spreadsheet ID not found');
        }

        const data = [
            issueData.no_member,
            issueData.date_issue,
            issueData.type_issue,
            issueData.level_issue,
            issueData.content_issue
        ];

        await append(spreadsheetId, ENV_CONFIG.STUDENT_ISSUE_SHEET_NAME, [data]);
        console.log('Student issue added successfully');
        
        // 캐시 무효화 및 백그라운드 갱신
        try {
            const dataSyncService = getDataSyncService();
            const cacheKeys = [
                generateCacheKey('students', 'fetchStudentIssues', { spreadsheetId: studentSpreadsheetId }),
                'students:fetchStudentIssues:*' // 와일드카드로 모든 학생 이슈 캐시 무효화
            ];
            await dataSyncService.invalidateAndRefresh(cacheKeys);
        } catch (cacheError) {
            console.warn('⚠️ 캐시 무효화 실패 (계속 진행):', cacheError);
        }
    } catch (error) {
        console.error('Error adding student issue:', error);
        throw error;
    }
};

// 학사일정 저장 함수
export const saveAcademicScheduleToSheet = async (scheduleData: {
    semesterStartDate: Date;
    finalExamsPeriod: DateRange;
    midtermExamsPeriod: DateRange;
    gradeEntryPeriod: DateRange;
    customPeriods: CustomPeriod[];
}, calendarSpreadsheetId: string): Promise<void> => {
    const {semesterStartDate, finalExamsPeriod, midtermExamsPeriod, gradeEntryPeriod, customPeriods} = scheduleData;

    const tagLabels: { [key: string]: string } = {
        holiday: '휴일/휴강',
        event: '행사',
        makeup: '보강',
        exam: '시험',
        meeting: '회의',
    };

    const formatDate = (date: Date | null) => {
        if (!date) return '';
        const d = new Date(date);
        const year = d.getFullYear();
        const month = String(d.getMonth() + 1).padStart(2, '0');
        const day = String(d.getDate()).padStart(2, '0');
        return `${year}-${month}-${day}`;
    };

    const addInclusiveDays = (startDate: Date, days: number) => {
        const newDate = new Date(startDate);
        newDate.setDate(newDate.getDate() + days - 1);
        return newDate;
    };

    const slugify = (text: string) => {
        return text.toString().toLowerCase()
            .replace(/\s+/g, '-')           // Replace spaces with -
            .replace(/[^\w\-]+/g, '')       // Remove all non-word chars
            .replace(/\-\-+/g, '-')         // Replace multiple - with single -
            .replace(/^-+/, '')             // Trim - from start of text
            .replace(/-+$/, '');            // Trim - from end of text
    }

    const eventsToSave: Array<{
        id: string;
        title: string;
        startDate: string;
        endDate: string;
        type?: string;
        description?: string;
    }> = [];

    // 개강일
    eventsToSave.push({ id: 'semester-start', title: '개강일', startDate: formatDate(semesterStartDate), endDate: formatDate(semesterStartDate), type: '공용일정' });

    // 수업일수 events
    const classDay30 = addInclusiveDays(semesterStartDate, 30);
    const classDay60 = addInclusiveDays(semesterStartDate, 60);
    const classDay90 = addInclusiveDays(semesterStartDate, 90);
    eventsToSave.push({ id: 'class-day-30', title: '수업일수 30일', startDate: formatDate(classDay30), endDate: formatDate(classDay30), type: '공용일정', description: '학기 개시일 부터 30일 까지 휴학할 시에 복학 추가 납부 금액 0원' });
    eventsToSave.push({ id: 'class-day-60', title: '수업일수 60일', startDate: formatDate(classDay60), endDate: formatDate(classDay60), type: '공용일정', description: '학기 개시일 30일부터 60일 까지 휴학할 시에 복학 추가 납부 금액 : 등록금의 1/3' });
    eventsToSave.push({ id: 'class-day-90', title: '수업일수 90일', startDate: formatDate(classDay90), endDate: formatDate(classDay90), type: '공용일정', description: '학기 개시일 60일부터 90일 까지 휴학할 시에 복학 추가 납부 금액 : 등록금의 1/2' });

    // 중간고사
    if (midtermExamsPeriod.start && midtermExamsPeriod.end) {
        eventsToSave.push({ id: 'midterm-exam', title: '중간고사', startDate: formatDate(midtermExamsPeriod.start), endDate: formatDate(midtermExamsPeriod.end), type: 'exam' });
    }

    // 기말고사
    if (finalExamsPeriod.start && finalExamsPeriod.end) {
        eventsToSave.push({ id: 'final-exam', title: '기말고사', startDate: formatDate(finalExamsPeriod.start), endDate: formatDate(finalExamsPeriod.end), type: 'exam' });
    }

    // 성적입력 및 강의평가
    if (gradeEntryPeriod.start && gradeEntryPeriod.end) {
        eventsToSave.push({ id: 'grade-entry', title: '성적입력 및 강의평가', startDate: formatDate(gradeEntryPeriod.start), endDate: formatDate(gradeEntryPeriod.end), type: '공용일정' });
    }

    // Custom periods
    customPeriods.forEach(p => {
        if (p.period.start && p.period.end) {
            eventsToSave.push({ id: p.id, title: p.name, startDate: formatDate(p.period.start), endDate: formatDate(p.period.end), type: '공용일정' });
        }
    });

    try {
        console.log('학사일정 이벤트 저장 시작:', eventsToSave.length, '개');

        // Get current data to check for existing events
        const sheetData = await getSheetData(calendarSpreadsheetId, ENV_CONFIG.CALENDAR_SHEET_NAME);
        const existingEvents = sheetData && sheetData.values ? sheetData.values : [];
        const existingEventsMap = new Map<string, number>(); // id -> rowIndex
        existingEvents.forEach((row, index) => {
            if (index > 0) { // Skip header row
                const id = row[0];
                if (id) {
                    existingEventsMap.set(id, index + 1);
                }
            }
        });

        // 이벤트 삭제, 업데이트, 추가 로직
        const newEventIds = new Set(eventsToSave.map(e => e.id));
        const rowsToDelete: number[] = [];

        // 삭제할 행 식별 (학사일정 관련 이벤트만 대상으로 함)
        existingEventsMap.forEach((rowIndex, id) => {
            const isAcademicEvent = id.startsWith('semester-') || id.startsWith('class-day-') || id.startsWith('midterm-') || id.startsWith('final-') || id.startsWith('grade-') || id.startsWith('custom-');
            if (isAcademicEvent && !newEventIds.has(id)) {
                rowsToDelete.push(rowIndex);
            }
        });

        // 행을 삭제하는 대신 내용을 지워서 삭제 효과를 냄
        if (rowsToDelete.length > 0) {
            console.log(`Clearing ${rowsToDelete.length} academic schedule event rows that no longer exist.`);
            for (const rowIndex of rowsToDelete) {
                const range = `${ENV_CONFIG.CALENDAR_SHEET_NAME}!A${rowIndex}:K${rowIndex}`;
                await window.gapi.client.sheets.spreadsheets.values.clear({
                    spreadsheetId: calendarSpreadsheetId,
                    range: range,
                });
            }
        }

        // 새로운 이벤트들 생성 또는 업데이트
        for (const event of eventsToSave) {
            const rowIndex = existingEventsMap.get(event.id);

            const rowData = [
                event.id,
                event.title,
                event.startDate,
                event.endDate,
                event.description || '', // description
                '', // colorId
                '', // startDateTime
                '', // endDateTime
                (event.type && tagLabels[event.type]) || event.type || '', // type
                '', // rrule
                ''  // attendees
            ];

            if (rowIndex) {
                // Update existing event
                await update(calendarSpreadsheetId, ENV_CONFIG.CALENDAR_SHEET_NAME, `A${rowIndex}:K${rowIndex}`, [rowData]);
            } else {
                // Append new event
                await append(calendarSpreadsheetId, ENV_CONFIG.CALENDAR_SHEET_NAME, [rowData]);
            }
        }

        console.log('학사일정이 성공적으로 저장되었습니다.');
    } catch (error) {
        console.error('Error saving academic schedule to Papyrus DB:', error);
        throw error;
    }
};

// 태그 관련 함수들
export const addTag = async (newTag: string): Promise<void> => {
    try {
        // papyrus-db에서는 태그를 별도 테이블로 관리하지 않으므로 스킵
        console.log('태그 추가 기능은 현재 지원되지 않습니다:', newTag);
    } catch (error) {
        console.error('Error saving tag to Papyrus DB:', error);
        throw error;
    }
};

export const deleteTag = async (tagToDelete: string): Promise<void> => {
    try {
        // papyrus-db에서는 태그를 별도 테이블로 관리하지 않으므로 스킵
        console.log('태그 삭제 기능은 현재 지원되지 않습니다:', tagToDelete);
    } catch (error) {
        console.error('Error deleting tag from Papyrus DB:', error);
        throw error;
    }
};

export const updateTag = async (oldTag: string, newTag: string): Promise<void> => {
    try {
        // papyrus-db에서는 태그를 별도 테이블로 관리하지 않으므로 스킵
        console.log('태그 업데이트 기능은 현재 지원되지 않습니다:', oldTag, '->', newTag);
    } catch (error) {
        console.error('Error updating tag in Papyrus DB:', error);
        throw error;
    }
};

// ===== 교직원 관리 함수들 =====

/**
 * @brief 교직원 데이터 가져오기
 * @param {string} spreadsheetId - 스프레드시트 ID
 * @returns {Promise<Staff[]>} 교직원 목록
 */
/**
 * 복호화 헬퍼 함수 (단일 값 - 레거시/개별 호출용)
 */
const decryptValue = async (encryptedValue: string): Promise<string> => {
  if (!encryptedValue || encryptedValue.trim() === '') {
    return '';
  }

  try {
    // 이미 복호화된 값인지 확인 (전화번호 형식: 010-XXXX-XXXX 또는 이메일 형식)
    if (/^010-\d{4}-\d{4}$/.test(encryptedValue) || /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(encryptedValue)) {
      return encryptedValue;
    }

    const { apiClient } = await import('../api/apiClient');
    const response = await apiClient.request<{ success: boolean; data: string }>('decryptEmail', { data: encryptedValue });
    
    if (response.success && response.data) {
      return response.data as string;
    }
    return encryptedValue;
  } catch (error) {
    console.warn('복호화 실패:', error);
    return encryptedValue;
  }
};

/** 배치 크기: Apps Script 요청 제한 고려 */
const DECRYPT_BATCH_SIZE = 100;

/**
 * 일괄 복호화 - 여러 값을 한 번의 API 호출로 처리 (API 호출 수 대폭 감소)
 */
const decryptValuesBatch = async (encryptedValues: string[]): Promise<string[]> => {
  if (!encryptedValues || encryptedValues.length === 0) {
    return [];
  }
  try {
    const { apiClient } = await import('../api/apiClient');
    const results: string[] = [];
    for (let i = 0; i < encryptedValues.length; i += DECRYPT_BATCH_SIZE) {
      const chunk = encryptedValues.slice(i, i + DECRYPT_BATCH_SIZE);
      const response = await apiClient.request<{ success: boolean; data: string[] }>('decryptEmailBatch', { data: chunk });
      if (response.success && Array.isArray(response.data)) {
        results.push(...response.data);
      } else {
        results.push(...chunk); // 실패 시 원본 반환
      }
    }
    return results;
  } catch (error) {
    console.warn('일괄 복호화 실패:', error);
    return encryptedValues;
  }
};

export const fetchStaffFromPapyrus = async (spreadsheetId: string): Promise<Staff[]> => {
  const cacheManager = getCacheManager();
  const action = 'fetchStaffFromPapyrus';
  const category = getActionCategory(action);
  const cacheKey = generateCacheKey(category, action, { spreadsheetId });
  
  // 캐시에서 먼저 확인
  const cachedData = await cacheManager.get<Staff[]>(cacheKey);
  if (cachedData) {
    console.log('👨‍💼 캐시에서 교직원 목록 로드 (Papyrus, 복호화 완료):', cachedData.length, '명');
    return cachedData;
  }

  try {
    setupPapyrusAuth();

    if (!staffSpreadsheetId) {
      staffSpreadsheetId = await findSpreadsheetById(ENV_CONFIG.STAFF_SPREADSHEET_NAME);
    }

    if (!staffSpreadsheetId) {
      throw new Error('교직원 스프레드시트를 찾을 수 없습니다.');
    }

    console.log('👨‍💼 교직원 목록 로드 시작 (Papyrus, 캐시 미스)...');
    const data = await getSheetData(staffSpreadsheetId, ENV_CONFIG.STAFF_INFO_SHEET_NAME); // ENV v2: INFO_SHEET_NAME 기반 교직원 시트명

    if (!data || !data.values || data.values.length === 0) {
      return [];
    }

    const headers = data.values[0] as string[];
    console.log('👨‍💼 교직원 스프레드시트 헤더:', headers);
    
    // 먼저 암호화된 데이터를 파싱
    const rawStaffData: Staff[] = data.values.slice(1).map((row: string[], rowIndex: number) => {
      const staff: Partial<Staff> = {};
      headers.forEach((header: string, index: number) => {
        const value = row[index];
        // 헤더 이름을 정규화 (공백 제거, 소문자 변환 등)
        const normalizedHeader = header?.trim().toLowerCase();
        
        // 일반적인 필드명 매핑 (헤더 이름이 다를 수 있음)
        if (normalizedHeader === 'tel' || normalizedHeader === '내선번호' || normalizedHeader === '전화번호') {
          staff.tel = value || '';
        } else if (normalizedHeader === 'phone' || normalizedHeader === '연락처' || normalizedHeader === '휴대폰') {
          staff.phone = value || '';
        } else if (normalizedHeader === 'email' || normalizedHeader === '이메일' || normalizedHeader === '메일') {
          staff.email = value || '';
        } else if (normalizedHeader === 'no' || normalizedHeader === '교번' || normalizedHeader === '번호') {
          staff.no = value || '';
        } else if (normalizedHeader === 'pos' || normalizedHeader === '구분' || normalizedHeader === '직위') {
          staff.pos = value || '';
        } else if (normalizedHeader === 'name' || normalizedHeader === '이름' || normalizedHeader === '성명') {
          staff.name = value || '';
        } else if (normalizedHeader === 'date' || normalizedHeader === '임용일' || normalizedHeader === '날짜') {
          staff.date = value || '';
        } else if (normalizedHeader === 'note' || normalizedHeader === '비고' || normalizedHeader === '메모') {
          staff.note = value || '';
        } else {
          // 알 수 없는 헤더는 원본 헤더 이름으로 저장
          (staff as Record<string, unknown>)[header] = value;
        }
      });
      
      // 디버깅: 필드가 비어있는 경우 로그 출력
      if (!staff.tel && !staff.phone && !staff.email && staff.name) {
        console.warn(`⚠️ 교직원 "${staff.name}"의 연락처 정보가 비어있습니다.`, {
          rowIndex: rowIndex + 2, // 실제 스프레드시트 행 번호 (헤더 + 1)
          headers,
          row,
          staff
        });
      }
      
      return staff as Staff;
    });

    console.log(`👨‍💼 교직원 목록 파싱 완료: ${rawStaffData.length}명, 일괄 복호화 시작...`);
    
    // 일괄 복호화 (1회 API 호출) - tel, phone, email 순으로 평탄화
    const encryptedStaffValues = rawStaffData.flatMap((s) => [s.tel || '', s.phone || '', s.email || '']);
    const decryptedStaffValues = await decryptValuesBatch(encryptedStaffValues);
    const decryptedStaffData: Staff[] = rawStaffData.map((staff, i) => {
      const base = i * 3;
      return {
        ...staff,
        tel: decryptedStaffValues[base] ?? staff.tel,
        phone: decryptedStaffValues[base + 1] ?? staff.phone,
        email: decryptedStaffValues[base + 2] ?? staff.email
      };
    });

    console.log(`👨‍💼 교직원 목록 복호화 완료: ${decryptedStaffData.length}명 (1회 일괄 호출)`);
    
    // 복호화된 데이터를 캐시에 저장
    const ttl = getCacheTTL(action);
    await cacheManager.set(cacheKey, decryptedStaffData, ttl);
    console.log('👨‍💼 교직원 목록 캐시 저장 완료 (복호화된 데이터, TTL:', ttl / 1000 / 60, '분)');
    
    return decryptedStaffData;
  } catch (error) {
    console.error('Error fetching staff from Papyrus DB:', error);
    throw error;
  }
};

/**
 * @brief 학과 위원회 데이터 가져오기
 * @param {string} spreadsheetId - 스프레드시트 ID
 * @returns {Promise<Committee[]>} 학과 위원회 목록
 */
export const fetchCommitteeFromPapyrus = async (spreadsheetId: string): Promise<Committee[]> => {
  const cacheManager = getCacheManager();
  const action = 'fetchCommitteeFromPapyrus';
  const category = getActionCategory(action);
  const cacheKey = generateCacheKey(category, action, { spreadsheetId });
  
  // 캐시에서 먼저 확인
  const cachedData = await cacheManager.get<Committee[]>(cacheKey);
  if (cachedData) {
    console.log('👥 캐시에서 위원회 목록 로드 (복호화 완료):', cachedData.length, '개');
    return cachedData;
  }

  try {
    setupPapyrusAuth();

    if (!staffSpreadsheetId) {
      staffSpreadsheetId = await findSpreadsheetById(ENV_CONFIG.STAFF_SPREADSHEET_NAME);
    }

    if (!staffSpreadsheetId) {
      throw new Error('교직원 스프레드시트를 찾을 수 없습니다.');
    }

    console.log('👥 위원회 목록 로드 시작 (캐시 미스)...');
    const data = await getSheetData(staffSpreadsheetId, ENV_CONFIG.STAFF_COMMITTEE_SHEET_NAME); // ENV v2: COMMITTEE_SHEET_NAME 기반 위원회 시트명

    if (!data || !data.values || data.values.length === 0) {
      return [];
    }

    const headers = data.values[0] as string[];
    // 먼저 암호화된 데이터를 파싱
    const rawCommitteeData: Committee[] = data.values.slice(1).map((row: string[]) => {
      const committee: Record<string, unknown> = {};
      headers.forEach((header: string, index: number) => {
        committee[header] = row[index];
      });

            // career 필드가 문자열일 경우 JSON으로 파싱 (더욱 안전하게)
            let parsedCareer: CommitteeType['career'] = [];
            if (committee.career && typeof committee.career === 'string') {
                try {
                    const parsed = JSON.parse(committee.career);
                    if (Array.isArray(parsed)) {
                        parsedCareer = parsed;
                    }
                } catch (e) {
                    console.error('경력 정보 파싱 실패:', e);
                    // 파싱 실패 시 빈 배열로 유지
                }
            }
            committee.career = parsedCareer;

            return committee as Committee;
        });

    console.log(`👥 위원회 목록 파싱 완료: ${rawCommitteeData.length}개, 일괄 복호화 시작...`);
    
    // 일괄 복호화 (1회 API 호출) - tel, email 순으로 평탄화
    const encryptedCommitteeValues = rawCommitteeData.flatMap((c) => [c.tel || '', c.email || '']);
    const decryptedCommitteeValues = await decryptValuesBatch(encryptedCommitteeValues);
    const decryptedCommitteeData: Committee[] = rawCommitteeData.map((committee, i) => {
      const base = i * 2;
      return {
        ...committee,
        tel: decryptedCommitteeValues[base] ?? committee.tel,
        email: decryptedCommitteeValues[base + 1] ?? committee.email
      };
    });

    console.log(`👥 위원회 목록 복호화 완료: ${decryptedCommitteeData.length}개 (1회 일괄 호출)`);
    
    // 복호화된 데이터를 캐시에 저장
    const ttl = getCacheTTL(action);
    await cacheManager.set(cacheKey, decryptedCommitteeData, ttl);
    console.log('👥 위원회 목록 캐시 저장 완료 (복호화된 데이터, TTL:', ttl / 1000 / 60, '분)');
    
    return decryptedCommitteeData;
    } catch (error) {
        console.error('Error fetching committee from Papyrus DB:', error);
        throw error;
    }
};

// Committee 타입 정의
interface Committee {
    sortation: string;
    name: string;
    tel: string;
    email: string;
    position: string;
    career: string;
    company_name: string;
    company_position: string;
    location: string;
    is_family: boolean;
    representative: string;
    note: string;
}

/**
 * @brief 교직원 추가
 * @param {string} spreadsheetId - 스프레드시트 ID
 * @param {StaffMember} staff - 추가할 교직원 정보
 * @returns {Promise<void>}
 */
export const addStaff = async (spreadsheetId: string, staff: StaffMember): Promise<void> => {
    try {
        setupPapyrusAuth();

        if (!staffSpreadsheetId) {
            staffSpreadsheetId = await findSpreadsheetById(ENV_CONFIG.STAFF_SPREADSHEET_NAME);
        }

        if (!staffSpreadsheetId) {
            throw new Error('교직원 스프레드시트를 찾을 수 없습니다.');
        }

        const newRow = [[
            staff.no,
            staff.pos,
            staff.name,
            staff.tel,
            staff.phone,
            staff.email,
            staff.date,
            staff.note
        ]];
        await addRow(staffSpreadsheetId, ENV_CONFIG.STAFF_INFO_SHEET_NAME, newRow);
        
        // 캐시 무효화 및 백그라운드 갱신
        try {
            const dataSyncService = getDataSyncService();
            const cacheKeys = [
                generateCacheKey('staff', 'fetchStaff', { spreadsheetId: staffSpreadsheetId }),
                'staff:fetchStaff:*' // 와일드카드로 모든 교직원 캐시 무효화
            ];
            await dataSyncService.invalidateAndRefresh(cacheKeys);
        } catch (cacheError) {
            console.warn('⚠️ 캐시 무효화 실패 (계속 진행):', cacheError);
        }
    } catch (error) {
        console.error('Error adding staff:', error);
        throw error;
    }
};

/**
 * @brief 교직원 업데이트
 * @param {string} spreadsheetId - 스프레드시트 ID
 * @param {StaffMember} staff - 업데이트할 교직원 정보
 * @returns {Promise<void>}
 */
export const updateStaff = async (spreadsheetId: string, staffNo: string, staff: StaffMember): Promise<void> => {
    try {
        setupPapyrusAuth();

        const effectiveSpreadsheetId = staffSpreadsheetId || await findSpreadsheetById(ENV_CONFIG.STAFF_SPREADSHEET_NAME);
        if (!effectiveSpreadsheetId) {
            throw new Error('교직원 스프레드시트를 찾을 수 없습니다.');
        }

        const sheetName = ENV_CONFIG.STAFF_INFO_SHEET_NAME;
        const data = await getSheetData(effectiveSpreadsheetId, sheetName);

        if (!data || !data.values || data.values.length === 0) {
            throw new Error('시트에서 데이터를 찾을 수 없습니다.');
        }

        const rowIndex = data.values.findIndex(row => row[0] === staffNo);

        if (rowIndex === -1) {
            throw new Error('해당 교직원을 시트에서 찾을 수 없습니다.');
        }

        const range = `${sheetName}!A${rowIndex + 1}:H${rowIndex + 1}`;
        const values = [[
            staff.no,
            staff.pos,
            staff.name,
            staff.tel,
            staff.phone,
            staff.email,
            staff.date,
            staff.note
        ]];

        const gapi = window.gapi;
        await gapi.client.sheets.spreadsheets.values.update({
            spreadsheetId: effectiveSpreadsheetId,
            range: range,
            valueInputOption: 'RAW',
            resource: {
                values: values
            }
        });
        
        // 캐시 무효화 및 백그라운드 갱신
        try {
            const dataSyncService = getDataSyncService();
            const cacheKeys = [
                generateCacheKey('staff', 'fetchStaff', { spreadsheetId: effectiveSpreadsheetId }),
                'staff:fetchStaff:*' // 와일드카드로 모든 교직원 캐시 무효화
            ];
            await dataSyncService.invalidateAndRefresh(cacheKeys);
        } catch (cacheError) {
            console.warn('⚠️ 캐시 무효화 실패 (계속 진행):', cacheError);
        }

    } catch (error) {
        console.error('Error updating staff in papyrusManager:', error);
        // 에러를 다시 던져서 상위 호출자가 처리할 수 있도록 함
        throw error;
    }
};

/**
 * @brief 교직원 삭제
 * @param {string} spreadsheetId - 스프레드시트 ID
 * @param {string} staffNo - 삭제할 교직원 번호
 * @returns {Promise<void>}
 */
export const deleteStaff = async (spreadsheetId: string, staffNo: string): Promise<void> => {
    try {
        setupPapyrusAuth();

        const effectiveSpreadsheetId = staffSpreadsheetId || await findSpreadsheetById(ENV_CONFIG.STAFF_SPREADSHEET_NAME);
        if (!effectiveSpreadsheetId) {
            throw new Error('교직원 스프레드시트를 찾을 수 없습니다.');
        }

        const sheetName = ENV_CONFIG.STAFF_INFO_SHEET_NAME;
        const data = await getSheetData(effectiveSpreadsheetId, sheetName);

        if (!data || !data.values || data.values.length === 0) {
            throw new Error('시트에서 데이터를 찾을 수 없습니다.');
        }

        const rowIndex = data.values.findIndex(row => row[0] === staffNo);

        if (rowIndex === -1) {
            throw new Error('해당 교직원을 시트에서 찾을 수 없습니다.');
        }

        const sheetId = 0; // Assuming the first sheet
        await deleteRow(effectiveSpreadsheetId, sheetId, rowIndex);
        
        // 캐시 무효화 및 백그라운드 갱신
        try {
            const dataSyncService = getDataSyncService();
            const cacheKeys = [
                generateCacheKey('staff', 'fetchStaff', { spreadsheetId: effectiveSpreadsheetId }),
                'staff:fetchStaff:*' // 와일드카드로 모든 교직원 캐시 무효화
            ];
            await dataSyncService.invalidateAndRefresh(cacheKeys);
        } catch (cacheError) {
            console.warn('⚠️ 캐시 무효화 실패 (계속 진행):', cacheError);
        }

    } catch (error) {
        console.error('Error deleting staff:', error);
        throw error;
    }
};

/**
 * @brief 학과 위원회 추가
 * @param {string} spreadsheetId - 스프레드시트 ID
 * @param {Committee} committee - 추가할 위원회 정보
 * @returns {Promise<void>}
 */
export const addCommittee = async (spreadsheetId: string, committee: CommitteeType): Promise<void> => {
    try {
        setupPapyrusAuth();

        if (!staffSpreadsheetId) {
            staffSpreadsheetId = await findSpreadsheetById(ENV_CONFIG.STAFF_SPREADSHEET_NAME);
        }

        if (!staffSpreadsheetId) {
            throw new Error('교직원 스프레드시트를 찾을 수 없습니다.');
        }

        const newRow = [[
            committee.sortation,
            committee.name,
            committee.tel,
            committee.email,
            committee.position,
            JSON.stringify(committee.career), // career는 JSON 문자열로 저장
            committee.company_name,
            committee.company_position,
            committee.location,
            committee.is_family,
            committee.representative,
            committee.note
        ]];
        await addRow(staffSpreadsheetId, ENV_CONFIG.STAFF_COMMITTEE_SHEET_NAME, newRow);
    } catch (error) {
        console.error('Error adding committee:', error);
        throw error;
    }
};

/**
 * @brief 학과 위원회 업데이트
 * @param {string} spreadsheetId - 스프레드시트 ID
 * @param {Committee} committee - 업데이트할 위원회 정보
 * @returns {Promise<void>}
 */
export const updateCommittee = async (spreadsheetId: string, committeeName: string, committee: CommitteeType): Promise<void> => {
    try {
        setupPapyrusAuth();

        const effectiveSpreadsheetId = staffSpreadsheetId || await findSpreadsheetById(ENV_CONFIG.STAFF_SPREADSHEET_NAME);
        if (!effectiveSpreadsheetId) {
            throw new Error('교직원 스프레드시트를 찾을 수 없습니다.');
        }

        const sheetName = ENV_CONFIG.STAFF_COMMITTEE_SHEET_NAME;
        const data = await getSheetData(effectiveSpreadsheetId, sheetName);

        if (!data || !data.values || data.values.length === 0) {
            throw new Error('시트에서 데이터를 찾을 수 없습니다.');
        }

        // 학과 위원회는 이름(name)을 고유 키로 사용 (두 번째 컬럼)
        const rowIndex = data.values.findIndex(row => row[1] === committeeName);

        if (rowIndex === -1) {
            throw new Error('해당 위원회 구성원을 시트에서 찾을 수 없습니다.');
        }

        const range = `${sheetName}!A${rowIndex + 1}:L${rowIndex + 1}`;
        const values = [[
            committee.sortation,
            committee.name,
            committee.tel,
            committee.email,
            committee.position,
            JSON.stringify(committee.career), // career는 JSON 문자열로 저장
            committee.company_name,
            committee.company_position,
            committee.location,
            committee.is_family,
            committee.representative,
            committee.note
        ]];

        const gapi = window.gapi;
        await gapi.client.sheets.spreadsheets.values.update({
            spreadsheetId: effectiveSpreadsheetId,
            range: range,
            valueInputOption: 'RAW',
            resource: {
                values: values
            }
        });

    } catch (error) {
        console.error('Error updating committee in papyrusManager:', error);
        throw error;
    }
};

/**
 * @brief 학과 위원회 삭제
 * @param {string} spreadsheetId - 스프레드시트 ID
 * @param {string} committeeName - 삭제할 위원회 이름
 * @returns {Promise<void>}
 */
export const deleteCommittee = async (spreadsheetId: string, committeeName: string): Promise<void> => {
    try {
        setupPapyrusAuth();

        const effectiveSpreadsheetId = staffSpreadsheetId || await findSpreadsheetById(ENV_CONFIG.STAFF_SPREADSHEET_NAME);
        if (!effectiveSpreadsheetId) {
            throw new Error('교직원 스프레드시트를 찾을 수 없습니다.');
        }

        const sheetName = ENV_CONFIG.STAFF_COMMITTEE_SHEET_NAME;

        // Get sheet metadata to find the correct sheetId
        const spreadsheet = await window.gapi.client.sheets.spreadsheets.get({
            spreadsheetId: effectiveSpreadsheetId,
        });

        const sheet = spreadsheet.result.sheets.find(
            (s) => s.properties.title === sheetName
        );

        if (!sheet) {
            throw new Error(`시트 '${sheetName}'을(를) 찾을 수 없습니다.`);
        }
        const sheetId = sheet.properties.sheetId;

        const data = await getSheetData(effectiveSpreadsheetId, sheetName);

        if (!data || !data.values || data.values.length === 0) {
            throw new Error('시트에서 데이터를 찾을 수 없습니다.');
        }

        const rowIndex = data.values.findIndex(row => row[1] === committeeName);

        if (rowIndex === -1) {
            throw new Error('해당 위원회 구성원을 시트에서 찾을 수 없습니다.');
        }

        await deleteRow(effectiveSpreadsheetId, sheetId, rowIndex);

    } catch (error) {
        console.error('Error deleting committee:', error);
        throw error;
    }
};
