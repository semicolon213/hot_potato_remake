/**
 * @file spreadsheetManager.ts
 * @brief Google Sheets API 관리 유틸리티
 * @details Google Sheets와의 모든 상호작용을 담당하는 중앙화된 유틸리티 모듈입니다.
 * @author Hot Potato Team
 * @date 2024
 */

import { appendRow } from 'papyrus-db';
import { updateSheetCell } from './googleSheetUtils';
import { findSpreadsheetById as findSpreadsheetByIdInRoot } from '../database/papyrusManager';
import type { Post, Event, DateRange, CustomPeriod, Student, Staff } from '../../types/app';
import type { Template } from '../../hooks/features/templates/useTemplateUI';

/**
 * @brief 스프레드시트 ID 찾기 (드라이브 루트의 프로젝트 루트 폴더 하위에서만 검색)
 * @details papyrusManager 구현을 재사용합니다.
 */
export const findSpreadsheetById = findSpreadsheetByIdInRoot;

// 게시글 관련 함수들
export const fetchPosts = async (boardSpreadsheetId: string, boardSheetName: string): Promise<Post[]> => {
    try {
        const response = await window.gapi.client.sheets.spreadsheets.values.get({
            spreadsheetId: boardSpreadsheetId,
            range: `${boardSheetName}!A:E`,
        });

        const data = response.result.values;
        if (data && data.length > 1) {
            const parsedPosts: Post[] = data.slice(1).map((row: string[]) => ({
                id: row[0],
                author: row[1],
                title: row[2],
                contentPreview: row[3],
                date: new Date().toISOString().slice(0, 10),
                views: 0,
                likes: 0,
            })).reverse();
            return parsedPosts;
        }
        return [];
    } catch (error) {
        console.error('Error fetching posts from Google Sheet:', error);
        return [];
    }
};

export const addPost = async (
    boardSpreadsheetId: string, 
    boardSheetName: string, 
    postData: Omit<Post, 'id' | 'date' | 'views' | 'likes'>
): Promise<void> => {
    try {
        const response = await window.gapi.client.sheets.spreadsheets.values.get({
            spreadsheetId: boardSpreadsheetId,
            range: `${boardSheetName}!A:A`,
        });

        const lastRow = response.result.values ? response.result.values.length : 0;
        const newPostId = `fb-${lastRow + 1}`;

        const newPostForSheet = {
            'no_freeBoard': newPostId,
            'writer_freeBoard': postData.author,
            'title_freeBoard': postData.title,
            'content_freeBoard': postData.contentPreview,
            'file_freeBoard': '',
        };

        await appendRow(boardSpreadsheetId, boardSheetName, newPostForSheet);
        console.log('게시글이 성공적으로 저장되었습니다.');
    } catch (error) {
        console.error('Error saving post to Google Sheet:', error);
        throw error;
    }
};

// 공지사항 관련 함수들
export const fetchAnnouncements = async (announcementSpreadsheetId: string, announcementSheetName: string): Promise<Post[]> => {
    try {
        const response = await window.gapi.client.sheets.spreadsheets.values.get({
            spreadsheetId: announcementSpreadsheetId,
            range: `${announcementSheetName}!A:H`,
        });

        const data = response.result.values;
        if (data && data.length > 1) {
            const parsedAnnouncements: Post[] = data.slice(1).map((row: string[]) => ({
                id: row[0] || '',
                author: row[1] || '',
                writer_id: row[2] || '',
                title: row[3] || '',
                content: row[4] || '',
                date: row[5] || new Date().toISOString().slice(0, 10),
                views: parseInt(row[6] || '0', 10),
                likes: 0,
            })).reverse();
            return parsedAnnouncements;
        }
        return [];
    } catch (error) {
        console.error('Error fetching announcements from Google Sheet:', error);
        return [];
    }
};

