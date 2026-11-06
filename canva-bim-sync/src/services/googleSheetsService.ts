import { defineMessage } from "react-intl";
import { LocalizedError } from "../utils/localizedError";
import Papa from "papaparse";
import type {
  BimRoomRecord,
  SheetFetchResult,
  SheetCell,
  SheetColumn,
} from "../types/bim";

export interface SheetTabInfo {
  title: string;
  sheetId: number;
}

export interface SpreadsheetInfo {
  spreadsheetId: string;
  title: string;
  sheets: SheetTabInfo[];
}

export interface DriveSpreadsheetItem {
  id: string;
  name: string;
  modifiedTime?: string;
}

export interface SavedSpreadsheet {
  id: string;
  title: string;
  url: string;
  lastOpened: number;
}

const RECENT_SHEETS_KEY = "canvasync_recent_sheets";

export function getRecentSpreadsheets(): SavedSpreadsheet[] {
  try {
    const raw = localStorage.getItem(RECENT_SHEETS_KEY);
    if (!raw) return [];
    return JSON.parse(raw);
  } catch {
    return [];
  }
}

export function saveRecentSpreadsheet(sheet: {
  id: string;
  title: string;
  url: string;
}): void {
  try {
    const list = getRecentSpreadsheets().filter((s) => s.id !== sheet.id);
    list.unshift({
      ...sheet,
      lastOpened: Date.now(),
    });
    localStorage.setItem(RECENT_SHEETS_KEY, JSON.stringify(list.slice(0, 15)));
  } catch {
    // Ignore localStorage errors
  }
}

/**
 * Lists spreadsheets from the user's Google Drive via the Drive API.
 */
export async function fetchUserSpreadsheets(
  accessToken: string,
): Promise<DriveSpreadsheetItem[]> {
  const q = encodeURIComponent(
    "mimeType='application/vnd.google-apps.spreadsheet' and trashed=false",
  );
  const fields = encodeURIComponent("files(id,name,modifiedTime)");
  const url = `https://www.googleapis.com/drive/v3/files?q=${q}&fields=${fields}&orderBy=modifiedTime%20desc&pageSize=30`;

  const res = await fetch(url, {
    headers: { Authorization: `Bearer ${accessToken}` },
  });

  if (!res.ok) {
    const errorBody = await res.json().catch(() => ({}));
    const errorMsg = errorBody?.error?.message || `HTTP ${res.status}`;
    throw new Error(errorMsg);
  }

  const data = await res.json();
  return (data.files || []).map((f: any) => ({
    id: f.id,
    name: f.name || "Untitled Spreadsheet",
    modifiedTime: f.modifiedTime,
  }));
}

/**
 * Parses a Google Sheets URL to extract the spreadsheet ID and optional gid.
 */
