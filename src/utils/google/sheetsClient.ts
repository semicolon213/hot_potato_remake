/**
 * @file sheetsClient.ts
 * @brief Google Sheets 값 읽기·쓰기 공용 함수
 * @details window.gapi.client(앱이 토큰을 넣어 둔 클라이언트)로 Sheets API를 직접 호출합니다.
 */

type Call<R = unknown> = (params: Record<string, unknown>) => Promise<{ result: R }>;

interface SheetsApi {
  spreadsheets: {
    values: {
      get: Call<{ range: string; values?: string[][] }>;
      append: Call;
      update: Call;
    };
    batchUpdate: Call;
  };
}

const sheets = (): SheetsApi => {
  const client = window.gapi?.client as unknown as { sheets?: SheetsApi } | undefined;
  if (!client?.sheets) {
    throw new Error('Google Sheets API가 초기화되지 않았습니다.');
  }
  return client.sheets;
};

export interface SheetData {
  range: string;
  values: string[][];
}

/** 범위의 값을 읽습니다. range는 'Sheet1' 또는 'Sheet1!A1:D' 형식입니다. */
export const getSheetData = async (spreadsheetId: string, range: string): Promise<SheetData> => {
  const response = await sheets().spreadsheets.values.get({ spreadsheetId, range });
  return {
    range: response.result.range,
    values: response.result.values || []
  };
};

/** 시트 끝에 행을 추가합니다. */
export const append = async (spreadsheetId: string, sheetName: string, values: unknown[][]): Promise<void> => {
  await sheets().spreadsheets.values.append({
    spreadsheetId,
    range: `${sheetName}!A1`,
    valueInputOption: 'RAW',
    resource: { values }
  });
};

/** 헤더 이름을 키로 한 객체 한 개를 헤더 순서대로 행으로 추가합니다. 없는 열은 빈 값입니다. */
export const appendRow = async (
  spreadsheetId: string,
  sheetName: string,
  rowData: Record<string, unknown>
): Promise<void> => {
  const { values } = await getSheetData(spreadsheetId, `${sheetName}!1:1`);
  const headers = values[0] || [];
  const row = headers.map((header) => (rowData[header] !== undefined ? String(rowData[header]) : ''));
  await append(spreadsheetId, sheetName, [row]);
};

/** 범위의 값을 덮어씁니다. range는 시트 이름을 뺀 'A2:D2' 형식입니다. */
export const update = async (
  spreadsheetId: string,
  sheetName: string,
  range: string,
  values: unknown[][]
): Promise<void> => {
  await sheets().spreadsheets.values.update({
    spreadsheetId,
    range: `${sheetName}!${range}`,
    valueInputOption: 'RAW',
    resource: { values }
  });
};

/** 시트 ID(gid)의 0부터 시작하는 행 하나를 삭제합니다. */
export const deleteRow = async (spreadsheetId: string, sheetId: number, rowIndex: number): Promise<void> => {
  await sheets().spreadsheets.batchUpdate({
    spreadsheetId,
    resource: {
      requests: [{
        deleteDimension: {
          range: { sheetId, dimension: 'ROWS', startIndex: rowIndex, endIndex: rowIndex + 1 }
        }
      }]
    }
  });
};
