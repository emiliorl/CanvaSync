import Papa from "papaparse";
import { BimRoomRecord, SheetFetchResult } from "../types/bim";

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

export function saveRecentSpreadsheet(sheet: { id: string; title: string; url: string }): void {
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
export async function fetchUserSpreadsheets(accessToken: string): Promise<DriveSpreadsheetItem[]> {
  const q = encodeURIComponent("mimeType='application/vnd.google-apps.spreadsheet' and trashed=false");
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
export function extractSpreadsheetInfo(sheetUrl: string): { spreadsheetId: string; gid?: string } {
  const idMatch = sheetUrl.match(/\/d\/([a-zA-Z0-9-_]+)/);
  if (!idMatch || !idMatch[1]) {
    throw new Error(
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
      if (res.status === 401) throw new Error("Google session expired. Please sign in again.");
      if (res.status === 403) throw new Error("Access denied. Your Google account does not have permission to view this sheet.");
      throw new Error(`Google Sheets API error: HTTP ${res.status}`);
    }

    const data = await res.json();
    const sheets: SheetTabInfo[] = (data.sheets || []).map((s: any) => ({
      title: s.properties?.title || "Sheet1",
      sheetId: s.properties?.sheetId || 0,
    }));

    return {
      spreadsheetId,
      title: data.properties?.title || "Architectural Schedule",
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
function findRowValue(row: Record<string, any> | undefined, possibleKeys: string[]): string | undefined {
  if (!row) return undefined;
  const keys = Object.keys(row);
  for (const target of possibleKeys) {
    if (row[target] !== undefined && row[target] !== null && String(row[target]).trim() !== "") {
      return String(row[target]).trim();
    }

    const normalizedTarget = target.toLowerCase().replace(/[\s_-]+/g, "");
    const matchedKey = keys.find(
      (k) => k.toLowerCase().replace(/[\s_-]+/g, "") === normalizedTarget,
    );
    if (
      matchedKey &&
      row[matchedKey] !== undefined &&
      row[matchedKey] !== null &&
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
  const gridUrl = `https://sheets.googleapis.com/v4/spreadsheets/${spreadsheetId}?ranges=${encodeURIComponent(targetTab)}&fields=properties.title,sheets(data(rowData(values(formattedValue,userEnteredFormat(backgroundColor)))))`;

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

  // First row is headers
  const headerCells = rowDataList[0]?.values || [];
  const headers: string[] = headerCells.map((c: any) => c?.formattedValue || "");

  const records: BimRoomRecord[] = [];

  for (let r = 1; r < rowDataList.length; r++) {
    const cellValues = rowDataList[r]?.values || [];
    const rowObj: Record<string, string> = {};
    let cellBgColor: string | undefined = undefined;

    for (let c = 0; c < headers.length; c++) {
      const colName = headers[c];
      const cell = cellValues[c];
      const val = cell?.formattedValue ?? "";
      if (colName) {
        rowObj[colName] = val;
      }

      // Check if this cell has a custom background color (especially for Revit_ID column)
      if (c === 0 && cell?.userEnteredFormat?.backgroundColor) {
        const bg = cell.userEnteredFormat.backgroundColor;
        const hex = rgbToHex(bg.red, bg.green, bg.blue);
        if (hex) cellBgColor = hex;
      }
    }

    const revitId =
      findRowValue(rowObj, [
        "Revit_ID",
        "Revit ID",
        "RevitId",
        "ID",
        "Room_Number",
        "Room Number",
        "Number",
      ]) || `REV-${r}`;

    const roomName =
      findRowValue(rowObj, [
        "Room_Display",
        "Room Name",
        "Room_Name",
        "Name",
        "Space",
        "Description",
      ]) || revitId;

    const areaLabel =
      findRowValue(rowObj, [
        "Area_Label",
        "Area",
        "Area_SF",
        "Square Footage",
        "Area (SF)",
        "Size",
      ]) || "";

    const finishSpec =
      findRowValue(rowObj, [
        "Finish_Spec",
        "Finish",
        "Finishes",
        "Specification",
        "Spec",
        "Material",
        "Description",
      ]) || "No specifications recorded";

    const imageUrl =
      findRowValue(rowObj, [
        "Image_Slot",
        "Image URL",
        "Image_URL",
        "Render_URL",
        "Image",
        "Photo",
        "Render",
      ]) || "";

    const badgeColorHex =
      cellBgColor ||
      findRowValue(rowObj, [
        "Badge_Color",
        "Badge Color",
        "Color",
        "Color_Hex",
        "Hex",
      ]) ||
      (r % 2 === 0 ? "#5C9CD4" : "#5B9B42"); // Default architectural palette

    if (revitId || finishSpec !== "No specifications recorded") {
      records.push({
        revitId,
        roomName,
        areaLabel,
        finishSpec,
        imageUrl,
        badgeColorHex,
      });
    }
  }

  return {
    records,
    rawCount: records.length,
    sheetTitle: targetTab,
  };
}

/**
 * Fallback values ingestion
 */
async function fetchPrivateSheetDataFallback(
  spreadsheetId: string,
  targetTab: string,
  accessToken: string,
): Promise<SheetFetchResult> {
  const valuesUrl = `https://sheets.googleapis.com/v4/spreadsheets/${spreadsheetId}/values/${encodeURIComponent(targetTab)}`;
  const res = await fetch(valuesUrl, {
    headers: { Authorization: `Bearer ${accessToken}` },
  });

  if (!res.ok) {
    throw new Error(`Failed to load sheet tab "${targetTab}".`);
  }

  const valuesData = await res.json();
  const rawValues: string[][] = valuesData.values || [];

  if (rawValues.length === 0) {
    return { records: [], rawCount: 0, sheetTitle: targetTab };
  }

  const headers = rawValues[0] || [];
  const records: BimRoomRecord[] = [];

  for (let r = 1; r < rawValues.length; r++) {
    const row = rawValues[r] || [];
    const obj: Record<string, string> = {};
    for (let c = 0; c < headers.length; c++) {
      const h = headers[c];
      if (h) obj[h] = row[c] ?? "";
    }

    const revitId = findRowValue(obj, ["Revit_ID", "Revit ID", "ID"]) || `REV-${r}`;
    const roomName = findRowValue(obj, ["Room_Display", "Room Name", "Name"]) || revitId;
    const areaLabel = findRowValue(obj, ["Area_Label", "Area"]) || "";
    const finishSpec = findRowValue(obj, ["Finish_Spec", "Finish", "Material"]) || "";
    const imageUrl = findRowValue(obj, ["Image_Slot", "Image URL", "Image"]) || "";
    const badgeColorHex = findRowValue(obj, ["Badge_Color", "Color"]) || (r % 2 === 0 ? "#5C9CD4" : "#5B9B42");

    records.push({
      revitId,
      roomName,
      areaLabel,
      finishSpec,
      imageUrl,
      badgeColorHex,
    });
  }

  return { records, rawCount: records.length, sheetTitle: targetTab };
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
    throw new Error("Could not retrieve sheet data.");
  }

  const csvText = await response.text();
  if (csvText.trim().startsWith("<!DOCTYPE html") || csvText.includes("<html")) {
    throw new Error("This sheet is private. Please sign in with Google above to access it.");
  }

  return new Promise((resolve, reject) => {
    Papa.parse<Record<string, any>>(csvText, {
      header: true,
      skipEmptyLines: true,
      complete: (results) => {
        const records: BimRoomRecord[] = results.data.map((row, idx) => ({
          revitId: findRowValue(row, ["Revit_ID", "Revit ID", "ID"]) || `REV-${idx + 1}`,
          roomName: findRowValue(row, ["Room_Display", "Room Name", "Name"]) || `REV-${idx + 1}`,
          areaLabel: findRowValue(row, ["Area_Label", "Area"]) || "",
          finishSpec: findRowValue(row, ["Finish_Spec", "Finish", "Material"]) || "",
          imageUrl: findRowValue(row, ["Image_Slot", "Image URL", "Image"]) || "",
          badgeColorHex: findRowValue(row, ["Badge_Color", "Color"]) || (idx % 2 === 0 ? "#5C9CD4" : "#5B9B42"),
        }));
        resolve({ records, rawCount: records.length });
      },
      error: (err: any) => reject(new Error(err.message)),
    });
  });
}
