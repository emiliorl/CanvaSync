import { defineMessage } from "react-intl";
import { LocalizedError } from "../utils/localizedError";
import { openDesign, type DesignEditing } from "@canva/design";
import { upload, type ImageRef } from "@canva/asset";
import type { BimRoomRecord, ImportLayout } from "../types/bim";
import { buildEditableSchedule, getRecordCell } from "./canvaCanvasService";
import { resolveImageSource } from "./imageSourceService";

const PREFIX = "CanvaSync:v1:";
const BLANK = "\u200b";

// Canva permits only one open Design Editing session, including read-only
// checks. Wait for the whole SDK call (not just its callback) to finish so
// polling, insertion, and updates cannot overlap while a session is closing.
let designSessionTail: Promise<void> = Promise.resolve();
export function isDesignSessionBusy(error: unknown): boolean {
  const message = error instanceof Error ? error.message : String(error);
  return (
    /cannot open design/i.test(message) &&
    /session is already open|only one session/i.test(message)
  );
}
function isInternalDesignError(error: unknown): boolean {
  return (
    (typeof error === "object" &&
      error != null &&
      "code" in error &&
      error.code === "internal_error") ||
    (error instanceof Error && /\[internal_error\]/i.test(error.message))
  );
}
export function isTransientDesignError(error: unknown): boolean {
  return isDesignSessionBusy(error) || isInternalDesignError(error);
}
function withCurrentPage(
  callback: (session: DesignEditing.CurrentPageSession) => Promise<void>,
  options: { readOnly?: boolean } = {},
) {
  const result = designSessionTail.then(async () => {
    const delays = [100, 250, 500, 1000, 2000];
    for (let attempt = 0; ; attempt++) {
      let callbackStarted = false;
      let callbackCompleted = false;
      try {
        await openDesign({ type: "current_page" }, async (session) => {
          callbackStarted = true;
          await callback(session);
          callbackCompleted = true;
        });
        return;
      } catch (error) {
        // A completed read has already captured a valid snapshot. A cleanup
        // error cannot undo that read, and must not be presented as a save error.
        if (
          options.readOnly &&
          callbackCompleted &&
          isTransientDesignError(error)
        )
          return;
        // Canva may still be closing its previous session after its promise
        // resolves. Only retry a refused open; never replay an edit callback.
        if (
          (callbackStarted && !options.readOnly) ||
          !isTransientDesignError(error) ||
          attempt >= delays.length
        )
          throw error;
        await new Promise<void>((resolve) =>
          setTimeout(resolve, delays[attempt]),
        );
      }
    }
  });
  // A failed session must not prevent later checks or updates from running.
  designSessionTail = result.catch(() => {});
  return result;
}
export interface LinkedTable {
  sourceKey: string;
  layout: ImportLayout;
  includeImages: boolean;
  keyColumn: string;
  keys: string[];
  values: string[];
  /** Last observed sheet colors, in source row/selected column order. */
  sourceColors?: string[];
  imageAssets: Record<number, string>;
  /** Physical row order in the group; source order may change independently. */
  cellKeys?: string[];
  renderingVersion?: number;
  time: number;
  commitId?: string;
}
export interface TableState {
  pageId: string;
  table: LinkedTable | null;
  rowHeights?: Record<string, number>;
  columnWidths?: Record<string, number>;
}

function findTable(page: DesignEditing.Page, sourceKey: string) {
  if (page.type !== "absolute")
    throw new LocalizedError(
      defineMessage({
        defaultMessage: "This page does not support linked tables.",
        description: "CanvaSync linkedTableService operation error",
      }),
      "This page does not support linked tables.",
    );
  const matches = page.elements.toArray().flatMap((element) => {
    if (
      element.type === "text" &&
      element.text.readPlaintext().startsWith(PREFIX)
    ) {
      let data;
      try {
        data = JSON.parse(element.text.readPlaintext().slice(PREFIX.length));
      } catch {
        /* Unrelated marker. */
      }
      if (data?.sourceKey === sourceKey)
        throw new LocalizedError(
          defineMessage({
            defaultMessage:
              "This linked table was ungrouped. Undo ungrouping before inserting or updating it.",
            description: "CanvaSync linkedTableService operation error",
          }),
          "This linked table was ungrouped. Undo ungrouping before inserting or updating it.",
        );
    }
    if (element.type !== "group") return [];
    const marker = element.contents
      .toArray()
      .find(
        (child) =>
          child.type === "text" &&
          child.text.readPlaintext().startsWith(PREFIX),
      );
    if (marker?.type !== "text") return [];
    try {
      const data: LinkedTable = JSON.parse(
        marker.text.readPlaintext().slice(PREFIX.length),
      );
      return data.sourceKey === sourceKey
        ? [{ group: element, marker, data }]
        : [];
    } catch {
      return [];
    }
  });
  if (matches.length > 1)
    throw new LocalizedError(
      defineMessage({
        defaultMessage:
          "Multiple linked tables for this sheet are on this page. Remove the duplicate before updating.",
        description: "CanvaSync linkedTableService operation error",
      }),
      "Multiple linked tables for this sheet are on this page. Remove the duplicate before updating.",
    );
  return matches[0];
}