export function extractSpreadsheetInfo(sheetUrl: string): {
  spreadsheetId: string;
  gid?: string;
} {
  const idMatch = sheetUrl.match(/\/d\/([a-zA-Z0-9-_]+)/);
  if (!idMatch || !idMatch[1]) {
    throw new LocalizedError(
      defineMessage({
        defaultMessage:
          "Invalid Google Sheets URL. Please paste a valid link (e.g. https://docs.google.com/spreadsheets/d/...)",
        description: "CanvaSync googleSheetsService operation error",
      }),
      "Invalid Google Sheets URL. Please paste a valid link (e.g. https://docs.google.com/spreadsheets/d/...)",
    );
  }

  const gidMatch = sheetUrl.match(/[#&]gid=([0-9]+)/);
  return {
    spreadsheetId: idMatch[1],
    gid: gidMatch ? gidMatch[1] : undefined,
  };
}

/**
 * Converts Google Sheets RGB float values (0 to 1) to Hex format.
 */
function rgbToHex(r?: number, g?: number, b?: number): string | undefined {
  if (r === undefined && g === undefined && b === undefined) return undefined;
  // If all 1.0, it's plain white
  if (r === 1 && g === 1 && b === 1) return undefined;

  const red = Math.round((r || 0) * 255);
  const green = Math.round((g || 0) * 255);
  const blue = Math.round((b || 0) * 255);

  return (
    "#" +
    [red, green, blue]
      .map((x) => x.toString(16).padStart(2, "0"))
      .join("")
      .toUpperCase()
  );
}

/**
 * Fetches the spreadsheet title and all available sheet tabs / pages.
 */
export async function fetchSpreadsheetMetadata(
  sheetUrl: string,
  accessToken?: string | null,
): Promise<SpreadsheetInfo> {
  const { spreadsheetId } = extractSpreadsheetInfo(sheetUrl);

  if (accessToken) {
    const metaUrl = `https://sheets.googleapis.com/v4/spreadsheets/${spreadsheetId}?fields=properties.title,sheets.properties(sheetId,title)`;
    const res = await fetch(metaUrl, {
      headers: { Authorization: `Bearer ${accessToken}` },
    });

    if (!res.ok) {
      if (res.status === 401)
        throw new LocalizedError(
          defineMessage({
            defaultMessage: "Google session expired. Please sign in again.",
            description: "CanvaSync googleSheetsService operation error",
          }),
          "Google session expired. Please sign in again.",
        );
      if (res.status === 403)
        throw new LocalizedError(
          defineMessage({
            defaultMessage:
              "Access denied. Your Google account does not have permission to view this sheet.",
            description: "CanvaSync googleSheetsService operation error",
          }),
          "Access denied. Your Google account does not have permission to view this sheet.",
        );
      throw new LocalizedError(
        defineMessage({
          defaultMessage: "Google Sheets API error: HTTP {status}",
          description: "Spreadsheet API error with HTTP status",
        }),
        `Google Sheets API error: HTTP ${res.status}`,
        { status: res.status },
      );
    }

    const data = await res.json();
    const sheets: SheetTabInfo[] = (data.sheets || []).map((s: any) => ({
      title: s.properties?.title || "Sheet1",
      sheetId: s.properties?.sheetId || 0,
    }));

    return {
      spreadsheetId,
      title: data.properties?.title || "Google Spreadsheet",
      sheets,
    };
  }

  // Fallback for public sheets without token
  return {
    spreadsheetId,
    title: "Google Spreadsheet",
    sheets: [{ title: "Sheet1", sheetId: 0 }],
  };
}

/**
 * Helper to get a case-insensitive, flexible column value from a row object.
 */
function findRowValue(
  row: Record<string, any> | undefined,
  possibleKeys: string[],
): string | undefined {
  if (!row) return undefined;
  const keys = Object.keys(row);
  for (const target of possibleKeys) {
    if (
      row[target] !== undefined &&
      row[target] != null &&
      String(row[target]).trim() !== ""
    ) {
      return String(row[target]).trim();
    }

    const normalizedTarget = target.toLowerCase().replace(/[\s_-]+/g, "");
    const matchedKey = keys.find(
      (k) => k.toLowerCase().replace(/[\s_-]+/g, "") === normalizedTarget,
    );
    if (
      matchedKey &&
      row[matchedKey] !== undefined &&
      row[matchedKey] != null &&
      String(row[matchedKey]).trim() !== ""
    ) {
      return String(row[matchedKey]).trim();
    }
  }
  return undefined;
}

/**
 * Ingests data from private Google Sheets including cell background colors and long finish descriptions.
 */
export async function fetchPrivateSheetData(
  sheetUrl: string,
  accessToken: string,
  sheetName?: string,
): Promise<SheetFetchResult> {
  const { spreadsheetId } = extractSpreadsheetInfo(sheetUrl);

  // 1. Get sheets metadata if tab name not provided
  let targetTab = sheetName?.trim();
  if (!targetTab) {
    const meta = await fetchSpreadsheetMetadata(sheetUrl, accessToken);
    targetTab = meta.sheets[0]?.title || "Sheet1";
  }

  // 2. Query grid data with values and cell formats (background colors)
  const gridUrl = `https://sheets.googleapis.com/v4/spreadsheets/${spreadsheetId}?ranges=${encodeURIComponent("'" + targetTab.replace(/'/g, "''") + "'")}&fields=properties.title,sheets(data(rowData(values(formattedValue,userEnteredFormat(backgroundColor,backgroundColorStyle),effectiveFormat(backgroundColor,backgroundColorStyle)))))`;

  const res = await fetch(gridUrl, {
    headers: { Authorization: `Bearer ${accessToken}` },
  });

  if (!res.ok) {
    // Fallback to simple values endpoint if grid query fails
    return fetchPrivateSheetDataFallback(spreadsheetId, targetTab, accessToken);
  }

  const data = await res.json();
  const rowDataList = data.sheets?.[0]?.data?.[0]?.rowData || [];

  if (rowDataList.length === 0) {
    return { records: [], rawCount: 0, sheetTitle: targetTab };
  }

  const headers = (rowDataList[0]?.values || []).map(
    (cell: GridCell) => cell.formattedValue || "",
  );
  return {
    ...parseSheetRows(
      headers,
      rowDataList
        .slice(1)
        .map((row: { values?: GridCell[] }) => row.values || []),
      targetTab,
    ),
    hasCellColors: true,
  };
}

interface CellFormat {
  backgroundColor?: { red?: number; green?: number; blue?: number };
  backgroundColorStyle?: {
    rgbColor?: { red?: number; green?: number; blue?: number };
  };
}
interface GridCell {
  formattedValue?: string;
  userEnteredFormat?: CellFormat;
  effectiveFormat?: CellFormat;
}

function columnLetter(index: number): string {
  let result = "";
  for (
    let current = index + 1;
    current > 0;
    current = Math.floor((current - 1) / 26)
  ) {
    result = String.fromCharCode(65 + ((current - 1) % 26)) + result;
  }
  return result;
}

/** Preserve every source column, blank cell, and explicit cell background. */
export function parseSheetRows(
  headers: string[],
  rows: GridCell[][],
  sheetTitle?: string,
): SheetFetchResult {
  const columns: SheetColumn[] = headers.map((title, index) => ({
    key: `column_${index}`,
    title: title || columnLetter(index),
    kind: /image|photo|render|imagen|foto/i.test(title) ? "image" : "text",
  }));
  const idColumn = columns.find((column) =>
    /^(revit[ _-]?id|id)$/i.test(column.title),
  );
  const records: BimRoomRecord[] = [];
  for (const row of rows) {
    if (!row.some((cell) => cell?.formattedValue?.trim())) continue;
    const sourceCells: Record<string, SheetCell> = {};
    const values: Record<string, string> = {};
    columns.forEach((column, index) => {
      const cell = row[index];
      const format = cell?.effectiveFormat || cell?.userEnteredFormat;
      const rgb =
        format?.backgroundColorStyle?.rgbColor || format?.backgroundColor;
      const backgroundColor = rgb
        ? rgbToHex(rgb.red ?? 0, rgb.green ?? 0, rgb.blue ?? 0)
        : undefined;
      const value = cell?.formattedValue || "";
      sourceCells[column.key] = { value, backgroundColor };
      values[column.title] = value;
    });
    const revitId =
      findRowValue(values, ["Revit_ID", "Revit ID", "ID", "Number"]) || "";
    records.push({
      sourceCells,
      revitId,
      roomName:
        findRowValue(values, ["Room_Display", "Room Name", "Name", "Space"]) ||
        "",
      areaLabel: findRowValue(values, ["Area_Label", "Area"]) || "",
      finishSpec:
        findRowValue(values, [
          "Finish_Spec",
          "Finish",
          "Material",
          "Specification",
          "Description",
        ]) || "",
      imageUrl:
        findRowValue(values, ["Image_Slot", "Image URL", "Image", "Photo"]) ||
        "",
      badgeColorHex: idColumn
        ? sourceCells[idColumn.key]?.backgroundColor
        : undefined,
    });
  }
  return { records, columns, rawCount: records.length, sheetTitle };
}

/**
 * Fallback values ingestion
 */
async function fetchPrivateSheetDataFallback(
  spreadsheetId: string,
  targetTab: string,
  accessToken: string,
): Promise<SheetFetchResult> {
  const valuesUrl = `https://sheets.googleapis.com/v4/spreadsheets/${spreadsheetId}/values/${encodeURIComponent("'" + targetTab.replace(/'/g, "''") + "'")}`;
  const res = await fetch(valuesUrl, {
    headers: { Authorization: `Bearer ${accessToken}` },
  });

  if (!res.ok) {
    throw new LocalizedError(
      defineMessage({
        defaultMessage: 'Failed to load sheet tab "{tabName}".',
        description: "Could not fetch the selected spreadsheet tab",
      }),
      `Failed to load sheet tab "${targetTab}".`,
      { tabName: targetTab },
    );
  }

  const valuesData = await res.json();
  const rawValues: string[][] = valuesData.values || [];

  if (rawValues.length === 0) {
    return { records: [], rawCount: 0, sheetTitle: targetTab };
  }

  return {
    ...parseSheetRows(
      rawValues[0] || [],
      rawValues
        .slice(1)
        .map((row) => row.map((value) => ({ formattedValue: value }))),
      targetTab,
    ),
    hasCellColors: false,
  };
}

/**
 * Ingests Google Sheets data directly in the browser via public CSV export.
 */
export async function fetchSheetData(
  sheetUrl: string,
  sheetName?: string,
): Promise<SheetFetchResult> {
  const { spreadsheetId, gid } = extractSpreadsheetInfo(sheetUrl);
  let exportUrl = `https://docs.google.com/spreadsheets/d/${spreadsheetId}/gviz/tq?tqx=out:csv`;
  if (sheetName) exportUrl += `&sheet=${encodeURIComponent(sheetName)}`;
  else if (gid) exportUrl += `&gid=${gid}`;

  const response = await fetch(exportUrl);
  if (!response.ok) {
    throw new LocalizedError(
      defineMessage({
        defaultMessage: "Could not retrieve sheet data.",
        description: "CanvaSync googleSheetsService operation error",
      }),
      "Could not retrieve sheet data.",
    );
  }

  const csvText = await response.text();
  if (
    csvText.trim().startsWith("<!DOCTYPE html") ||
    csvText.includes("<html")
  ) {
    throw new LocalizedError(
      defineMessage({
        defaultMessage:
          "This sheet is private. Please sign in with Google above to access it.",
        description: "CanvaSync googleSheetsService operation error",
      }),
      "This sheet is private. Please sign in with Google above to access it.",
    );
  }

  return new Promise((resolve, reject) => {
    Papa.parse<Record<string, any>>(csvText, {
      header: true,
      skipEmptyLines: true,
      complete: (results) => {
        const headers = results.meta.fields || [];
        resolve({
          ...parseSheetRows(
            headers,
            results.data.map((row) =>
              headers.map((header) => ({
                formattedValue: String(row[header] ?? ""),
              })),
            ),
            sheetName,
          ),
          hasCellColors: false,
        });
      },
      error: (err: any) => reject(new Error(err.message)),
    });
  });
}
