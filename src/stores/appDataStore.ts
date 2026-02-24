/**
 * @file appDataStore.ts
 * @brief 도메인별 앱 데이터 Zustand 스토어
 * @details 공지·캘린더 등 도메인 데이터를 분리해 구독 단위를 줄이고, useAppState는 이 스토어를 조합해 사용합니다.
 */

import { create } from 'zustand';
import type { Post, Event } from '../types/app';

interface AppDataState {
  announcements: Post[];
  calendarEvents: Event[];
  setAnnouncements: (v: Post[]) => void;
  setCalendarEvents: (v: Event[]) => void;
}

export const useAppDataStore = create<AppDataState>((set) => ({
  announcements: [],
  calendarEvents: [],
  setAnnouncements: (announcements) => set({ announcements }),
  setCalendarEvents: (calendarEvents) => set({ calendarEvents }),
}));