export const addAnnouncement = async (
    announcementSpreadsheetId: string, 
    announcementSheetName: string, 
    postData: Omit<Post, 'id' | 'date' | 'views' | 'likes'>
): Promise<void> => {
    try {
        const response = await window.gapi.client.sheets.spreadsheets.values.get({
            spreadsheetId: announcementSpreadsheetId,
            range: `${announcementSheetName}!A:A`,
        });

        const lastRow = response.result.values ? response.result.values.length : 0;
        const newPostId = `${lastRow + 1}`;

        const newPostForSheet = {
            'no_notice': newPostId,
            'writer_notice': postData.author,
            'writer_id': postData.writer_id,
            'title_notice': postData.title,
            'content_notice': postData.content,
            'date': new Date().toISOString().slice(0, 10),
            'view_count': 0,
            'file_notice': ''
        };

        await appendRow(announcementSpreadsheetId, announcementSheetName, newPostForSheet);
        console.log('공지사항이 성공적으로 저장되었습니다.');
    } catch (error) {
        console.error('Error saving announcement to Google Sheet:', error);
        throw error;
    }
};

export const incrementViewCount = async (announcementSpreadsheetId: string, announcementSheetName: string, announcementId: string): Promise<void> => {
  try {
    const data = await window.gapi.client.sheets.spreadsheets.values.get({
        spreadsheetId: announcementSpreadsheetId,
        range: `${announcementSheetName}!A:H`,
    });

    if (!data || !data.result.values) {
      throw new Error('Could not get sheet data');
    }

    const rowIndex = data.result.values.findIndex(row => row[0] === announcementId);
    if (rowIndex === -1) {
      console.log(`Announcement with ID ${announcementId} not found in sheet. It might be a new post.`);
      return;
    }
    
    const sheetRowIndex = rowIndex + 1;

    const currentViews = parseInt(data.result.values[rowIndex][6] || '0', 10);
    const newViews = currentViews + 1;

    await window.gapi.client.sheets.spreadsheets.values.update({
        spreadsheetId: announcementSpreadsheetId,
        range: `${announcementSheetName}!G${sheetRowIndex}`,
        valueInputOption: 'RAW',
        resource: {
            values: [[newViews]]
        }
    });

    console.log(`View count for announcement ${announcementId} updated to ${newViews}`);
  } catch (error) {
    console.error('Error incrementing view count:', error);
  }
};

// 템플릿/태그 관련 함수들 (document_template 시트 방식 제거됨 - 폴더 기반만 사용)
/** @deprecated document_template 시트 방식 제거됨. */
export const fetchTemplates = async (_hotPotatoDBSpreadsheetId: string): Promise<Template[]> => [];

/** @deprecated document_template 시트 방식 제거됨. personalTagManager 사용. */
export const fetchTags = async (_hotPotatoDBSpreadsheetId: string): Promise<string[]> => [];

/** @deprecated document_template 시트 방식 제거됨. */
export const addTemplate = async (
    _hotPotatoDBSpreadsheetId: string,
    _newDocData: { title: string; description: string; tag: string; }
): Promise<void> => {};

/** @deprecated document_template 시트 방식 제거됨. */
export const deleteTemplate = async (
    _hotPotatoDBSpreadsheetId: string,
    _documentTemplateSheetId: number,
    _rowIndex: number
): Promise<void> => {};

/** @deprecated document_template 시트 방식 제거됨. */
export const updateTemplate = async (
    _hotPotatoDBSpreadsheetId: string,
    _rowIndex: number,
    _newDocData: { title: string; description: string; tag: string; },
    _documentId: string
): Promise<void> => {};

/** @deprecated document_template 시트 방식 제거됨. */
export const updateTemplateFavorite = async (
    _hotPotatoDBSpreadsheetId: string,
    _rowIndex: number,
    _favoriteStatus: string | undefined
): Promise<void> => {};

