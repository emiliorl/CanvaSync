export interface BimRoomRecord {
  sourceCells?: Record<string, SheetCell>;
  revitId: string;
  roomName: string;
  areaLabel: string;
  finishSpec: string;
  imageUrl: string;
  badgeColorHex?: string; // Optional hex color assigned in Sheets (e.g. #2D3748)
  level?: string;
  department?: string;
  status?: string;
}

export interface SheetFetchResult {
  records: BimRoomRecord[];
  columns?: SheetColumn[];
  sheetTitle?: string;
  rawCount: number;
  hasCellColors?: boolean;
}

export interface SheetCell {
  value: string;
  backgroundColor?: string;
}

export interface SheetColumn {
  key: string;
  title: string;
  kind: "text" | "image";
}

export interface ImportLayout {
  columns: SheetColumn[];
  columnWidths?: Record<string, number>;
  rowHeights?: Record<number, number>;
}
