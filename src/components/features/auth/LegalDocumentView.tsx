import React from 'react';
import './LegalDocumentView.css';

export type LegalDocType = 'privacy' | 'terms';

interface LegalDocumentViewProps {
  type: LegalDocType;
  onBack: () => void;
}

const PRIVACY_BODY = (
  <>
    <p className="legal-doc-lead">
      HP ERP(이하 &quot;서비스&quot;)는 Google 계정으로 로그인하며, 학사·행정 업무 처리를 위해 Google 스프레드시트·드라이브·캘린더 등 Google API를 사용할 수 있습니다.
    </p>
    <h2>1. 수집·이용 정보</h2>
    <ul>
      <li>Google OAuth를 통해 제공되는 프로필 정보(이메일, 이름 등)</li>
      <li>서비스 이용 과정에서 입력·저장되는 학번/교번, 직책, 문서·일정·공지 등 업무 데이터</li>
    </ul>
    <h2>2. 이용 목적</h2>
    <p>본인 확인, 권한에 따른 기능 제공, 공지·일정·문서·회계 등 서비스 운영 및 기술 지원.</p>
    <h2>3. 보관 및 파기</h2>
    <p>관리 정책 및 관련 법령에 따라 보관하며, 목적 달성 후 안전하게 삭제합니다.</p>
    <h2>4. 문의</h2>
    <p>서비스 운영 주체의 담당 부서에 문의해 주세요.</p>
    <p className="legal-doc-note">본 문서는 내부용 서비스를 위한 안내이며, 필요 시 법무·개인정보 보호 담당자 검토를 받으시기 바랍니다.</p>
  </>
);

const TERMS_BODY = (
  <>
    <p className="legal-doc-lead">
      본 약관은 HP ERP 서비스 이용에 관한 기본적인 사항을 정합니다.
    </p>
    <h2>1. 서비스 목적</h2>
    <p>학과·행정 업무를 위한 문서, 일정, 공지, 회계 등 기능을 제공합니다.</p>
    <h2>2. 계정 및 권한</h2>
    <p>Google 계정으로 로그인하며, 관리자가 부여한 유형(학생, 교직원 등)에 따라 기능이 제한될 수 있습니다.</p>
    <h2>3. 이용자 의무</h2>
    <p>타인의 정보를 무단으로 열람·유출하지 않으며, 계정을 제3자에게 양도하지 않습니다.</p>
    <h2>4. 서비스 변경·중단</h2>
    <p>운영상 필요 시 사전 또는 사후 공지 후 변경·중단할 수 있습니다.</p>
    <h2>5. 기타</h2>
    <p>세부 사항은 학과·기관 내부 규정을 따릅니다.</p>
    <p className="legal-doc-note">실제 법적 구속력이 필요하면 기관 법무 검토 후 수정하시기 바랍니다.</p>
  </>
);

export const LegalDocumentView: React.FC<LegalDocumentViewProps> = ({ type, onBack }) => {
  const title = type === 'privacy' ? '개인정보처리방침' : '서비스 이용약관';

  return (
    <div className="legal-doc-root">
      <div className="legal-doc-panel">
        <header className="legal-doc-header">
          <button type="button" className="legal-doc-back" onClick={onBack}>
            ← 로그인으로
          </button>
          <h1 className="legal-doc-title">{title}</h1>
        </header>
        <div className="legal-doc-scroll">
          <article className="legal-doc-article">{type === 'privacy' ? PRIVACY_BODY : TERMS_BODY}</article>
        </div>
      </div>
    </div>
  );
};

export default LegalDocumentView;