// 캘린더 관련 함수들
export const fetchCalendarEvents = async (
    calendarProfessorSpreadsheetId: string | null,
    calendarStudentSpreadsheetId: string | null,
    calendarSheetName: string
): Promise<Event[]> => {
    const spreadsheetIds = [calendarProfessorSpreadsheetId, calendarStudentSpreadsheetId].filter(Boolean) as string[];
    if (spreadsheetIds.length === 0) {
        console.log('No calendar spreadsheet IDs available');
        return [];
    }

    try {
        const allEventsPromises = spreadsheetIds.map(async (spreadsheetId) => {
            try {
                console.log(`Fetching calendar events from spreadsheet: ${spreadsheetId}`);
                
                // 먼저 시트가 존재하는지 확인
                const sheetResponse = await window.gapi.client.sheets.spreadsheets.get({
                    spreadsheetId: spreadsheetId,
                    ranges: [calendarSheetName]
                });
                
                if (!sheetResponse.result.sheets || sheetResponse.result.sheets.length === 0) {
                    console.log(`Sheet '${calendarSheetName}' not found in spreadsheet ${spreadsheetId}`);
                    return [];
                }

                // 데이터가 있는지 확인하기 위해 작은 범위부터 시도
                const response = await window.gapi.client.sheets.spreadsheets.values.get({
                    spreadsheetId: spreadsheetId,
                    range: `${calendarSheetName}!A1:I1`, // 헤더만 먼저 확인
                });
                
                const headerData = response.result.values;
                if (!headerData || headerData.length === 0) {
                    console.log(`No data found in sheet '${calendarSheetName}' of spreadsheet ${spreadsheetId}`);
                    return [];
                }

                // 전체 데이터 가져오기
                const fullResponse = await window.gapi.client.sheets.spreadsheets.values.get({
                    spreadsheetId: spreadsheetId,
                    range: `${calendarSheetName}!A:K`,
                });
                
                const data = fullResponse.result.values;
                if (data && data.length > 1) {
                    return data.slice(1).map((row: string[], index: number) => {
                        const startDate = row[2] || '';
                        const endDate = row[3] || '';
                        const startDateTime = row[6] || '';

                        return {
                            id: `${spreadsheetId}-${row[0] || index}`,
                            title: row[1] || '',
                            startDate: startDate,
                            endDate: endDate,
                            description: row[4] || '',
                            colorId: row[5] || '',
                            startDateTime: startDateTime,
                            endDateTime: row[7] || '',
                            type: row[8] || '',
                            rrule: row[9] || '',
                            attendees: row[10] || '',
                        };
                    });
                }
                return [];
            } catch (sheetError) {
                console.error(`Error fetching from spreadsheet ${spreadsheetId}:`, sheetError);
                return [];
            }
        });

        const results = await Promise.all(allEventsPromises);
        const allEvents = results.flat().filter(Boolean);

        const uniqueEvents = allEvents.filter((event, index, self) =>
            index === self.findIndex((e) => e.id === event.id)
        );

        console.log('Loaded calendar events:', uniqueEvents);
        return uniqueEvents;
    } catch (error) {
        console.error('Error fetching calendar events from Google Sheet:', error);
        return [];
    }
};

export const addCalendarEvent = async (
    targetSpreadsheetId: string,
    calendarSheetName: string,
    eventData: Omit<Event, 'id'>
): Promise<void> => {
    try {
        const response = await window.gapi.client.sheets.spreadsheets.values.get({
            spreadsheetId: targetSpreadsheetId,
            range: `${calendarSheetName}!A:A`,
        });

        const lastRow = response.result.values ? response.result.values.length : 0;
        const newEventId = `cal-${lastRow + 1}`;

        const newEventForSheet = {
            'id_calendar': newEventId,
            'title_calendar': eventData.title,
            'start_date': eventData.startDate,
            'end_date': eventData.endDate,
            'description_calendar': eventData.description || ' ',
            'colorId_calendar': eventData.color || '',
            'start_date_time': eventData.startDateTime,
            'end_date_time': eventData.endDateTime,
            'tag_calendar': eventData.type || '',
            'recurrence_rule_calendar': eventData.rrule || '',
            'attendees_calendar': eventData.attendees || ''
        };

        await appendRow(targetSpreadsheetId, calendarSheetName, newEventForSheet);
        console.log('일정이 성공적으로 추가되었습니다.');
    } catch (error) {
        console.error('Error saving calendar event to Google Sheet:', error);
        throw error;
    }
};

