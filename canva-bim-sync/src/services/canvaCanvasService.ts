import {
  addElementAtPoint,
  addElementAtCursor,
  editContent,
  getCurrentPageMetadata,
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
 * Options to configure element placement on the canvas.
 */
export interface InjectionOptions {
  offsetX?: number;
  offsetY?: number;
  includeImage?: boolean;
  layoutMode?: "table" | "card";
}

/**
 * Inserts architectural data onto the active Canva slide.
 * Supports both Table layout (matches interior spec sheets) and Card layout.
 */
export async function injectRoomElements(
  room: BimRoomRecord,
  options: InjectionOptions = {},
): Promise<{ success: boolean; imageUploaded: boolean }> {
  const startX = options.offsetX ?? 80;
  let currentY = options.offsetY ?? 80;

  // 1. Upload external 3D render asset into Canva session if present
  let imageAssetRef: any = null;
  let imageUploaded = false;

  if (options.includeImage !== false && room.imageUrl && room.imageUrl.startsWith("http")) {
    try {
      const mimeType = inferMimeType(room.imageUrl);
      const uploadResult = await upload({
        type: "image",
        mimeType,
        url: room.imageUrl,
        thumbnailUrl: room.imageUrl,
        aiDisclosure: "none",
        name: `${room.revitId}_${room.roomName}`.slice(0, 100),
      });
      imageAssetRef = uploadResult.ref;
      imageUploaded = true;
    } catch (err) {
      console.warn("Could not upload external image to Canva asset store:", err);
    }
  }

  const layoutMode = options.layoutMode || "table";

  if (layoutMode === "table") {
    // === ARCHITECTURAL TABLE LAYOUT ===
    const tableElement: TableElement = {
      type: "table",
      rows: [
        {
          cells: [
            {
              type: "string",
              value: "Revit_ID",
              attributes: {
                backgroundColor: "#F1F5F9",
                fontWeight: "bold",
                color: "#1E293B",
              },
            },
            {
              type: "string",
              value: "Finish_Spec & Material Description",
              attributes: {
                backgroundColor: "#F1F5F9",
                fontWeight: "bold",
                color: "#1E293B",
              },
            },
          ],
        },
        {
          cells: [
            {
              type: "string",
              value: room.revitId,
              attributes: {
                backgroundColor: room.badgeColorHex || "#5B9B42",
                fontWeight: "bold",
                color: "#FFFFFF",
              },
            },
            {
              type: "string",
              value: room.finishSpec || "Standard Finish",
              attributes: {
                backgroundColor: "#FFFFFF",
                color: "#0F172A",
              },
            },
          ],
        },
      ],
    };

    try {
      await addElementAtCursor(tableElement);
    } catch (err) {
      console.warn("Table injection at cursor failed, falling back to text blocks:", err);
      await fallbackCardPlacement(room, startX, currentY);
    }

    // Place the 3D Render Image alongside the table
    if (imageAssetRef) {
      const imageElement = {
        type: "image" as const,
        ref: imageAssetRef,
        altText: { text: `${room.roomName} Render`, decorative: false },
        top: 240,
        left: 560,
        width: 520,
        height: 340,
      };

      try {
        await addElementAtPoint(imageElement);
      } catch {
        await addElementAtCursor({
          type: "image",
          ref: imageAssetRef,
          altText: { text: `${room.roomName} Render`, decorative: false },
        });
      }
    }

    return { success: true, imageUploaded };
  }

  // === CARD LAYOUT ===
  await fallbackCardPlacement(room, startX, currentY);

  if (imageAssetRef) {
    const imageElement = {
      type: "image" as const,
      ref: imageAssetRef,
      altText: { text: `${room.roomName} Render`, decorative: false },
      top: currentY + 120,
      left: startX,
      width: 520,
      height: 340,
    };

    try {
      await addElementAtPoint(imageElement);
    } catch {
      await addElementAtCursor({
        type: "image",
        ref: imageAssetRef,
        altText: { text: `${room.roomName} Render`, decorative: false },
      });
    }
  }

  return { success: true, imageUploaded };
}

async function fallbackCardPlacement(room: BimRoomRecord, startX: number, startY: number) {
  let currentY = startY;

  // 1. Badge Text
  const badgeElement = {
    type: "text" as const,
    children: [room.revitId],
    fontSize: 16,
    fontWeight: "bold" as const,
    color: room.badgeColorHex || "#5B9B42",
    top: currentY,
    left: startX,
    width: 280,
  };

  try {
    await addElementAtPoint(badgeElement);
  } catch {
    await addElementAtCursor(badgeElement);
  }

  currentY += 36;

  // 2. Room Title
  const titleElement = {
    type: "text" as const,
    children: [room.roomName],
    fontSize: 28,
    fontWeight: "bold" as const,
    color: "#0F172A",
    top: currentY,
    left: startX,
    width: 520,
  };

  try {
    await addElementAtPoint(titleElement);
  } catch {
    await addElementAtCursor(titleElement);
  }

  currentY += 46;

  // 3. Long Specification Line
  const specText = room.areaLabel
    ? `Area: ${room.areaLabel}  |  Finish: ${room.finishSpec}`
    : room.finishSpec;

  const specsElement = {
    type: "text" as const,
    children: [specText || "No specifications recorded"],
    fontSize: 14,
    color: "#475569",
    top: currentY,
    left: startX,
    width: 540,
  };

  try {
    await addElementAtPoint(specsElement);
  } catch {
    await addElementAtCursor(specsElement);
  }
}

/**
 * Updates existing text on the active slide IN-PLACE without moving bounding boxes,
 * without shifting positions, and without altering custom styling or manual tweaks.
 */
export async function syncRoomElementsInPlace(
  room: BimRoomRecord,
): Promise<{ updatedCount: number }> {
  let updatedCount = 0;
  const newSpecText = room.finishSpec || "Standard Finish";

  await editContent(
    { contentType: "richtext", target: "current_page" },
    async (session) => {
      const contents = session.contents;
      if (!contents || contents.length === 0) return;

      for (const range of contents) {
        if (range.deleted) continue;

        const currentText = range.readPlaintext();
        if (!currentText || currentText.trim().length === 0) continue;

        // 1. Detect if this text box is the Specifications Line
        const isSpecBlock =
          currentText.includes("Finish:") ||
          currentText.includes("Finish_Spec") ||
          currentText.includes("Veneer") ||
          currentText.includes("Concrete") ||
          (room.finishSpec && currentText.includes(room.finishSpec.slice(0, 15)));

        if (isSpecBlock) {
          range.replaceText(
            { index: 0, length: currentText.length },
            newSpecText,
          );
          updatedCount++;
          continue;
        }

        // 2. Detect if this text box is the Room Title
        if (
          currentText.trim() === room.roomName ||
          currentText.toLowerCase().includes(room.roomName.toLowerCase())
        ) {
          range.replaceText(
            { index: 0, length: currentText.length },
            room.roomName,
          );
          updatedCount++;
          continue;
        }

        // 3. Detect if this text box is the Room ID badge
        if (currentText.includes(room.revitId) && currentText.length < 50) {
          range.replaceText(
            { index: 0, length: currentText.length },
            room.revitId,
          );
          updatedCount++;
        }
      }

      if (updatedCount > 0) {
        await session.sync();
      }
    },
  );

  return { updatedCount };
}

/**
 * Checks metadata for the active page if supported.
 */
export async function getActiveSlideDimensions(): Promise<{ width: number; height: number }> {
  try {
    const meta = await getCurrentPageMetadata();
    if (meta.type === "absolute" && meta.dimensions) {
      return meta.dimensions;
    }
  } catch {
    // Default standard slide dimensions (1920x1080)
  }
  return { width: 1920, height: 1080 };
}
