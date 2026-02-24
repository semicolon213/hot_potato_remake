/**
 * @file VirtualList.tsx
 * @brief 가상 스크롤 리스트 (react-window 기반)
 * @details 대용량 목록에서 DOM 노드 수를 줄여 스크롤·메모리 성능을 개선합니다.
 */

import React from 'react';
import { FixedSizeList as List } from 'react-window';
import './VirtualList.css';

export interface VirtualListProps<T> {
  /** 전체 아이템 수 */
  itemCount: number;
  /** 한 행 높이 (px) */
  itemSize: number;
  /** 컨테이너 높이 (px). 미지정 시 400 */
  height?: number;
  /** 각 행 렌더 함수 */
  children: (index: number) => React.ReactNode;
  /** 리스트 너비. 미지정 시 100% */
  width?: number | string;
  /** 최소 적용 개수. 이 개수 미만이면 일반 div 스크롤로 렌더 (가상화 비적용) */
  minItemsToVirtualize?: number;
  /** 아이템 배열 (minItemsToVirtualize 미만일 때 일반 렌더용) */
  items?: T[];
  /** 일반 렌더 시 각 항목 렌더 (가상화 비적용 시) */
  renderItem?: (item: T, index: number) => React.ReactNode;
}

export function VirtualList<T>({
  itemCount,
  itemSize,
  height = 400,
  children,
  width = '100%',
  minItemsToVirtualize = 30,
  items = [],
  renderItem,
}: VirtualListProps<T>): React.ReactElement {
  const useVirtual = itemCount >= minItemsToVirtualize;

  if (!useVirtual && items.length > 0 && renderItem) {
    return (
      <div className="virtual-list virtual-list--fallback" style={{ maxHeight: height, overflow: 'auto' }}>
        {items.map((item, index) => (
          <div key={index} className="virtual-list__row" style={{ minHeight: itemSize }}>
            {renderItem(item, index)}
          </div>
        ))}
      </div>
    );
  }

  return (
    <List
      className="virtual-list"
      height={height}
      itemCount={itemCount}
      itemSize={itemSize}
      width={width}
      overscanCount={5}
    >
      {({ index, style }) => (
        <div style={style} className="virtual-list__row">
          {children(index)}
        </div>
      )}
    </List>
  );
}
