import React, { useState, useMemo, useRef, useEffect } from 'react';
import { FaFilter, FaTimes, FaBullhorn, FaThumbtack, FaFileAlt, FaPlus } from "react-icons/fa";
import '../../styles/pages/Announcements.css';
import type { Post, User } from '../../types/app';
import { formatDateToYYYYMMDD } from '../../utils/helpers/timeUtils';
import TableColumnFilter, { type SortDirection, type FilterValue } from '../../components/ui/common/TableColumnFilter';
import StatCard from '../../components/features/documents/StatCard';
import { useNotification } from '../../hooks/ui/useNotification';

interface AnnouncementsProps {
  onPageChange: (pageName: string) => void;
  onSelectAnnouncement: (post: Post) => void;
  onUnpinAnnouncement?: (announcementId: string) => Promise<void>;
  posts: Post[];
  isAuthenticated: boolean;
  announcementSpreadsheetId: string | null;
  isLoading: boolean;
  user: User | null;
  "data-oid": string;
}

// Helper function to generate pagination numbers
const getPaginationNumbers = (currentPage: number, totalPages: number) => {
  const pageNeighbours = 2; // How many pages to show on each side of the current page
  const totalNumbers = (pageNeighbours * 2) + 1; // Total page numbers to show
  const totalBlocks = totalNumbers + 2; // Total numbers + 2 for ellipses

  if (totalPages <= totalBlocks) {
    return Array.from({ length: totalPages }, (_, i) => i + 1);
  }

  const startPage = Math.max(2, currentPage - pageNeighbours);
  const endPage = Math.min(totalPages - 1, currentPage + pageNeighbours);
  let pages: (string | number)[] = Array.from({ length: (endPage - startPage) + 1 }, (_, i) => startPage + i);

  const hasLeftSpill = startPage > 2;
  const hasRightSpill = (totalPages - endPage) > 1;
  const spillOffset = totalNumbers - (pages.length + 1);

  switch (true) {
    // handle: (1) ... {5 6 7} ... (10)
    case (hasLeftSpill && !hasRightSpill):
      const extraPages = Array.from({ length: spillOffset }, (_, i) => startPage - 1 - i).reverse();
      pages = ['...', ...extraPages, ...pages];
      break;

    // handle: (1) {2 3 4} ... (10)
    case (!hasLeftSpill && hasRightSpill):
      const extraPages_ = Array.from({ length: spillOffset }, (_, i) => endPage + 1 + i);
      pages = [...pages, ...extraPages_, '...'];
      break;

    // handle: (1) ... {4 5 6} ... (10)
    case (hasLeftSpill && hasRightSpill):
    default:
      pages = ['...', ...pages, '...'];
      break;
  }

  return [1, ...pages, totalPages];
};


