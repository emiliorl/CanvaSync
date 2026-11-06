import { defineMessage } from "react-intl";
import { LocalizedError } from "../utils/localizedError";
import {
  addElementAtPoint,
  type GroupContentAtPoint,
  type ShapeElementAtPoint,
  type TextElementAtPoint,
} from "@canva/design";
import { upload, type ImageMimeType } from "@canva/asset";
import type {
  BimRoomRecord,
  ImportLayout,
  SheetColumn,
  SheetCell,
} from "../types/bim";

function inferMimeType(url: string): ImageMimeType {
  const cleanUrl = url.split("?")[0]?.toLowerCase() || "";
  if (cleanUrl.endsWith(".png")) return "image/png";
  if (cleanUrl.endsWith(".webp")) return "image/webp";
  if (cleanUrl.endsWith(".svg")) return "image/svg+xml";
  return "image/jpeg";
}

function wrapText(text: string, maxChars: number): string[] {
  const paragraphs = (text || "-").split(/\r?\n/);
  return paragraphs.flatMap((paragraph) => {
    const lines: string[] = [];
    let line = "";
    for (const word of paragraph.trim().split(/\s+/)) {
      // Estimate wrapped lines for row sizing, including unbroken values.
      for (let offset = 0; offset < word.length; offset += maxChars) {
        const part = word.slice(offset, offset + maxChars);
        if (line && line.length + part.length + 1 > maxChars) {
          lines.push(line);
          line = "";
        }
        line = line ? `${line} ${part}` : part;
      }
    }
    return [...lines, line || "-"];
  });
}

/** Editable cell backgrounds and borders, using native Canva shapes. */
function cellShape(
  left: number,
  top: number,
  width: number,
  height: number,
  color = "#FFFFFF",
): ShapeElementAtPoint {
  return {
    type: "shape",
    left,
    top,
    width,
    height,
    viewBox: { left: 0, top: 0, width, height },
    paths: [
      {
        d: `M 0 0 H ${width} V ${height} H 0 Z`,
        fill: { color },
        stroke: { color: "#BFC4C2", weight: 1, strokeAlign: "inset" },
      },
    ],
  };
}

/** Keep the original text in a single editable text box per cell. */
function cellText(
  text: string,
  left: number,
  top: number,
  width: number,
): TextElementAtPoint {
  return {
    type: "text",
    children: [text],
    left: left + 7,
    top,
    width: width - 14,
    fontSize: 14,
    color: "#111111",
    textAlign: "start",
  };
}

export const defaultColumns: SheetColumn[] = [
  { key: "revitId", title: "Revit_ID", kind: "text" },
  { key: "imageUrl", title: "Image_Slot", kind: "image" },
  { key: "finishSpec", title: "Finish_Spec", kind: "text" },
];

export function getRecordCell(
  record: BimRoomRecord,
  column: SheetColumn,
): SheetCell {
  if (record.sourceCells)
    return record.sourceCells[column.key] || { value: "" };
  const value = record[column.key as keyof BimRoomRecord];
  return {
    value: typeof value === "string" ? value : "",
    backgroundColor:
      column.key === "revitId" ? record.badgeColorHex : undefined,
  };
}

function boundedSize(
  value: number | undefined,
  fallback: number,
  minimum: number,
): number {
  return value !== undefined && Number.isFinite(value)
    ? Math.max(minimum, Math.min(2000, value))
    : fallback;
}

