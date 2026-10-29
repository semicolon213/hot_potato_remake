import { logger } from '../../../utils/logger';
import { useState, useEffect } from 'react';
import { useAuthStore } from '../auth/useAuthStore';
// 타입 정의
interface AdminUser {
  id: string;
  email: string;
  studentId: string;
  name: string;
  isAdmin: boolean;
  isApproved: boolean;
  requestDate: string;
  approvalDate?: string | null;
  userType: string;
}

interface PinnedAnnouncementRequest {
  id: string;
  title: string;
  writer: string;
  writerEmail: string;
  writerId: string;
  date: string;
  status: 'pending';
}

type EmailStatus = 'idle' | 'sending' | 'success' | 'error';
import { fetchAllUsers, sendAdminKeyEmail, approveUserWithGroup, rejectUser, clearUserCache } from '../../../utils/api/adminApi';
import { apiClient } from '../../../utils/api/apiClient';
import { API_ACTIONS } from '../../../config/api';
import { fetchAnnouncements, getNoticeSpreadsheetApiFields } from '../../../utils/database/papyrusManager';
import type { ApiResponse } from '../../../config/api';
import { useAppDataStore } from '../../../stores/appDataStore';
const log = logger.scope('hooks/features/admin/useAdminPanel');


export const useAdminPanel = () => {
  const [users, setUsers] = useState<AdminUser[]>([]);
  const [pendingUsers, setPendingUsers] = useState<AdminUser[]>([]);
  const [approvedUsers, setApprovedUsers] = useState<AdminUser[]>([]);
  const [unusedUsers, setUnusedUsers] = useState<AdminUser[]>([]);
  const [pinnedAnnouncementRequests, setPinnedAnnouncementRequests] = useState<PinnedAnnouncementRequest[]>([]);
  const [emailToSend, setEmailToSend] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [message, setMessage] = useState('');
  const [emailStatus, setEmailStatus] = useState<EmailStatus>('idle');
  const [debugInfo, setDebugInfo] = useState('');
  
  const { user, setUser } = useAuthStore();
  const setAnnouncements = useAppDataStore((s) => s.setAnnouncements);

  /** 관리자가 시트만 바꾼 경우 메인 앱 공지 목록(Zustand)이 안 바뀌므로 강제 갱신 */
  const refreshMainAnnouncementsList = async () => {
    if (!user?.studentId || !user?.userType) return;
    try {
      const list = await fetchAnnouncements(user.studentId, user.userType, { forceRefresh: true });
      setAnnouncements(list);
    } catch (e) {
      log.error('공지 목록 갱신 실패 (관리자 승인 후):', e);
    }
  };

  // 고정 공지 승인 요청 목록 가져오기
  const loadPinnedAnnouncementRequests = async () => {
    try {
      const response = await apiClient.request(API_ACTIONS.GET_PINNED_ANNOUNCEMENT_REQUESTS, {
        ...getNoticeSpreadsheetApiFields()
      });

      if (response.success) {
        // 백엔드에서 requests가 최상위 레벨에 반환됨
        const requests = (response as { requests?: PinnedAnnouncementRequest[] }).requests || 
                         (response.data as { requests?: PinnedAnnouncementRequest[] } | undefined)?.requests || 
                         [];
        setPinnedAnnouncementRequests(requests);
      } else {
        log.error('고정 공지 승인 요청 목록 로딩 실패');
        setPinnedAnnouncementRequests([]);
      }
    } catch (error) {
      log.error('고정 공지 승인 요청 목록 로딩 오류:', error);
      setPinnedAnnouncementRequests([]);
    }
  };

  // 고정 공지 승인
  const handleApprovePinnedAnnouncement = async (announcementId: string) => {
    try {
      setIsLoading(true);
      setMessage('');

      const response = await apiClient.request(API_ACTIONS.APPROVE_PINNED_ANNOUNCEMENT, {
        ...getNoticeSpreadsheetApiFields(),
        announcementId: announcementId,
        approvalAction: 'approve'
      });

      if (response.success) {
        setMessage('고정 공지가 승인되었습니다.');
        await refreshMainAnnouncementsList();
        await loadPinnedAnnouncementRequests();
      } else {
        setMessage(response.message || '고정 공지 승인에 실패했습니다.');
      }
    } catch (error) {
      log.error('고정 공지 승인 실패:', error);
      setMessage('고정 공지 승인에 실패했습니다.');
    } finally {
      setIsLoading(false);
    }
  };

  // 고정 공지 거절
  const handleRejectPinnedAnnouncement = async (announcementId: string) => {
    try {
      setIsLoading(true);
      setMessage('');

      const response = await apiClient.request(API_ACTIONS.APPROVE_PINNED_ANNOUNCEMENT, {
        ...getNoticeSpreadsheetApiFields(),
        announcementId: announcementId,
        approvalAction: 'reject'
      });

      if (response.success) {
        setMessage('고정 공지가 거절되었습니다.');
        await refreshMainAnnouncementsList();
        await loadPinnedAnnouncementRequests();
      } else {
        setMessage(response.message || '고정 공지 거절에 실패했습니다.');
      }
    } catch (error) {
      log.error('고정 공지 거절 실패:', error);
      setMessage('고정 공지 거절에 실패했습니다.');
    } finally {
      setIsLoading(false);
    }
  };

  // 사용자 목록 가져오기
  const loadUsers = async () => {
    try {
      setIsLoading(true);
      const result = await fetchAllUsers() as ApiResponse<{ users: AdminUser[] }>;
      
      // 디버그 정보 출력
      if (result.debug) {
      // Intentionally ignored.

      }
      
      if (result.success && Array.isArray(result.users)) {
        
        const userListDebug = result.users.map((user: AdminUser) => ({
          id: user.id,
          studentId: user.studentId,
          name: user.name,
          email: user.email,
          userType: user.userType,
          isApproved: user.isApproved,
          isAdmin: user.isAdmin
        }));
        
        log.debug('setUsers 호출 전 현재 users 상태:', users);
        
        // Apps Script에서 받은 데이터를 AdminUser 타입으로 변환
        const convertedUsers = result.users.map((user: Partial<AdminUser> & Record<string, unknown>) => {
          // Approval 필드 확인 (앱스크립트에서 직접 전달되는 필드)
          // 'O' = 승인됨, 'X' = 승인 대기, '' 또는 null = 승인 대기 (비어있으면 사용자로 처리)
          const approvalStatus = user.Approval || user.approval || '';
          const isApproved = approvalStatus === 'O';
          
          return {
            id: user.id || user.no_member || `user_${Math.random()}`,
            email: user.email || '',
            studentId: user.studentId || user.no_member || '',
            name: user.name || user.name_member || '',
            isAdmin: user.isAdmin || (user.is_admin === 'O'),
            isApproved: isApproved,
            requestDate: user.requestDate || user.approval_date || new Date().toISOString().split('T')[0],
            approvalDate: isApproved ? (user.approvalDate || user.approval_date || null) : null,
            userType: user.userType || user.user_type || 'student',
            // 원본 Approval 필드 저장 (필터링용)
            _approvalStatus: approvalStatus
          };
        });
        
        // Approval 필드 기준으로 필터링
        // 승인 대기: Approval이 'X'인 경우만
        const pending = convertedUsers.filter(user => {
          const approvalStatus = (user as any)._approvalStatus || '';
          return approvalStatus === 'X';
        });
        
        // 승인된 사용자: Approval이 'O'인 경우만
        const approved = convertedUsers.filter(user => {
          const approvalStatus = (user as any)._approvalStatus || '';
          return approvalStatus === 'O';
        });
        
        // 미사용 사용자: Approval이 비어있는 경우 ('' 또는 null 또는 undefined)
        const unused = convertedUsers.filter(user => {
          const approvalStatus = (user as any)._approvalStatus || '';
          return approvalStatus === '' || approvalStatus === null || approvalStatus === undefined;
        });

        setDebugInfo(`사용자 수: ${convertedUsers.length}\n승인 대기: ${pending.length}\n승인됨: ${approved.length}\n\n사용자 목록:\n${JSON.stringify(userListDebug.slice(0, 3), null, 2)}`);
        
        setUsers(convertedUsers);
        setPendingUsers(pending);
        setApprovedUsers(approved);
        setUnusedUsers(unused);
      } else {
        
        // 에러 디버그 정보 출력
        if (result.debug) {
      // Intentionally ignored.

        }
        
        setUsers([]);
        setPendingUsers([]);
        setApprovedUsers([]);
        setUnusedUsers([]);
        setMessage('사용자 목록을 가져오는데 실패했습니다.');
      }
    } catch (error) {
      log.error('사용자 목록 조회 실패:', error);
      setUsers([]);
      setPendingUsers([]);
      setApprovedUsers([]);
      setUnusedUsers([]);
      setMessage('사용자 목록을 가져오는데 실패했습니다.');
    } finally {
      setIsLoading(false);
    }
  };

  // 사용자 승인 (그룹스 권한과 함께)
  const handleApproveUser = async (studentId: string, groupRole: string) => {
    try {
      setIsLoading(true);
      setMessage('');
      log.debug('studentId');
      log.debug('groupRole:', groupRole);
      
      const result = await approveUserWithGroup(studentId, groupRole);
      
      if (result.success) {
        setMessage(result.message || '사용자가 승인되었습니다.');
        
        // 즉시 로컬 상태 업데이트 (UI 즉시 반영)
        const approvedUser = users.find(u => u.studentId === studentId);
        if (approvedUser) {
          log.debug('승인된 사용자 찾음:', approvedUser);
          
          // 로컬 users 상태에서 해당 사용자의 isApproved를 true로 업데이트
          setUsers(prevUsers => 
            prevUsers.map(u => 
              u.studentId === studentId 
                ? { ...u, isApproved: true, approvalDate: new Date().toISOString().split('T')[0] }
                : u
            )
          );
          
          // 현재 로그인한 사용자가 승인된 경우 상태 업데이트
          if (approvedUser.email === user?.email) {
            const updatedUser = {
              ...user,
              isApproved: true,
              isAdmin: approvedUser.isAdmin
            };
            setUser(updatedUser);
            localStorage.setItem('user', JSON.stringify(updatedUser));
          }
        }
        await clearUserCache();
        await loadUsers();
      } else {
        setMessage(result.message || result.error || '사용자 승인에 실패했습니다.');
      }
      
    } catch (error) {
      log.error('사용자 승인 실패:', error);
      setMessage('사용자 승인에 실패했습니다.');
    } finally {
      setIsLoading(false);
    }
  };

  // 사용자 거부
  const handleRejectUser = async (userId: string) => {
    try {
      setIsLoading(true);
      setMessage('');
      log.debug('userId');
      
      const result = await rejectUser(userId);
      
      if (result.success) {
        setMessage('사용자가 거부되었습니다.');
        
        // 즉시 로컬 상태에서 사용자 제거 (UI 즉시 반영)
        const rejectedUser = users.find(u => u.id === userId);
        if (rejectedUser) {
          log.debug('거부된 사용자 찾음:', rejectedUser);
          
          // 로컬 users 상태에서 해당 사용자 제거
          setUsers(prevUsers => prevUsers.filter(u => u.id !== userId));
        }
        await clearUserCache();
        await loadUsers();
      } else {
        setMessage(result.error || '사용자 거부에 실패했습니다.');
      }
      
    } catch (error) {
      log.error('사용자 거부 실패:', error);
      setMessage('사용자 거부에 실패했습니다.');
    } finally {
      setIsLoading(false);
    }
  };

  // 사용자 일괄 추가
  const handleAddUsers = async (usersToAdd: Array<{ no_member: string; name_member: string }>) => {
    try {
      setIsLoading(true);
      setMessage('');
      log.debug('추가할 사용자 수:', usersToAdd.length);
      
      const result = await apiClient.addUsersToSpreadsheet(usersToAdd);
      
      if (result.success) {
        const addedCount = (result.data as { added?: number })?.added || usersToAdd.length;
        const skippedCount = (result.data as { skipped?: number })?.skipped || 0;
        
        setMessage(`${addedCount}명의 사용자가 추가되었습니다.${skippedCount > 0 ? ` (${skippedCount}명 중복으로 건너뜀)` : ''}`);
        await clearUserCache();
        await loadUsers();
      } else {
        setMessage(result.message || result.error || '사용자 추가에 실패했습니다.');
        throw new Error(result.message || result.error || '사용자 추가에 실패했습니다.');
      }
      
    } catch (error) {
      log.error('사용자 추가 실패:', error);
      const errorMessage = error instanceof Error ? error.message : '사용자 추가에 실패했습니다.';
      setMessage(errorMessage);
      throw error;
    } finally {
      setIsLoading(false);
    }
  };

  // 관리자 키 이메일 전송
  const handleSendAdminKey = async () => {
    try {
      setIsLoading(true);
      setMessage('');
      setEmailStatus('sending');
      
      if (!emailToSend) {
        setMessage('이메일을 입력해주세요.');
        setEmailStatus('error');
        return;
      }

      // 백엔드에서 관리자 키 이메일 전송 처리
      const result = await sendAdminKeyEmail(emailToSend) as ApiResponse<{
        adminKey: string;
        encryptedKey: string;
        layersUsed: number;
      }>;
      
      if (result.success) {
        setMessage(result.message || '관리자 키가 이메일로 전송되었습니다!');
        setEmailToSend('');
        setEmailStatus('success');
      } else {
        const errorMessage = result.message || (result && typeof result === 'object' && 'error' in result ? String(result.error) : '알 수 없는 오류');
        setMessage('이메일 전송에 실패했습니다: ' + errorMessage);
        setEmailStatus('error');
      }
      
    } catch {
      log.error('이메일 전송 오류');
      setMessage('이메일 전송 중 오류가 발생했습니다.');
      setEmailStatus('error');
    } finally {
      setIsLoading(false);
    }
  };

  // 초기화
  useEffect(() => {
    loadUsers();
    loadPinnedAnnouncementRequests();
  }, []);

  // 메시지 자동 사라짐
  useEffect(() => {
    if (message) {
      const timer = setTimeout(() => {
        setMessage('');
        setEmailStatus('idle');
      }, 3000);
      return () => clearTimeout(timer);
    }
  }, [message]);

  // 이메일 전송 성공 후 상태 초기화
  useEffect(() => {
    if (emailStatus === 'success') {
      const timer = setTimeout(() => {
        setEmailStatus('idle');
        setMessage('');
      }, 3000);
      return () => clearTimeout(timer);
    }
  }, [emailStatus]);

  return {
    users,
    pendingUsers,
    approvedUsers,
    unusedUsers,
    pinnedAnnouncementRequests,
    emailToSend,
    setEmailToSend,
    isLoading,
    message,
    emailStatus,
    debugInfo,
    handleApproveUser,
    handleRejectUser,
    handleAddUsers,
    handleSendAdminKey,
    handleApprovePinnedAnnouncement,
    handleRejectPinnedAnnouncement,
    loadUsers,
    loadPinnedAnnouncementRequests
  };
};
