/**
 * @file LedgerList.tsx
 * @brief 장부 목록 컴포넌트
 * @details 장부 목록을 표시하고 장부를 선택할 수 있는 컴포넌트입니다.
 *         부모(Accounting)에서 useLedgerManagement를 한 번만 사용하고 여기로 전달하여 중복 API 호출을 막습니다.
 * @author Hot Potato Team
 * @date 2024
 */

import React from 'react';
import type { LedgerInfo } from '../../../types/features/accounting';
import { ErrorFallback } from '../../ui/ErrorFallback';
import './accounting.css';

interface LedgerListProps {
  ledgers: LedgerInfo[];
  isLoading: boolean;
  error: string | null;
  refreshLedgers: () => void | Promise<void>;
  onSelectLedger?: (ledger: LedgerInfo) => void;
  onCreateLedger?: () => void;
}

export const LedgerList: React.FC<LedgerListProps> = ({
  ledgers,
  isLoading,
  error,
  refreshLedgers,
  onSelectLedger,
  onCreateLedger
}) => {

  if (isLoading) {
    return (
      <div className="ledger-list-loading">
        <p>장부 목록을 불러오는 중...</p>
      </div>
    );
  }

  if (error) {
    return (
      <div className="ledger-list-error">
        <ErrorFallback
          message={error}
          onRetry={refreshLedgers}
          title="장부 목록을 불러올 수 없습니다"
        />
      </div>
    );
  }

  if (ledgers.length === 0) {
    return (
      <div className="ledger-list-empty">
        <p>등록된 장부가 없습니다.</p>
      </div>
    );
  }

  return (
    <>
      <div className="post-list">
        <table className="ledger-table">
          <colgroup>
            <col className="col-name-width" />
            <col className="col-date-width" />
            <col className="col-status-width" />
            <col className="col-status-width" />
          </colgroup>
          <thead>
            <tr>
              <th className="col-name">장부명</th>
              <th className="col-date">생성일</th>
              <th className="col-status">스프레드시트</th>
              <th className="col-status">증빙 폴더</th>
            </tr>
          </thead>
          <tbody>
            {ledgers.map((ledger) => (
              <tr 
                key={ledger.folderId} 
                className="ledger-row"
                onClick={() => onSelectLedger?.(ledger)}
              >
                <td className="col-name">
                  <div className="title-cell-inner">
                    <span className="title-ellipsis">{ledger.folderName}</span>
                  </div>
                </td>
                <td className="col-date">
                  {ledger.createdDate 
                    ? new Date(ledger.createdDate).toLocaleDateString('ko-KR')
                    : '알 수 없음'}
                </td>
                <td className="col-status">
                  <span className={`tag-badge ${ledger.spreadsheetId ? 'status-connected' : 'status-disconnected'}`}>
                    {ledger.spreadsheetId ? '연결' : '연결불가'}
                  </span>
                </td>
                <td className="col-status">
                  <span className={`tag-badge ${ledger.evidenceFolderId ? 'status-connected' : 'status-disconnected'}`}>
                    {ledger.evidenceFolderId ? '연결' : '연결불가'}
                  </span>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </>
  );
};

