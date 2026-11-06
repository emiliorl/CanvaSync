export interface BimRoomRecord {
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
  sheetTitle?: string;
  rawCount: number;
}