/** Independent row and column sizes drive every cell, text box, and image. */
export function buildEditableSchedule(
  records: BimRoomRecord[],
  layout: ImportLayout = { columns: defaultColumns },
) {
  if (!layout.columns.length)
    throw new LocalizedError(
      defineMessage({
        defaultMessage: "Select at least one column to import.",
        description: "CanvaSync canvaCanvasService operation error",
      }),
      "Select at least one column to import.",
    );
  let width = 0;
  const columns = layout.columns.map((column) => {
    const columnWidth = boundedSize(
      layout.columnWidths?.[column.key],
      column.kind === "image"
        ? 180
        : /spec|description/i.test(column.title)
          ? 240
          : 160,
      72,
    );
    const result = { ...column, left: width, width: columnWidth };
    width += columnWidth;
    return result;
  });
  const headerHeight = 32;
  const lineHeight = 20;
  let height = headerHeight;
  const shapes: ShapeElementAtPoint[] = [];
  const texts: TextElementAtPoint[] = [];
  for (const column of columns) {
    const titleLines = wrapText(
      column.title,
      Math.max(1, Math.floor((column.width - 14) / 8)),
    );
    // Headers use their own expandable band rather than overlapping the first row.
    height = Math.max(height, titleLines.length * lineHeight + 12);
  }
  for (const column of columns) {
    shapes.push(cellShape(column.left, 0, column.width, height));
    if (column.title)
      texts.push(cellText(column.title, column.left, 6, column.width));
  }
  const imageSlots: {
    rowIndex: number;
    columnKey: string;
    value: string;
    left: number;
    top: number;
    width: number;
    height: number;
  }[] = [];
  records.forEach((record, rowIndex) => {
    const cells = columns.map((column) => {
      const cell = getRecordCell(record, column);
      const lines =
        column.kind === "text"
          ? wrapText(
              cell.value,
              Math.max(1, Math.floor((column.width - 14) / 8)),
            )
          : [];
      return { column, cell, lines };
    });
    const minHeight = boundedSize(layout.rowHeights?.[rowIndex], 96, 32);
    const rowHeight = Math.max(
      minHeight,
      ...cells.map(({ lines }) => lines.length * lineHeight + 16),
    );
    for (const { column, cell } of cells) {
      const color =
        cell.backgroundColor && /^#[0-9a-f]{6}$/i.test(cell.backgroundColor)
          ? cell.backgroundColor
          : "#FFFFFF";
      shapes.push(
        cellShape(column.left, height, column.width, rowHeight, color),
      );
      if (column.kind === "image") {
        imageSlots.push({
          rowIndex,
          columnKey: column.key,
          value: cell.value,
          left: column.left + 1,
          top: height + 1,
          width: column.width - 2,
          height: rowHeight - 2,
        });
      } else if (cell.value) {
        texts.push(cellText(cell.value, column.left, height + 8, column.width));
      }
    }
    height += rowHeight;
  });
  const children: GroupContentAtPoint[] = [...shapes, ...texts];
  return { width, height, children, imageSlots };
}

/** Insert one grouped schedule with material images inside their own row cells. */
export async function injectScheduleTable(
  records: BimRoomRecord[],
  options: { includeImages?: boolean; layout?: ImportLayout } = {},
): Promise<{ success: boolean; rowsCount: number; imagesCount: number }> {
  if (!records || records.length === 0) {
    throw new LocalizedError(
      defineMessage({
        defaultMessage: "No schedule rows to insert.",
        description: "CanvaSync canvaCanvasService operation error",
      }),
      "No schedule rows to insert.",
    );
  }
  const table = buildEditableSchedule(records, options.layout);
  const children = [...table.children];
  let imagesCount = 0;
  if (options.includeImages) {
    for (const slot of table.imageSlots) {
      const record = records[slot.rowIndex];
      if (!record || !/^https?:\/\//i.test(slot.value)) continue;
      try {
        const image = await upload({
          type: "image",
          mimeType: inferMimeType(slot.value),
          url: slot.value,
          thumbnailUrl: slot.value,
          name: `${record.revitId}_material`.slice(0, 50),
          aiDisclosure: "none",
        });
        if (image?.ref) {
          children.push({
            type: "image",
            ref: image.ref,
            left: slot.left,
            top: slot.top,
            width: slot.width,
            height: slot.height,
            altText: {
              text: `${record.revitId}: ${record.finishSpec || record.roomName}`,
              decorative: false,
            },
          });
          imagesCount++;
        }
      } catch {
        // Leave this row's image cell empty; later images retain their row positions.
      }
    }
  }
  // Insert atomically so the design team can resize the whole schedule or
  // ungroup it to edit text, colors, borders, cell geometry, and images.
  await addElementAtPoint({
    type: "group",
    children,
    top: 50,
    left: 40,
    width: table.width,
    height: table.height,
  });
  return {
    success: true,
    rowsCount: records.length,
    imagesCount,
  };
}