const AnnouncementsPage: React.FC<AnnouncementsProps> = ({ onPageChange, onSelectAnnouncement, onUnpinAnnouncement, posts, isAuthenticated, announcementSpreadsheetId, isLoading, user }) => {
  const { confirmAsync } = useNotification();
  const [currentPage, setCurrentPage] = useState(1);
  const postsPerPage = 8;

  // 필터 상태
  const [filterConfigs, setFilterConfigs] = useState<Record<string, {
    sortDirection: SortDirection;
    selectedFilters: FilterValue[];
  }>>({});
  const [openFilterColumn, setOpenFilterColumn] = useState<string | null>(null);
  const [filterPopupPosition, setFilterPopupPosition] = useState<{ top: number; left: number }>({ top: 0, left: 0 });

  // 필터 옵션 가져오기
  const getFilterOptions = (columnKey: string) => {
    const uniqueValues = new Set<FilterValue>();
    
    posts.forEach(post => {
      let value: FilterValue | null = null;
      if (columnKey === 'number') {
        value = post.id;
      } else if (columnKey === 'title') {
        value = post.title || '';
      } else if (columnKey === 'author') {
        value = post.author || '';
      } else if (columnKey === 'views') {
        value = post.views || 0;
      } else if (columnKey === 'date') {
        value = post.date || '';
      }
      
      if (value !== null) {
        uniqueValues.add(value);
      }
    });

    return Array.from(uniqueValues).map(value => ({
      value,
      label: String(value)
    })).sort((a, b) => String(a.value).localeCompare(String(b.value)));
  };

  // 헤더 클릭 핸들러
  const handleHeaderClick = (e: React.MouseEvent, key: string) => {
    e.stopPropagation();
    const thElement = e.currentTarget as HTMLElement;
    const rect = thElement.getBoundingClientRect();
    setFilterPopupPosition({
      top: rect.bottom + 4,
      left: rect.left + rect.width / 2 // 헤더 셀의 가운데 위치
    });
    setOpenFilterColumn(openFilterColumn === key ? null : key);
  };

  // 정렬 변경 핸들러
  const handleSortChange = (columnKey: string, direction: SortDirection) => {
    setFilterConfigs(prev => ({
      ...prev,
      [columnKey]: {
        ...prev[columnKey] || { sortDirection: null, selectedFilters: [] },
        sortDirection: direction
      }
    }));
  };

  // 필터 변경 핸들러
  const handleFilterChange = (columnKey: string, filters: FilterValue[]) => {
    setFilterConfigs(prev => ({
      ...prev,
      [columnKey]: {
        ...prev[columnKey] || { sortDirection: null, selectedFilters: [] },
        selectedFilters: filters
      }
    }));
    setCurrentPage(1); // 필터 변경 시 첫 페이지로
  };

  // 필터 초기화 핸들러
  const handleClearFilters = (columnKey: string, e?: React.MouseEvent) => {
    if (e) {
      e.stopPropagation();
    }
    setFilterConfigs(prev => {
      const newConfigs = { ...prev };
      if (newConfigs[columnKey]) {
        newConfigs[columnKey] = {
          sortDirection: null,
          selectedFilters: []
        };
      }
      return newConfigs;
    });
  };

  // 검색어 필터링 제거 - 모든 posts 사용
  const searchFilteredPosts = useMemo(() => {
    return posts;
  }, [posts]);

  // 필터 및 정렬 적용
  const filteredPosts = useMemo(() => {
    let filtered = [...searchFilteredPosts];

    // 컬럼별 필터 적용
    Object.keys(filterConfigs).forEach(columnKey => {
      const config = filterConfigs[columnKey];
      if (config.selectedFilters.length > 0) {
        filtered = filtered.filter(post => {
          let value: FilterValue | null = null;
          if (columnKey === 'number') {
            value = post.id;
          } else if (columnKey === 'title') {
            value = post.title || '';
          } else if (columnKey === 'author') {
            value = post.author || '';
          } else if (columnKey === 'views') {
            value = post.views || 0;
          } else if (columnKey === 'date') {
            value = post.date || '';
          }
          return value !== null && config.selectedFilters.includes(value);
        });
      }
    });

    // 정렬 적용
    Object.keys(filterConfigs).forEach(columnKey => {
      const config = filterConfigs[columnKey];
      if (config.sortDirection) {
        filtered.sort((a, b) => {
          let aValue: any;
          let bValue: any;
          
          if (columnKey === 'number') {
            aValue = parseInt(String(a.id).replace('temp-', ''), 10) || 0;
            bValue = parseInt(String(b.id).replace('temp-', ''), 10) || 0;
          } else if (columnKey === 'title') {
            aValue = a.title || '';
            bValue = b.title || '';
          } else if (columnKey === 'author') {
            aValue = a.author || '';
            bValue = b.author || '';
          } else if (columnKey === 'views') {
            aValue = a.views || 0;
            bValue = b.views || 0;
          } else if (columnKey === 'date') {
            aValue = a.date || '';
            bValue = b.date || '';
          }

          if (aValue < bValue) return config.sortDirection === 'asc' ? -1 : 1;
          if (aValue > bValue) return config.sortDirection === 'asc' ? 1 : -1;
          return 0;
        });
      }
    });

    // 고정 공지와 일반 공지를 분리하여 각각 정렬
    const pinnedPosts = filtered.filter(p => p.isPinned);
    const normalPosts = filtered.filter(p => !p.isPinned);

    // 각 그룹을 ID 역순으로 정렬 (최신순) - 정렬이 없을 때만
    if (!Object.values(filterConfigs).some(config => config.sortDirection)) {
      pinnedPosts.sort((a, b) => parseInt(b.id, 10) - parseInt(a.id, 10));
      normalPosts.sort((a, b) => {
        const isATemp = String(a.id).startsWith('temp-');
        const isBTemp = String(b.id).startsWith('temp-');

        if (isATemp && !isBTemp) return -1;
        if (!isATemp && isBTemp) return 1;

        const idA = parseInt(String(a.id).replace('temp-', ''), 10);
        const idB = parseInt(String(b.id).replace('temp-', ''), 10);

        if (isNaN(idA) || isNaN(idB)) return 0;
        return idB - idA;
      });
    }

    // 고정 공지를 최상단에 위치시켜 최종 목록 생성
    return [...pinnedPosts, ...normalPosts];
  }, [searchFilteredPosts, filterConfigs]);

  const sortedFilteredPosts = filteredPosts;

  // 통계 데이터 계산
  const totalPosts = posts.length;
  const pinnedPostsCount = posts.filter(p => p.isPinned).length;
  const normalPostsCount = posts.filter(p => !p.isPinned).length;

  // 통계 카드 데이터
  const announcementStatCards = [
    {
      count: totalPosts,
      title: '전체 공지',
      backgroundColor: '#E8F5E9',
      textColor: '#000000',
      icon: FaBullhorn,
      iconColor: '#2E7D32',
    },
    {
      count: pinnedPostsCount,
      title: '고정 공지',
      backgroundColor: '#FFEBEE',
      textColor: '#000000',
      icon: FaThumbtack,
      iconColor: '#C62828',
    },
    {
      count: normalPostsCount,
      title: '일반 공지',
      backgroundColor: '#E3F2FD',
      textColor: '#000000',
      icon: FaFileAlt,
      iconColor: '#1565C0',
    },
    {
      count: 0,
      title: '새 공지 만들기',
      backgroundColor: '#FFF3E0',
      textColor: '#000000',
      icon: FaPlus,
      iconColor: '#E65100',
      onClick: () => onPageChange('new-announcement-post'),
    },
  ];

  // Pagination logic
  const totalPages = Math.ceil(sortedFilteredPosts.length / postsPerPage);
  const indexOfLastPost = currentPage * postsPerPage;
  const indexOfFirstPost = indexOfLastPost - postsPerPage;
  const currentPosts = sortedFilteredPosts.slice(indexOfFirstPost, indexOfLastPost);

  const paginate = (pageNumber: number) => {
    if (pageNumber > 0 && pageNumber <= totalPages) {
      setCurrentPage(pageNumber);
    }
  };

  const paginationNumbers = totalPages > 1 ? getPaginationNumbers(currentPage, totalPages) : [];

  return (
    <div className="announcements-container">
      <div className="announcements-header">
        <h1 className="announcements-title">공지사항</h1>
      </div>

      {/* 공지사항 통계 카드 */}
      <div className="stats-container">
        {announcementStatCards.map((stat, index) => (
          <StatCard
            key={index}
            count={stat.count}
            title={stat.title}
            backgroundColor={stat.backgroundColor}
            textColor={stat.textColor}
            icon={stat.icon}
            iconColor={stat.iconColor}
            onClick={stat.onClick}
          />
        ))}
      </div>
      
      <div className="post-list">
        {isLoading ? (
          <p className="loading-message">데이터를 불러오는 중입니다. 잠시만 기다려주세요...</p>
        ) : filteredPosts.length > 0 ? (
          <table className="post-table">
            <thead>
              <tr>
                <th 
                  className={`col-number sortable ${filterConfigs['number']?.sortDirection ? 'sorted' : ''} ${filterConfigs['number']?.selectedFilters.length ? 'filtered' : ''}`}
                  onClick={(e) => handleHeaderClick(e, 'number')}
                >
                  <div className="th-content">
                    <span>번호</span>
                    {(filterConfigs['number']?.sortDirection || filterConfigs['number']?.selectedFilters.length > 0) && (
                      <button
                        className="filter-clear-icon"
                        onClick={(e) => handleClearFilters('number', e)}
                        title="필터/정렬 초기화"
                      >
                        <FaFilter className="filter-icon" />
                        <FaTimes className="clear-icon" />
                      </button>
                    )}
                  </div>
                </th>
                <th 
                  className={`col-title sortable ${filterConfigs['title']?.sortDirection ? 'sorted' : ''} ${filterConfigs['title']?.selectedFilters.length ? 'filtered' : ''}`}
                  onClick={(e) => handleHeaderClick(e, 'title')}
                >
                  <div className="th-content">
                    <span>제목</span>
                    {(filterConfigs['title']?.sortDirection || filterConfigs['title']?.selectedFilters.length > 0) && (
                      <button
                        className="filter-clear-icon"
                        onClick={(e) => handleClearFilters('title', e)}
                        title="필터/정렬 초기화"
                      >
                        <FaFilter className="filter-icon" />
                        <FaTimes className="clear-icon" />
                      </button>
                    )}
                  </div>
                </th>
                <th 
                  className={`col-author sortable ${filterConfigs['author']?.sortDirection ? 'sorted' : ''} ${filterConfigs['author']?.selectedFilters.length ? 'filtered' : ''}`}
                  onClick={(e) => handleHeaderClick(e, 'author')}
                >
                  <div className="th-content">
                    <span>작성자</span>
                    {(filterConfigs['author']?.sortDirection || filterConfigs['author']?.selectedFilters.length > 0) && (
                      <button
                        className="filter-clear-icon"
                        onClick={(e) => handleClearFilters('author', e)}
                        title="필터/정렬 초기화"
                      >
                        <FaFilter className="filter-icon" />
                        <FaTimes className="clear-icon" />
                      </button>
                    )}
                  </div>
                </th>
                <th 
                  className={`col-views sortable ${filterConfigs['views']?.sortDirection ? 'sorted' : ''} ${filterConfigs['views']?.selectedFilters.length ? 'filtered' : ''}`}
                  onClick={(e) => handleHeaderClick(e, 'views')}
                >
                  <div className="th-content">
                    <span>조회</span>
                    {(filterConfigs['views']?.sortDirection || filterConfigs['views']?.selectedFilters.length > 0) && (
                      <button
                        className="filter-clear-icon"
                        onClick={(e) => handleClearFilters('views', e)}
                        title="필터/정렬 초기화"
                      >
                        <FaFilter className="filter-icon" />
                        <FaTimes className="clear-icon" />
                      </button>
                    )}
                  </div>
                </th>
                <th 
                  className={`col-date sortable ${filterConfigs['date']?.sortDirection ? 'sorted' : ''} ${filterConfigs['date']?.selectedFilters.length ? 'filtered' : ''}`}
                  onClick={(e) => handleHeaderClick(e, 'date')}
                >
                  <div className="th-content">
                    <span>작성일자</span>
                    {(filterConfigs['date']?.sortDirection || filterConfigs['date']?.selectedFilters.length > 0) && (
                      <button
                        className="filter-clear-icon"
                        onClick={(e) => handleClearFilters('date', e)}
                        title="필터/정렬 초기화"
                      >
                        <FaFilter className="filter-icon" />
                        <FaTimes className="clear-icon" />
                      </button>
                    )}
                  </div>
                </th>
              </tr>
            </thead>
            <tbody>
              {currentPosts.map((post, index) => (
                <tr 
                  key={post.id} 
                  onClick={() => onSelectAnnouncement(post)}
                  className={post.isPinned ? 'pinned-announcement-row' : ''}
                >
                  <td className="col-number">
                    {post.isPinned ? (
                      <span style={{ color: '#ff6b6b', fontWeight: 'bold' }}>📌</span>
                    ) : String(post.id).startsWith('temp-') ? (
                      <span style={{ color: '#999' }}>-</span>
                    ) : (
                      post.id
                    )}
                  </td>
                  <td className="col-title">
                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                      <span style={{ flex: 1 }}>
                        {post.isPinned && <span style={{ color: '#ff6b6b', marginRight: '5px', fontWeight: 'bold' }}>[고정]</span>}
                        {post.title}
                      </span>
                      {post.isPinned && user && onUnpinAnnouncement && (
                        (String(user.studentId) === post.writer_id || user.isAdmin) && (
                          <button
                            onClick={async (e) => {
                              e.stopPropagation();
                              if (await confirmAsync('고정 공지를 해제하시겠습니까?', { type: 'warning' })) {
                                onUnpinAnnouncement(post.id);
                              }
                            }}
                            style={{
                              padding: '4px 8px',
                              fontSize: '12px',
                              backgroundColor: '#fff',
                              color: '#ff6b6b',
                              border: '1px solid #ff6b6b',
                              borderRadius: '4px',
                              cursor: 'pointer',
                              fontWeight: '500'
                            }}
                            onMouseEnter={(e) => {
                              e.currentTarget.style.backgroundColor = '#ff6b6b';
                              e.currentTarget.style.color = '#fff';
                            }}
                            onMouseLeave={(e) => {
                              e.currentTarget.style.backgroundColor = '#fff';
                              e.currentTarget.style.color = '#ff6b6b';
                            }}
                          >
                            해제
                          </button>
                        )
                      )}
                    </div>
                  </td>
                  <td className="col-author">{post.author}</td>
                  <td className="col-views">{post.views}</td>
                  <td className="col-date">{formatDateToYYYYMMDD(post.date)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        ) : (
          <p className="no-results">{isAuthenticated ? '공지사항이 없습니다.' : '데이터를 불러오는 중입니다. 잠시만 기다려주세요...'}</p>
        )}
      </div>

      {/* 페이지네이션 - 표와 분리 */}
      {!isLoading && filteredPosts.length > 0 && totalPages > 1 && (
        <div className="pagination">
          <button onClick={() => paginate(currentPage - 1)} disabled={currentPage === 1} className="page-arrow-link">
            <span>이전</span>
          </button>

          {paginationNumbers.map((page, index) => {
            if (typeof page === 'string') {
              return <span key={`ellipsis-${index}`} className="page-ellipsis">...</span>;
            }
            return (
              <button 
                key={page} 
                onClick={() => paginate(page)} 
                className={`page-link ${currentPage === page ? 'active' : ''}`}>
                {page}
              </button>
            );
          })}

          <button onClick={() => paginate(currentPage + 1)} disabled={currentPage === totalPages} className="page-arrow-link">
            <span>다음</span>
          </button>
        </div>
      )}

      {/* 필터 팝업 */}
      {openFilterColumn && (
        <TableColumnFilter
          columnKey={openFilterColumn}
          columnLabel={
            openFilterColumn === 'number' ? '번호' :
            openFilterColumn === 'title' ? '제목' :
            openFilterColumn === 'author' ? '작성자' :
            openFilterColumn === 'views' ? '조회' :
            openFilterColumn === 'date' ? '작성일자' : ''
          }
          isOpen={true}
          position={filterPopupPosition}
          onClose={() => setOpenFilterColumn(null)}
          sortDirection={filterConfigs[openFilterColumn]?.sortDirection || null}
          onSortChange={(direction) => handleSortChange(openFilterColumn, direction)}
          availableOptions={getFilterOptions(openFilterColumn)}
          selectedFilters={filterConfigs[openFilterColumn]?.selectedFilters || []}
          onFilterChange={(filters) => handleFilterChange(openFilterColumn, filters)}
          onClearFilters={() => handleClearFilters(openFilterColumn)}
        />
      )}
    </div>
  );
};

export default AnnouncementsPage;
