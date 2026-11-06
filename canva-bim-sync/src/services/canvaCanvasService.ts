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

/**
 * Places schedule rows on absolute presentation slides (like 800x600 or 1920x1080)
 * where cursor-based table streams are not supported.
 */
async function injectPresentationSchedule(
  records: BimRoomRecord[],
  options: { includeImages?: boolean } = {},
): Promise<number> {
  const startX = 60;
  let currentY = 50;

  // 1. Header banner
  const headerElement = {
    type: "text" as const,
    children: ["Material & Finish Schedule"],
    top: currentY,
    left: startX,
    width: 680,
    fontSize: 22,
    fontWeight: "bold" as const,
    color: "#0F172A",
  };

  try {
    await addElementAtPoint(headerElement);
  } catch {
    // If addElementAtPoint fails, ignore
  }

  currentY += 45;

  // 2. Schedule rows
  for (const room of records) {
    const rowTitle = `${room.revitId}  •  ${room.roomName}${room.areaLabel ? ` (${room.areaLabel})` : ""}`;
    const rowSpec = room.finishSpec || "Standard Specification";

    const rowElement = {
      type: "text" as const,
      children: [`${rowTitle}\n${rowSpec}`],
      top: currentY,
      left: startX,
      width: options.includeImages ? 440 : 680,
      fontSize: 13,
      color: "#1E293B",
    };

    try {
      await addElementAtPoint(rowElement);
    } catch {
      // Continue
    }

    currentY += 65;
  }

  // 3. Companion material/texture images if present
  let imagesCount = 0;
  if (options.includeImages) {
    let imgY = 95;
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
            name: `${room.revitId}_material`.slice(0, 50),
          });

          if (uploadRes?.ref) {
            await addElementAtPoint({
              type: "image",
              ref: uploadRes.ref,
              altText: { text: `${room.roomName} Material`, decorative: false },
              top: imgY,
              left: 520,
              width: 220,
              height: 140,
            });
            imgY += 155;
            imagesCount++;
          }
        } catch {
          // Continue if individual image fails
        }
      }
    }
  }

  return imagesCount;
}

/**
 * Inserts the complete schedule table (headers + all rows) onto the slide.
 * Automatically adapts between responsive docs (native table) and presentation slides.
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

  let imagesCount = 0;

  try {
    // Attempt native table insertion (supported on responsive doc contexts)
    await addElementAtCursor(tableElement);

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
              name: `${room.revitId}_material`.slice(0, 50),
            });
            if (uploadRes?.ref) {
              await addElementAtCursor({
                type: "image",
                ref: uploadRes.ref,
                altText: { text: `${room.roomName} Material`, decorative: false },
              });
              imagesCount++;
            }
          } catch {
            // Continue
          }
        }
      }
    }
  } catch (err: any) {
    const msg = err?.message || String(err);
    if (msg.includes("unsupported_page_type") || msg.includes("not supported in this context")) {
      // Fallback for absolute presentation pages (e.g. 800x600, 1920x1080)
      imagesCount = await injectPresentationSchedule(records, options);
    } else {
      throw err;
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

            // Match specification text or room name
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
    // Gracefully handle unsupported_page_type on non-richtext page contexts
    console.info("In-place slide text update skipped:", err?.message || err);
  }

  return { updatedCount };
}