export const updateCalendarEvent = async (
    spreadsheetId: string,
    sheetName: string,
    eventId: string,
    eventData: Omit<Event, 'id'>
): Promise<void> => {
    try {
        // 1. Find the row index for the eventId
        const idColumnRange = `${sheetName}!A:A`;
        const response = await window.gapi.client.sheets.spreadsheets.values.get({
            spreadsheetId: spreadsheetId,
            range: idColumnRange,
        });

        const ids = response.result.values;
        if (!ids) {
            throw new Error(`Could not find any IDs in sheet ${sheetName}.`);
        }

        const sheetEventId = eventId.substring(spreadsheetId.length + 1);
        let rowIndex = ids.findIndex((row: string[]) => row[0] === sheetEventId);

        // Fallback for older ID format that might not be composite
        if (rowIndex === -1) {
            rowIndex = ids.findIndex((row: string[]) => row[0] === eventId);
        }

        if (rowIndex === -1) {
            throw new Error(`Event with ID ${eventId} (or derived ID ${sheetEventId}) not found in sheet.`);
        }
        
        const targetRow = rowIndex + 1;

        const finalSheetEventId = ids[rowIndex][0];

        // 2. Prepare the new row data in the correct order
        const newRowData = [
            finalSheetEventId, // A: id
            eventData.title, // B: title
            eventData.startDate, // C: startDate
            eventData.endDate, // D: endDate
            eventData.description || ' ', // E: description
            eventData.color || '', // F: color
            eventData.startDateTime || '', // G: startDateTime
            eventData.endDateTime || '', // H: endDateTime
            eventData.type || '', // I: type
            eventData.rrule || '', // J: rrule
            eventData.attendees || '' // K: attendees
        ];

        // 3. Update the row
        const updateRange = `${sheetName}!A${targetRow}:K${targetRow}`;
        await window.gapi.client.sheets.spreadsheets.values.update({
            spreadsheetId: spreadsheetId,
            range: updateRange,
            valueInputOption: 'RAW',
            resource: {
                values: [newRowData],
            },
        });

        console.log(`Event ${finalSheetEventId} updated successfully in row ${targetRow}.`);

    } catch (error) {
        console.error('Error updating calendar event in Google Sheet:', error);
        throw error;
    }
};

export const fetchStudents = async (spreadsheetId: string, sheetName: string): Promise<Student[]> => {
    try {
        const response = await window.gapi.client.sheets.spreadsheets.values.get({
            spreadsheetId: spreadsheetId,
            range: `${sheetName}!A:G`,
        });

        const data = response.result.values;
        if (data && data.length > 1) {
            const students: Student[] = data.slice(1).map((row: string[]) => ({
                no: row[0] || '',
                name: row[1] || '',
                address: row[2] || '',
                phone_num: row[3] || '',
                grade: row[4] || '',
                state: row[5] || '',
                council: row[6] || '',
            }));
            return students;
        }
        return [];
    } catch (error) {
        console.error('Error fetching students from Google Sheet:', error);
        return [];
    }
};

export const fetchStaff = async (spreadsheetId: string, sheetName: string): Promise<Staff[]> => {
    try {
        const response = await window.gapi.client.sheets.spreadsheets.values.get({
            spreadsheetId: spreadsheetId,
            range: `${sheetName}!A:H`,
        });

        const data = response.result.values;
        if (data && data.length > 1) {
            const staff: Staff[] = data.slice(1).map((row: string[]) => ({
                no: row[0] || '',
                pos: row[1] || '',
                name: row[2] || '',
                tel: row[3] || '',
                phone: row[4] || '',
                email: row[5] || '',
                date: row[6] || '',
                note: row[7] || '',
            }));
            return staff;
        }
        return [];
    } catch (error) {
        console.error('Error fetching staff from Google Sheet:', error);
        return [];
    }
};