export async function readLinkedTable(sourceKey: string): Promise<TableState> {
  let state: TableState | undefined;
  await withCurrentPage(
    async ({ page }) => {
      if (page.type !== "absolute")
        throw new LocalizedError(
          defineMessage({
            defaultMessage: "This page does not support linked tables.",
            description: "CanvaSync linkedTableService operation error",
          }),
          "This page does not support linked tables.",
        );
      const found = findTable(page, sourceKey);
      const count = found?.data.layout.columns.length || 0;
      const contents = found?.group.contents.toArray() || [];
      state = {
        pageId: page.id,
        table: found?.data || null,
        columnWidths: Object.fromEntries(
          (found?.data.layout.columns || []).map((column, index) => [
            column.key,
            contents[index * 2]?.width || 0,
          ]),
        ),
        rowHeights: Object.fromEntries(
          (found?.data.cellKeys || found?.data.keys || []).map((key, row) => [
            key,
            Math.max(
              ...Array.from(
                { length: count },
                (_, column) =>
                  contents[((row + 1) * count + column) * 2]?.height || 0,
              ),
            ),
          ]),
        ),
      };
    },
    { readOnly: true },
  );
  if (!state)
    throw new LocalizedError(
      defineMessage({
        defaultMessage: "Could not check the current Canva page.",
        description: "CanvaSync linkedTableService operation error",
      }),
      "Could not check the current Canva page.",
    );
  return state;
}

type VerificationOptions = {
  rowHeights?: Record<string, number>;
  columnWidths?: Record<string, number>;
  hasCellColors?: boolean;
};

/** Recover an ambiguous SDK save only after reading back this exact commit and its actual cells. */
async function writeLinkedTable(
  expected: LinkedTable,
  pageId: string,
  edit: (session: DesignEditing.CurrentPageSession) => Promise<void>,
  options: VerificationOptions = {},
) {
  let started = false;
  try {
    await withCurrentPage(async (session) => {
      started = true;
      await edit(session);
    });
  } catch (error) {
    if (!started || !isTransientDesignError(error)) throw error;
    let confirmed = false;
    try {
      await withCurrentPage(
        async ({ page }) => {
          if (page.type !== "absolute" || page.id !== pageId) return;
          const found = findTable(page, expected.sourceKey);
          if (
            !found ||
            !expected.commitId ||
            found.data.commitId !== expected.commitId ||
            JSON.stringify(found.data) !== JSON.stringify(expected)
          )
            return;
          const children = found.group.contents.toArray();
          const columns = expected.layout.columns;
          const count = columns.length;
          if (children.length !== (expected.values.length + count) * 2 + 1)
            return;
          const cellKeys = expected.cellKeys || expected.keys;
          confirmed = expected.values.every((value, index) => {
            const row = cellKeys.indexOf(
              expected.keys[Math.floor(index / count)]!,
            );
            const column = columns[index % count]!;
            const background =
              children[((row + 1) * count + (index % count)) * 2];
            const child =
              children[((row + 1) * count + (index % count)) * 2 + 1];
            if (row < 0 || background?.type !== "rect") return false;
            if (column.kind === "text") {
              if (
                child?.type !== "text" ||
                child.text.readPlaintext() !== (value || BLANK)
              )
                return false;
            } else {
              if (child?.type !== "rect") return false;
              const media = child.fill.mediaContainer.ref;
              if (
                (media?.type === "image" ? media.imageRef : undefined) !==
                expected.imageAssets[index]
              )
                return false;
            }
            if (options.hasCellColors !== false && expected.sourceColors) {
              const fill = background.fill.colorContainer.ref;
              if (
                fill?.type !== "solid" ||
                fill.color.toLowerCase() !== expected.sourceColors[index] ||
                background.fill.mediaContainer.ref
              )
                return false;
            }
            const height =
              options.rowHeights?.[expected.keys[Math.floor(index / count)]!];
            const width = options.columnWidths?.[column.key];
            return (
              (height === undefined ||
                Math.abs(background.height - height) < 0.5) &&
              (width === undefined || Math.abs(background.width - width) < 0.5)
            );
          });
        },
        { readOnly: true },
      );
    } catch {
      /* Verification could not confirm a completed save. Keep the original error. */
    }
    if (!confirmed) throw error;
  }
}

