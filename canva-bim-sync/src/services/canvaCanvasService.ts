import {
  addElementAtPoint,
  addElementAtCursor,
  editContent,
  type TableElement,
} from "@canva/design";
import { upload, ImageMimeType } from "@canva/asset";
import { BimRoomRecord } from "../types/bim";

/**
 * Infers image mime type from URL or defaults to image/jpeg.
 */
function inferMimeType(url: string): ImageMimeType {
  const cleanUrl = url.split("?")[0]?.toLowerCase() || "";
  if (cleanUrl.endsWith(".png")) return "image/png";
  if (cleanUrl.endsWith(".webp")) return "image/webp";
  if (cleanUrl.endsWith(".svg")) return "image/svg+xml";
  return "image/jpeg";
}

function escapeXml(unsafe: string): string {
  return unsafe
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&apos;");
}

function wrapText(text: string, maxCharsPerLine: number = 44): string[] {
  if (!text) return ["-"];
  const lines: string[] = [];
  const rawParagraphs = text.split(/\r?\n/);

  for (const para of rawParagraphs) {
    const trimmed = para.trim();
    if (!trimmed) continue;
    const words = trimmed.split(/\s+/);
    let currentLine = "";

    for (const word of words) {
      if ((currentLine + " " + word).trim().length <= maxCharsPerLine) {
        currentLine = (currentLine + " " + word).trim();
      } else {
        if (currentLine) lines.push(currentLine);
        currentLine = word;
      }
    }
    if (currentLine) lines.push(currentLine);
  }

  return lines.length > 0 ? lines : ["-"];
}

/**
 * Generates an authentic architectural finish schedule table SVG matching the PDF blueprint format:
 * - Slate gray header: COLOR | REFERENCIA | ESPECIFICACIÓN
 * - Column 1: Color swatch box matching the zone/finish
 * - Column 2: Reference Code (e.g. P-01, REV-101)
 * - Column 3: Structured multi-line finish specification
 * - Crisp architectural grid borders
 */
export function generateArchitecturalTableSvg(
  records: BimRoomRecord[],
): { dataUrl: string; width: number; height: number } {
  const tableWidth = 580;
  const colColorW = 56;
  const colRefW = 104;
  const colSpecW = tableWidth - colColorW - colRefW; // 420px

  const headerH = 34;
  let currentY = headerH;

  interface SvgRow {
    color: string;
    ref: string;
    specLines: string[];
    rowY: number;
    rowH: number;
  }

  const rows: SvgRow[] = [];

  for (const record of records) {
    const rawSpec = record.finishSpec || "Especificación estándar";
    const specLines = wrapText(rawSpec, 42);
    const rowH = Math.max(50, specLines.length * 16 + 18);

    rows.push({
      color: record.badgeColorHex || "#38BDF8",
      ref: record.revitId || "P-01",
      specLines,
      rowY: currentY,
      rowH,
    });

    currentY += rowH;
  }

  const totalHeight = currentY;

  // Build clean, compliant SVG 1.1 (no foreignObject, no scripts)
  let svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${tableWidth}" height="${totalHeight}" viewBox="0 0 ${tableWidth} ${totalHeight}">`;

  // Table Background
  svg += `<rect width="${tableWidth}" height="${totalHeight}" fill="#FFFFFF"/>`;

  // Slate Gray Header (matching blueprint schedule in PDF: #788896)
  svg += `<rect x="0" y="0" width="${tableWidth}" height="${headerH}" fill="#788896"/>`;

  // Header column titles
  svg += `<text x="28" y="22" font-family="system-ui, -apple-system, 'Segoe UI', Roboto, sans-serif" font-size="10.5" font-weight="700" fill="#FFFFFF" text-anchor="middle" letter-spacing="1">COLOR</text>`;
  svg += `<text x="${colColorW + colRefW / 2}" y="22" font-family="system-ui, -apple-system, 'Segoe UI', Roboto, sans-serif" font-size="10.5" font-weight="700" fill="#FFFFFF" text-anchor="middle" letter-spacing="1">REFERENCIA</text>`;
  svg += `<text x="${colColorW + colRefW + 14}" y="22" font-family="system-ui, -apple-system, 'Segoe UI', Roboto, sans-serif" font-size="10.5" font-weight="700" fill="#FFFFFF" letter-spacing="1">ESPECIFICACIÓN</text>`;

  // Rows
  rows.forEach((r, idx) => {
    const bg = idx % 2 === 0 ? "#FFFFFF" : "#F8FAFC";
    svg += `<rect x="0" y="${r.rowY}" width="${tableWidth}" height="${r.rowH}" fill="${bg}"/>`;

    // Color swatch box
    const swatchW = 26;
    const swatchH = 24;
    const swatchX = (colColorW - swatchW) / 2;
    const swatchY = r.rowY + (r.rowH - swatchH) / 2;
    svg += `<rect x="${swatchX}" y="${swatchY}" width="${swatchW}" height="${swatchH}" rx="2" fill="${r.color}"/>`;

    // Reference code (e.g. P-01, REV-101)
    const refX = colColorW + colRefW / 2;
    const refY = r.rowY + r.rowH / 2 + 5;
    svg += `<text x="${refX}" y="${refY}" font-family="system-ui, -apple-system, 'Segoe UI', Roboto, sans-serif" font-size="12" font-weight="700" fill="#0F172A" text-anchor="middle">${escapeXml(r.ref)}</text>`;

    // Specification lines
    const specStartX = colColorW + colRefW + 14;
    let specLineY = r.rowY + 18;

    r.specLines.forEach((line, lineIdx) => {
      const isFirst = lineIdx === 0;
      const weight = isFirst ? "700" : "400";
      const color = isFirst ? "#0F172A" : "#475569";
      svg += `<text x="${specStartX}" y="${specLineY}" font-family="system-ui, -apple-system, 'Segoe UI', Roboto, sans-serif" font-size="11" font-weight="${weight}" fill="${color}">${escapeXml(line)}</text>`;
      specLineY += 16;
    });

    // Horizontal grid line
    svg += `<line x1="0" y1="${r.rowY + r.rowH}" x2="${tableWidth}" y2="${r.rowY + r.rowH}" stroke="#CBD5E1" stroke-width="1"/>`;
  });

  // Vertical column grid lines
  svg += `<line x1="${colColorW}" y1="0" x2="${colColorW}" y2="${totalHeight}" stroke="#CBD5E1" stroke-width="1"/>`;
  svg += `<line x1="${colColorW + colRefW}" y1="0" x2="${colColorW + colRefW}" y2="${totalHeight}" stroke="#CBD5E1" stroke-width="1"/>`;

  // Outer border
  svg += `<rect x="0.5" y="0.5" width="${tableWidth - 1}" height="${totalHeight - 1}" fill="none" stroke="#94A3B8" stroke-width="1"/>`;

  svg += `</svg>`;

  const base64 = typeof window !== "undefined"
    ? window.btoa(unescape(encodeURIComponent(svg)))
    : Buffer.from(svg).toString("base64");

  return {
    dataUrl: `data:image/svg+xml;base64,${base64}`,
    width: tableWidth,
    height: totalHeight,
  };
}