// 학사일정 저장 함수
export const saveAcademicScheduleToSheet = async (
    calendarStudentSpreadsheetId: string,
    calendarSheetName: string,
    scheduleData: {
        semesterStartDate: Date;
        finalExamsPeriod: DateRange;
        midtermExamsPeriod: DateRange;
        gradeEntryPeriod: DateRange;
        customPeriods: CustomPeriod[];
    }
): Promise<void> => {
    const { semesterStartDate, finalExamsPeriod, midtermExamsPeriod, gradeEntryPeriod, customPeriods } = scheduleData;

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

    // Helper for inclusive date calculation, as per user preference
    const addInclusiveDays = (startDate: Date, days: number) => {
        const newDate = new Date(startDate);
        newDate.setDate(newDate.getDate() + days - 1);
        return newDate;
    };

    const eventsToSave: Array<{ title: string; startDate: string; endDate: string; type?: string }> = [];

    // 개강일
    eventsToSave.push({ title: '개강일', startDate: formatDate(semesterStartDate), endDate: formatDate(semesterStartDate) });

    // 수업일수 events
    const classDay30 = addInclusiveDays(semesterStartDate, 30);
    const classDay60 = addInclusiveDays(semesterStartDate, 60);
    const classDay90 = addInclusiveDays(semesterStartDate, 90);
    eventsToSave.push({ title: '수업일수 30일', startDate: formatDate(classDay30), endDate: formatDate(classDay30) });
    eventsToSave.push({ title: '수업일수 60일', startDate: formatDate(classDay60), endDate: formatDate(classDay60) });
    eventsToSave.push({ title: '수업일수 90일', startDate: formatDate(classDay90), endDate: formatDate(classDay90) });

    // 중간고사
    if (midtermExamsPeriod.start && midtermExamsPeriod.end) {
        eventsToSave.push({ title: '중간고사', startDate: formatDate(midtermExamsPeriod.start), endDate: formatDate(midtermExamsPeriod.end), type: 'exam' });
    }

    // 기말고사
    if (finalExamsPeriod.start && finalExamsPeriod.end) {
        eventsToSave.push({ title: '기말고사', startDate: formatDate(finalExamsPeriod.start), endDate: formatDate(finalExamsPeriod.end), type: 'exam' });
    }

    // 성적입력 및 강의평가
    if (gradeEntryPeriod.start && gradeEntryPeriod.end) {
        eventsToSave.push({ title: '성적입력 및 강의평가', startDate: formatDate(gradeEntryPeriod.start), endDate: formatDate(gradeEntryPeriod.end) });
    }

    // Custom periods
    customPeriods.forEach(p => {
        if (p.period.start && p.period.end) {
            eventsToSave.push({ title: p.name, startDate: formatDate(p.period.start), endDate: formatDate(p.period.end) });
        }
    });

    const values = eventsToSave.map((event, index) => [
        `acad-${index + 1}`,
        event.title,
        event.startDate,
        event.endDate,
        '', // description
        '', // colorId
        '', // startDateTime
        '', // endDateTime
        tagLabels[event.type] || event.type || '', // Column I for type
    ]);

    try {
        // Clear existing academic events (e.g., rows A2:I100)
        await window.gapi.client.sheets.spreadsheets.values.clear({
            spreadsheetId: calendarStudentSpreadsheetId,
            range: `${calendarSheetName}!A2:I100`, // Assuming academic events are within this range
        });

        // Append new events
        await window.gapi.client.sheets.spreadsheets.values.append({
            spreadsheetId: calendarStudentSpreadsheetId,
            range: `${calendarSheetName}!A2`,
            valueInputOption: 'RAW',
            insertDataOption: 'INSERT_ROWS',
            resource: {
                values: values,
            },
        });

        console.log('학사일정이 성공적으로 저장되었습니다.');
    } catch (error) {
        console.error('Error saving academic schedule to Google Sheet:', error);
        throw error;
    }
};

// 태그 관련 함수들 (document_template 시트 방식 제거됨 - personalTagManager 사용)
/** @deprecated document_template 시트 방식 제거됨. personalTagManager.addTag 사용. */
export const addTag = async (_hotPotatoDBSpreadsheetId: string, _newTag: string): Promise<void> => {};

/** @deprecated document_template 시트 방식 제거됨. personalTagManager.deleteTag 사용. */
export const deleteTag = async (
    _hotPotatoDBSpreadsheetId: string,
    _documentTemplateSheetId: number,
    _tagToDelete: string
): Promise<void> => {};

/** @deprecated document_template 시트 방식 제거됨. personalTagManager.updateTag 사용. */
export const updateTag = async (
    _hotPotatoDBSpreadsheetId: string,
    _documentTemplateSheetId: number,
    _oldTag: string,
    _newTag: string
): Promise<void> => {};