const newCommitId = () =>
  globalThis.crypto?.randomUUID?.() ||
  `${Date.now()}-${Math.random().toString(36).slice(2)}`;

function rowKeys(records: BimRoomRecord[], keyColumn: string) {
  const keys = records.map(
    (record) =>
      getRecordCell(record, { key: keyColumn, title: "", kind: "text" }).value,
  );
  if (keys.some((key) => !key.trim()) || new Set(keys).size !== keys.length)
    throw new LocalizedError(
      defineMessage({
        defaultMessage:
          "Choose a record key column with a unique, nonempty value in every row.",
        description: "CanvaSync linkedTableService operation error",
      }),
      "Choose a record key column with a unique, nonempty value in every row.",
    );
  return keys;
}

export function linkedValues(records: BimRoomRecord[], layout: ImportLayout) {
  return records.flatMap((record) =>
    layout.columns.map((column) => getRecordCell(record, column).value),
  );
}

export function linkedColors(records: BimRoomRecord[], layout: ImportLayout) {
  return records.flatMap((record) =>
    layout.columns.map((column) => {
      const color = getRecordCell(record, column).backgroundColor;
      return color && /^#[0-9a-f]{6}$/i.test(color)
        ? color.toLowerCase()
        : "#ffffff";
    }),
  );
}