/**
 * Inserts the architectural schedule table onto the presentation slide or document.
 * Creates a pixel-perfect schedule table matching the architectural finish blueprint format.
 */
export async function injectScheduleTable(
  records: BimRoomRecord[],
  options: { includeImages?: boolean } = {},
): Promise<{ success: boolean; rowsCount: number; imagesCount: number }> {
  if (!records || records.length === 0) {
    throw new Error("No schedule rows to insert.");
  }

  let imagesCount = 0;

  // 1. Generate and place the structured architectural schedule table vector
  const tableSvg = generateArchitecturalTableSvg(records);

  const uploadRes = await upload({
    type: "image",
    mimeType: "image/svg+xml",
    url: tableSvg.dataUrl,
    thumbnailUrl: tableSvg.dataUrl,
    name: "Tabla_Acabados.svg",
    aiDisclosure: "none",
  });

  if (uploadRes?.ref) {
    try {
      await addElementAtPoint({
        type: "image",
        ref: uploadRes.ref,
        top: 50,
        left: 40,
        width: tableSvg.width,
        height: tableSvg.height,
        altText: { text: "Tabla de Acabados y Especificaciones", decorative: false },
      });
    } catch {
      // Fallback for responsive pages/docs
      await addElementAtCursor({
        type: "image",
        ref: uploadRes.ref,
        altText: { text: "Tabla de Acabados y Especificaciones", decorative: false },
      });
    }
  }

  // 2. Companion material images if requested
  if (options.includeImages) {
    let imgY = 50;
    for (const room of records.slice(0, 3)) {
      if (room.imageUrl && room.imageUrl.startsWith("http")) {
        try {
          const mimeType = inferMimeType(room.imageUrl);
          const imgUploadRes = await upload({
            type: "image",
            mimeType,
            url: room.imageUrl,
            thumbnailUrl: room.imageUrl,
            aiDisclosure: "none",
            name: `${room.revitId}_material`.slice(0, 50),
          });

          if (imgUploadRes?.ref) {
            try {
              await addElementAtPoint({
                type: "image",
                ref: imgUploadRes.ref,
                top: imgY,
                left: 640,
                width: 140,
                height: 100,
                altText: { text: `${room.roomName} Material`, decorative: false },
              });
            } catch {
              await addElementAtCursor({
                type: "image",
                ref: imgUploadRes.ref,
                altText: { text: `${room.roomName} Material`, decorative: false },
              });
            }
            imgY += 115;
            imagesCount++;
          }
        } catch {
          // Continue if single image upload fails
        }
      }
    }
  }

  return { success: true, rowsCount: records.length, imagesCount };
}

/**
 * Safely updates slide content.
 */
export async function syncRoomElementsInPlace(
  records: BimRoomRecord[],
): Promise<{ updatedCount: number }> {
  let updatedCount = 0;

  try {
    await editContent(
      { contentType: "richtext", target: "current_page" },
      async (session) => {
        const contents = session.contents;
        if (!contents || contents.length === 0) return;

        for (const room of records) {
          const newSpecText = room.finishSpec || "Standard Finish";

          for (const range of contents) {
            if (range.deleted) continue;
            const currentText = range.readPlaintext();
            if (!currentText || currentText.trim().length === 0) continue;

            const isSpecBlock =
              currentText.includes("Finish:") ||
              currentText.includes("Especificación") ||
              (room.finishSpec && currentText.includes(room.finishSpec.slice(0, 20)));

            if (isSpecBlock) {
              range.replaceText(
                { index: 0, length: currentText.length },
                newSpecText,
              );
              updatedCount++;
            }
          }
        }

        if (updatedCount > 0) {
          await session.sync();
        }
      },
    );
  } catch (err: any) {
    console.info("In-place slide text update skipped:", err?.message || err);
  }

  return { updatedCount };
}
