import {
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

/**
 * Inserts the complete architectural schedule table (headers + all rows) onto the slide.
 * Cell colors from Revit/Google Sheets are preserved in the Revit_ID column.
 */
export async function injectScheduleTable(
  records: BimRoomRecord[],
  options: { includeImages?: boolean } = {},
): Promise<{ success: boolean; rowsCount: number; imagesCount: number }> {
  if (!records || records.length === 0) {
    throw new Error("No schedule rows to insert.");
  }

  // 1. Build table rows (Header + each room row)
  const headerRow = {
    cells: [
      {
        type: "string" as const,
        value: "Revit_ID",
        attributes: {
          backgroundColor: "#1E293B",
          fontWeight: "bold" as const,
          color: "#FFFFFF",
        },
      },
      {
        type: "string" as const,
        value: "Room / Space",
        attributes: {
          backgroundColor: "#1E293B",
          fontWeight: "bold" as const,
          color: "#FFFFFF",
        },
      },
      {
        type: "string" as const,
        value: "Area",
        attributes: {
          backgroundColor: "#1E293B",
          fontWeight: "bold" as const,
          color: "#FFFFFF",
        },
      },
      {
        type: "string" as const,
        value: "Finish & Material Specification",
        attributes: {
          backgroundColor: "#1E293B",
          fontWeight: "bold" as const,
          color: "#FFFFFF",
        },
      },
    ],
  };

  const dataRows = records.map((room) => ({
    cells: [
      {
        type: "string" as const,
        value: room.revitId || "REV",
        attributes: {
          backgroundColor: room.badgeColorHex || "#334155",
          fontWeight: "bold" as const,
          color: "#FFFFFF",
        },
      },
      {
        type: "string" as const,
        value: room.roomName || "Space",
        attributes: {
          backgroundColor: "#F8FAFC",
          fontWeight: "normal" as const,
          color: "#0F172A",
        },
      },
      {
        type: "string" as const,
        value: room.areaLabel || "-",
        attributes: {
          backgroundColor: "#FFFFFF",
          fontWeight: "normal" as const,
          color: "#475569",
        },
      },
      {
        type: "string" as const,
        value: room.finishSpec || "Standard Specification",
        attributes: {
          backgroundColor: "#FFFFFF",
          fontWeight: "normal" as const,
          color: "#0F172A",
        },
      },
    ],
  }));

  const tableElement: TableElement = {
    type: "table",
    rows: [headerRow, ...dataRows],
  };

  await addElementAtCursor(tableElement);

  // 2. Upload and place companion render images if requested
  let imagesCount = 0;
  if (options.includeImages) {
    for (const room of records.slice(0, 3)) {
      if (room.imageUrl && room.imageUrl.startsWith("http")) {
        try {
          const mimeType = inferMimeType(room.imageUrl);
          const uploadRes = await upload({
            type: "image",
            mimeType,
            url: room.imageUrl,
            thumbnailUrl: room.imageUrl,
            aiDisclosure: "none",
            name: `${room.revitId}_render`.slice(0, 50),
          });
          if (uploadRes?.ref) {
            await addElementAtCursor({
              type: "image",
              ref: uploadRes.ref,
              altText: { text: `${room.roomName} Render`, decorative: false },
            });
            imagesCount++;
          }
        } catch {
          // Continue if individual image fails
        }
      }
    }
  }

  return { success: true, rowsCount: records.length, imagesCount };
}

/**
 * Safely updates text elements in-place on the active slide.
 * Handles Canva page type restrictions gracefully without throwing Dev Toolkit warnings.
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

            // Match specification text
            const isSpecBlock =
              currentText.includes("Finish:") ||
              currentText.includes("Finish_Spec") ||
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
    // Gracefully handle unsupported_page_type or non-richtext page contexts
    console.info("In-place slide text update skipped:", err?.message || err);
  }

  return { updatedCount };
}