async function imageRefs(
  values: string[],
  layout: ImportLayout,
  includeImages: boolean,
) {
  const refs = new Map<number, ImageRef>();
  if (!includeImages) return refs;
  await Promise.all(
    values.map(async (url, index) => {
      if (
        layout.columns[index % layout.columns.length]?.kind !== "image" ||
        !url
      )
        return;
      if (!/^https?:\/\//i.test(url.trim()))
        throw new LocalizedError(
          defineMessage({
            defaultMessage:
              "Image cells must contain an HTTP or HTTPS image URL.",
            description: "CanvaSync linkedTableService operation error",
          }),
          "Image cells must contain an HTTP or HTTPS image URL.",
        );
      const source = await resolveImageSource(url);
      const image = await upload({
        type: "image",
        ...source,
        aiDisclosure: "none",
      });
      await image.whenUploaded();
      refs.set(index, image.ref);
    }),
  );
  return refs;
}

export async function insertLinkedTable(
  records: BimRoomRecord[],
  options: {
    sourceKey: string;
    layout: ImportLayout;
    includeImages: boolean;
    keyColumn: string;
    hasCellColors?: boolean;
  },
): Promise<LinkedTable> {
  if (!records.length)
    throw new LocalizedError(
      defineMessage({
        defaultMessage: "No rows to insert.",
        description: "CanvaSync linkedTableService operation error",
      }),
      "No rows to insert.",
    );
  const keys = rowKeys(records, options.keyColumn);
  const values = linkedValues(records, options.layout);
  const initialPage = await readLinkedTable(options.sourceKey);
  if (initialPage.table)
    throw new LocalizedError(
      defineMessage({
        defaultMessage:
          "This sheet already has a table on this page. Use Update table.",
        description: "CanvaSync linkedTableService operation error",
      }),
      "This sheet already has a table on this page. Use Update table.",
    );
  const refs = await imageRefs(values, options.layout, options.includeImages);
  const data: LinkedTable = {
    ...options,
    keys,
    values,
    sourceColors:
      options.hasCellColors === false
        ? undefined
        : linkedColors(records, options.layout),
    imageAssets: Object.fromEntries(refs),
    cellKeys: keys,
    renderingVersion: 2,
    time: Date.now(),
    commitId: newCommitId(),
  };
  const schedule = buildEditableSchedule(records, options.layout);
  const shapes = schedule.children.filter((child) => child.type === "shape");
  await writeLinkedTable(data, initialPage.pageId, async (session) => {
    const { page, helpers } = session;
    if (
      page.type !== "absolute" ||
      page.id !== initialPage.pageId ||
      page.locked
    )
      throw new LocalizedError(
        defineMessage({
          defaultMessage: "The page changed or is locked. Try inserting again.",
          description: "CanvaSync linkedTableService operation error",
        }),
        "The page changed or is locked. Try inserting again.",
      );
    if (findTable(page, options.sourceKey))
      throw new LocalizedError(
        defineMessage({
          defaultMessage:
            "This sheet already has a table on this page. Use Update table.",
          description: "CanvaSync linkedTableService operation error",
        }),
        "This sheet already has a table on this page. Use Update table.",
      );
    const builder = helpers.elementStateBuilder;
    const elements: Exclude<
      DesignEditing.GroupContentElement,
      DesignEditing.UnsupportedElement
    >[] = [];
    const add = (state: DesignEditing.InsertableElementState) => {
      const element = page.elements.insertBefore(undefined, state);
      if (
        !element ||
        element.type === "unsupported" ||
        element.type === "group"
      )
        throw new LocalizedError(
          defineMessage({
            defaultMessage: "Could not create a table cell.",
            description: "CanvaSync linkedTableService operation error",
          }),
          "Could not create a table cell.",
        );
      elements.push(element);
    };
    shapes.forEach((shape, index) => {
      if (typeof shape.width !== "number" || typeof shape.height !== "number")
        throw new LocalizedError(
          defineMessage({
            defaultMessage: "Invalid cell dimensions.",
            description: "CanvaSync linkedTableService operation error",
          }),
          "Invalid cell dimensions.",
        );
      const column =
        options.layout.columns[index % options.layout.columns.length]!;
      const valueIndex = index - options.layout.columns.length;
      const isImage = valueIndex >= 0 && column.kind === "image";
      add(
        builder.createRectElement({
          left: shape.left + 40,
          top: shape.top + 50,
          width: shape.width!,
          height: shape.height!,
          fill: {
            colorContainer: {
              color: (shape.paths[0]?.fill.color || "#ffffff").toLowerCase(),
              type: "solid",
            },
          },
          stroke: {
            weight: 1,
            colorContainer: { color: "#bfc4c2", type: "solid" },
          },
        }),
      );
      if (isImage) {
        const ref = refs.get(valueIndex);
        // Keep an image slot even for blank source cells so a later update can fill it.
        add(
          builder.createRectElement({
            left: shape.left + 41,
            top: shape.top + 51,
            width: shape.width! - 2,
            height: shape.height! - 2,
            transparency: ref ? 0 : 1,
            fill: ref
              ? { mediaContainer: { type: "image", imageRef: ref } }
              : { colorContainer: { type: "solid", color: "#ffffff" } },
          }),
        );
      } else {
        add(
          builder.createTextElement({
            left: shape.left + 47,
            top: shape.top + 58,
            width: shape.width! - 14,
            text: {
              regions: [
                {
                  text:
                    (valueIndex < 0 ? column.title : values[valueIndex]) ||
                    BLANK,
                  formatting: { fontSize: 14, color: "#111111" },
                },
              ],
            },
          }),
        );
      }
    });
    // The invisible marker keeps the source connection in the design itself.
    add(
      builder.createTextElement({
        left: 40,
        top: 50,
        width: schedule.width,
        transparency: 1,
        text: {
          regions: [
            {
              text: PREFIX + JSON.stringify(data),
              formatting: { fontSize: 1 },
            },
          ],
        },
      }),
    );
    await helpers.group({ elements });
    await session.sync();
  });
  return data;
}

export async function updateLinkedTable(
  sourceKey: string,
  records: BimRoomRecord[],
  options: {
    rowHeights?: Record<string, number>;
    columnWidths?: Record<string, number>;
    hasCellColors?: boolean;
  } = {},
): Promise<LinkedTable> {
  const state = await readLinkedTable(sourceKey);
  if (!state.table)
    throw new LocalizedError(
      defineMessage({
        defaultMessage: "No linked table on this page. Insert the table first.",
        description: "CanvaSync linkedTableService operation error",
      }),
      "No linked table on this page. Insert the table first.",
    );
  const previous = state.table;
  const keys = rowKeys(records, previous.keyColumn);
  if (
    keys.length !== previous.keys.length ||
    keys.some((key) => !previous.keys.includes(key))
  )
    throw new LocalizedError(
      defineMessage({
        defaultMessage:
          "Record keys were added, removed, or changed. Keep existing keys stable when editing or reordering rows.",
        description: "CanvaSync linkedTableService operation error",
      }),
      "Record keys were added, removed, or changed. Keep existing keys stable when editing or reordering rows.",
    );
  const count = previous.layout.columns.length;
  const requestedWidths = options.columnWidths || {};
  for (const [key, width] of Object.entries(requestedWidths)) {
    if (
      !previous.layout.columns.some((column) => column.key === key) ||
      !Number.isFinite(width) ||
      width < 72 ||
      width > 2000
    )
      throw new LocalizedError(
        defineMessage({
          defaultMessage:
            "Column widths must be between 72 and 2000 pixels and belong to an imported column.",
          description: "CanvaSync linkedTableService operation error",
        }),
        "Column widths must be between 72 and 2000 pixels and belong to an imported column.",
      );
  }
  const requestedHeights = options.rowHeights || {};
  for (const [key, height] of Object.entries(requestedHeights)) {
    if (
      !keys.includes(key) ||
      !Number.isFinite(height) ||
      height < 32 ||
      height > 2000
    )
      throw new LocalizedError(
        defineMessage({
          defaultMessage:
            "Row heights must be between 32 and 2000 pixels and belong to an existing record key.",
          description: "CanvaSync linkedTableService operation error",
        }),
        "Row heights must be between 32 and 2000 pixels and belong to an existing record key.",
      );
  }
  const cellKeys = previous.cellKeys || previous.keys;
  const previousIndex = (index: number) =>
    previous.keys.indexOf(keys[Math.floor(index / count)]!) * count +
    (index % count);
  const values = linkedValues(records, previous.layout);
  const sourceColors = linkedColors(records, previous.layout);
  const changed = values.map((value, index) =>
    value === previous.values[previousIndex(index)] ? "" : value,
  );
  const refs = await imageRefs(
    changed,
    previous.layout,
    previous.includeImages,
  );
  const imageAssets: Record<number, string> = {};
  changed.forEach((_, index) => {
    const ref =
      values[index] === previous.values[previousIndex(index)]
        ? previous.imageAssets[previousIndex(index)]
        : refs.get(index);
    if (ref) imageAssets[index] = ref;
  });
  const data = {
    ...previous,
    keys,
    layout: {
      ...previous.layout,
      columnWidths: { ...previous.layout.columnWidths, ...requestedWidths },
    },
    cellKeys,
    renderingVersion: 2,
    values,
    sourceColors:
      options.hasCellColors === false ? previous.sourceColors : sourceColors,
    imageAssets,
    time: Date.now(),
    commitId: newCommitId(),
  };
  await writeLinkedTable(
    data,
    state.pageId,
    async (session) => {
      if (
        session.page.type !== "absolute" ||
        session.page.id !== state.pageId ||
        session.page.locked
      )
        throw new LocalizedError(
          defineMessage({
            defaultMessage:
              "The page changed or is locked. Try updating again.",
            description: "CanvaSync linkedTableService operation error",
          }),
          "The page changed or is locked. Try updating again.",
        );
      const found = findTable(session.page, sourceKey);
      if (
        !found ||
        found.group.locked ||
        found.marker.locked ||
        JSON.stringify(found.data) !== JSON.stringify(previous)
      )
        throw new LocalizedError(
          defineMessage({
            defaultMessage:
              "The linked table changed or is locked. Check the table and try again.",
            description: "CanvaSync linkedTableService operation error",
          }),
          "The linked table changed or is locked. Check the table and try again.",
        );
      const groupedChildren = found.group.contents.toArray();
      if (groupedChildren.length !== (values.length + count) * 2 + 1)
        throw new LocalizedError(
          defineMessage({
            defaultMessage:
              "The table structure changed in Canva. Restore its cells before updating.",
            description: "CanvaSync linkedTableService operation error",
          }),
          "The table structure changed in Canva. Restore its cells before updating.",
        );
      if (
        groupedChildren.some(
          (child) =>
            child.locked || (child.type !== "rect" && child.type !== "text"),
        )
      )
        throw new LocalizedError(
          defineMessage({
            defaultMessage:
              "The linked table contains a locked or unsupported element.",
            description: "CanvaSync linkedTableService operation error",
          }),
          "The linked table contains a locked or unsupported element.",
        );
      const changesRows =
        JSON.stringify(keys) !== JSON.stringify(previous.keys) ||
        Object.keys(requestedHeights).length > 0;
      const changesGeometry =
        changesRows || Object.keys(requestedWidths).length > 0;
      if (
        changesGeometry &&
        (found.group.rotation ||
          groupedChildren.some((child) => child.rotation))
      )
        throw new LocalizedError(
          defineMessage({
            defaultMessage:
              "Set the table rotation to zero before reordering or resizing the table.",
            description: "CanvaSync linkedTableService operation error",
          }),
          "Set the table rotation to zero before reordering or resizing the table.",
        );
      // Validate every target before ungrouping or changing any content.
      const getTargets = (
        children:
          | readonly DesignEditing.AbsoluteElement[]
          | readonly DesignEditing.GroupContentElement[],
      ) =>
        values.map((value, index) => {
          const physicalRow = cellKeys.indexOf(
            keys[Math.floor(index / count)]!,
          );
          if (physicalRow < 0)
            throw new LocalizedError(
              defineMessage({
                defaultMessage: "The linked row mapping is incomplete.",
                description: "CanvaSync linkedTableService operation error",
              }),
              "The linked row mapping is incomplete.",
            );
          const physicalIndex = physicalRow * count + (index % count);
          const child = children[(physicalIndex + count) * 2 + 1];
          const oldIndex = previousIndex(index);
          const column = previous.layout.columns[index % count]!;
          if (
            !child ||
            (child.type !== "text" && child.type !== "rect") ||
            child.locked ||
            (column.kind === "image"
              ? child.type !== "rect"
              : child.type !== "text")
          )
            throw new LocalizedError(
              defineMessage({
                defaultMessage:
                  "A linked cell was removed, moved in the layer order, or locked.",
                description: "CanvaSync linkedTableService operation error",
              }),
              "A linked cell was removed, moved in the layer order, or locked.",
            );
          if (
            child.type === "text" &&
            child.text.readPlaintext() !== (previous.values[oldIndex] || BLANK)
          )
            throw new LocalizedError(
              defineMessage({
                defaultMessage:
                  "A cell was edited in Canva or its layer order changed. Restore its previous value before updating.",
                description: "CanvaSync linkedTableService operation error",
              }),
              "A cell was edited in Canva or its layer order changed. Restore its previous value before updating.",
            );
          if (child.type === "rect") {
            const media = child.fill.mediaContainer.ref;
            if (
              (media?.type === "image" ? media.imageRef : undefined) !==
              previous.imageAssets[oldIndex]
            )
              throw new LocalizedError(
                defineMessage({
                  defaultMessage:
                    "An image was edited in Canva or its layer order changed. Restore it before updating.",
                  description: "CanvaSync linkedTableService operation error",
                }),
                "An image was edited in Canva or its layer order changed. Restore it before updating.",
              );
          }
          const background = children[(physicalIndex + count) * 2];
          if (background?.type !== "rect" || background.locked)
            throw new LocalizedError(
              defineMessage({
                defaultMessage:
                  "A table cell background was removed or locked.",
                description: "CanvaSync linkedTableService operation error",
              }),
              "A table cell background was removed or locked.",
            );
          const rowKey = keys[Math.floor(index / count)]!;
          const requestedHeight = requestedHeights[rowKey];
          const requestedWidth = requestedWidths[column.key];
          if (
            child.type === "text" &&
            value &&
            (value !== previous.values[oldIndex] ||
              requestedHeight !== undefined ||
              requestedWidth !== undefined)
          ) {
            const fontSize =
              child.text.readTextRegions()[0]?.formatting?.fontSize || 14;
            const textWidth =
              child.width +
              (requestedWidth === undefined
                ? 0
                : requestedWidth - background.width);
            const chars = Math.max(1, Math.floor(textWidth / (fontSize * 0.6)));
            const lines = value
              .split(/\r?\n/)
              .reduce(
                (sum, line) =>
                  sum + Math.max(1, Math.ceil(line.length / chars)),
                0,
              );
            if (
              textWidth <= 0 ||
              lines * fontSize * 1.45 + 16 >
                (requestedHeight ?? background.height)
            )
              throw new LocalizedError(
                defineMessage({
                  defaultMessage:
                    "Updated text may not fit its Canva cell. Increase that row's height before updating.",
                  description: "CanvaSync linkedTableService operation error",
                }),
                "Updated text may not fit its Canva cell. Increase that row's height before updating.",
              );
          }
          return { child, background, value, index, oldIndex, physicalRow };
        });
      getTargets(groupedChildren);
      for (const [index, column] of previous.layout.columns.entries()) {
        const width = requestedWidths[column.key];
        const header = groupedChildren[index * 2];
        const text = groupedChildren[index * 2 + 1];
        if (
          width !== undefined &&
          header?.type === "rect" &&
          text?.type === "text"
        ) {
          const fontSize =
            text.text.readTextRegions()[0]?.formatting?.fontSize || 14;
          const chars = Math.max(
            1,
            Math.floor((text.width + width - header.width) / (fontSize * 0.6)),
          );
          const lines = text.text
            .readPlaintext()
            .split(/\r?\n/)
            .reduce(
              (total, line) =>
                total + Math.max(1, Math.ceil(line.length / chars)),
              0,
            );
          if (lines * fontSize * 1.4 + 8 > header.height)
            throw new LocalizedError(
              defineMessage({
                defaultMessage:
                  "The column header may not fit. Choose a wider column.",
                description: "CanvaSync linkedTableService operation error",
              }),
              "The column header may not fit. Choose a wider column.",
            );
        }
      }
      // Group child geometry is immutable in Canva, and changing text can resize
      // its box. Always edit the returned page elements, never the grouped handles.
      const children = (
        await session.helpers.ungroup({ element: found.group })
      ).map((child) => {
        if (child.type !== "text" && child.type !== "rect")
          throw new LocalizedError(
            defineMessage({
              defaultMessage:
                "Could not access the linked table's editable cells.",
              description: "CanvaSync linkedTableService operation error",
            }),
            "Could not access the linked table's editable cells.",
          );
        return child;
      });
      const targets = getTargets(children);
      const replaceRectSize = (
        rect: DesignEditing.RectElement,
        height: number,
        width = rect.width,
      ) => {
        const media = rect.fill.mediaContainer.ref;
        const color = rect.fill.colorContainer.ref;
        const strokeColor = rect.stroke?.colorContainer.ref;
        if (strokeColor && strokeColor.type !== "solid")
          throw new LocalizedError(
            defineMessage({
              defaultMessage: "This cell border cannot be resized safely.",
              description: "CanvaSync linkedTableService operation error",
            }),
            "This cell border cannot be resized safely.",
          );
        // SDK refs are live model objects, not builder input. Copy every nested
        // field into fresh plain state, including solid fills and stroke colors.
        const colorState =
          color?.type === "solid"
            ? { type: "solid" as const, color: color.color }
            : undefined;
        const mediaState: DesignEditing.MediaContainerOpts | undefined =
          media?.type === "image"
            ? {
                type: "image",
                imageRef: media.imageRef,
                flipX: media.flipX,
                flipY: media.flipY,
              }
            : media?.type === "video"
              ? {
                  type: "video",
                  videoRef: media.videoRef,
                  flipX: media.flipX,
                  flipY: media.flipY,
                }
              : undefined;
        const fill: DesignEditing.FillOpts | undefined = mediaState
          ? {
              mediaContainer: mediaState,
              ...(colorState ? { colorContainer: colorState } : {}),
            }
          : colorState
            ? { colorContainer: colorState }
            : undefined;
        const state = session.helpers.elementStateBuilder.createRectElement({
          top: rect.top,
          left: rect.left,
          width,
          height,
          rotation: rect.rotation,
          transparency: rect.transparency,
          fill,
          stroke:
            rect.stroke && strokeColor?.type === "solid"
              ? {
                  weight: rect.stroke.weight,
                  colorContainer: { type: "solid", color: strokeColor.color },
                }
              : undefined,
        });
        const replacement =
          session.page.type === "absolute"
            ? session.page.elements.insertBefore(rect, state)
            : undefined;
        if (!replacement || replacement.type !== "rect")
          throw new LocalizedError(
            defineMessage({
              defaultMessage: "Could not resize the row cell.",
              description: "CanvaSync linkedTableService operation error",
            }),
            "Could not resize the row cell.",
          );
        if (session.page.type === "absolute")
          session.page.elements.delete(rect);
        const index = children.indexOf(rect);
        if (index < 0)
          throw new LocalizedError(
            defineMessage({
              defaultMessage: "Could not locate the row cell.",
              description: "CanvaSync linkedTableService operation error",
            }),
            "Could not locate the row cell.",
          );
        children[index] = replacement;
        return replacement;
      };
      const rows = keys.map((key, rowIndex) => {
        const cells = targets.slice(rowIndex * count, (rowIndex + 1) * count);
        const top = Math.min(...cells.map(({ background }) => background.top));
        const bottom = Math.max(
          ...cells.map(({ background }) => background.top + background.height),
        );
        return {
          key,
          cells,
          top,
          height: requestedHeights[key] ?? bottom - top,
        };
      });
      if (changesRows) {
        let nextTop = Math.min(...rows.map((row) => row.top));
        for (const row of rows) {
          const delta = nextTop - row.top;
          for (const cell of row.cells) {
            if (requestedHeights[row.key] !== undefined) {
              const oldHeight = cell.background.height;
              const inset = cell.child.top - cell.background.top;
              cell.background = replaceRectSize(cell.background, row.height);
              if (cell.child.type === "rect")
                cell.child = replaceRectSize(
                  cell.child,
                  Math.max(1, cell.child.height + row.height - oldHeight),
                );
              cell.child.top = cell.background.top + inset;
            }
            cell.background.top += delta;
            cell.child.top += delta;
          }
          nextTop += row.height;
        }
      }
      const replaceTextWidth = (
        text: DesignEditing.TextElement,
        width: number,
      ) => {
        const state = session.helpers.elementStateBuilder.createTextElement({
          left: text.left,
          top: text.top,
          width,
          rotation: text.rotation,
          transparency: text.transparency,
          text: {
            regions: text.text.readTextRegions().map((region) => ({
              text: region.text,
              ...(region.formatting
                ? { formatting: { ...region.formatting } }
                : {}),
            })),
          },
        });
        const replacement =
          session.page.type === "absolute"
            ? session.page.elements.insertBefore(text, state)
            : undefined;
        if (!replacement || replacement.type !== "text")
          throw new LocalizedError(
            defineMessage({
              defaultMessage: "Could not resize the column text.",
              description: "CanvaSync linkedTableService operation error",
            }),
            "Could not resize the column text.",
          );
        const index = children.indexOf(text);
        if (index < 0)
          throw new LocalizedError(
            defineMessage({
              defaultMessage: "Could not locate the column text.",
              description: "CanvaSync linkedTableService operation error",
            }),
            "Could not locate the column text.",
          );
        if (session.page.type === "absolute")
          session.page.elements.delete(text);
        children[index] = replacement;
        return replacement;
      };
      if (Object.keys(requestedWidths).length) {
        const headers = previous.layout.columns.map((column, index) => {
          const background = children[index * 2];
          const child = children[index * 2 + 1];
          if (background?.type !== "rect" || child?.type !== "text")
            throw new LocalizedError(
              defineMessage({
                defaultMessage: "The table header structure changed.",
                description: "CanvaSync linkedTableService operation error",
              }),
              "The table header structure changed.",
            );
          return {
            background,
            child,
            key: column.key,
            left: background.left,
            width: background.width,
          };
        });
        let nextLeft = Math.min(...headers.map((header) => header.left));
        for (const [columnIndex, header] of headers.entries()) {
          const width = requestedWidths[header.key];
          const delta = nextLeft - header.left;
          const cells = [
            header,
            ...targets.filter(({ index }) => index % count === columnIndex),
          ];
          for (const cell of cells) {
            if (width !== undefined) {
              const widthDelta = width - cell.background.width;
              cell.background = replaceRectSize(
                cell.background,
                cell.background.height,
                width,
              );
              cell.child =
                cell.child.type === "rect"
                  ? replaceRectSize(
                      cell.child,
                      cell.child.height,
                      Math.max(1, cell.child.width + widthDelta),
                    )
                  : replaceTextWidth(
                      cell.child,
                      Math.max(1, cell.child.width + widthDelta),
                    );
            }
            cell.background.left += delta;
            cell.child.left += delta;
          }
          nextLeft += width ?? header.width;
        }
        const marker = children[children.length - 1];
        if (marker?.type === "text")
          replaceTextWidth(
            marker,
            nextLeft - Math.min(...headers.map((header) => header.left)),
          );
      }
      for (const { child, background, value, index, oldIndex } of targets) {
        if (options.hasCellColors !== false) {
          background.fill.colorContainer.set({
            type: "solid",
            color: sourceColors[index]!,
          });
          if (background.fill.mediaContainer.ref)
            background.fill.mediaContainer.set(undefined);
        }
        if (child.type === "text") {
          if (value === previous.values[oldIndex]) continue;
          const formatting = child.text.readTextRegions()[0]?.formatting;
          child.text.replaceText(
            { index: 0, length: child.text.readPlaintext().length },
            value || BLANK,
          );
          // Read regions include block attributes (font size, alignment, spacing).
          // replaceText only accepts inline attributes; restore the complete cell
          // formatting through the paragraph API after replacing its content.
          if (formatting)
            child.text.formatParagraph(
              { index: 0, length: (value || BLANK).length },
              formatting,
            );
        } else if (child.type === "rect") {
          if (!previous.includeImages) {
            child.transparency = 1;
            continue;
          }
          const ref = refs.get(index);
          const old = child.fill.mediaContainer.ref;
          if (value !== previous.values[oldIndex])
            child.fill.mediaContainer.set(
              ref
                ? {
                    type: "image",
                    imageRef: ref,
                    flipX: old?.flipX ?? false,
                    flipY: old?.flipY ?? false,
                  }
                : undefined,
            );
          const hasImage = !!imageAssets[index];
          if (!hasImage) child.transparency = 1;
          else if (
            previous.renderingVersion !== 2 ||
            !previous.imageAssets[oldIndex]
          )
            child.transparency = 0;
        }
      }
      // Repair markers/images created with the inverted transparency convention.
      const marker = children[children.length - 1];
      if (
        marker?.type !== "text" ||
        !marker.text.readPlaintext().startsWith(PREFIX)
      )
        throw new LocalizedError(
          defineMessage({
            defaultMessage:
              "Could not locate the table connection after ungrouping.",
            description: "CanvaSync linkedTableService operation error",
          }),
          "Could not locate the table connection after ungrouping.",
        );
      marker.transparency = 1;
      marker.text.replaceText(
        { index: 0, length: marker.text.readPlaintext().length },
        PREFIX + JSON.stringify(data),
      );
      await session.helpers.group({ elements: children });
      await session.sync();
    },
    options,
  );
  return data;
}
