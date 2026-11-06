import { openDesign } from "@canva/design";
import { upload } from "@canva/asset";
import {
  insertLinkedTable,
  readLinkedTable,
  updateLinkedTable,
} from "./linkedTableService";
import { parseSheetRows } from "./googleSheetsService";
import { getActiveGoogleToken } from "./googleAuthService";
jest.mock("./googleAuthService", () => ({ getActiveGoogleToken: jest.fn() }));

// Model a Design Editing session with mutable content and explicit sync.
function editor() {
  const elements: any[] = [];
  const liveRefs = new WeakSet<object>();
  const liveRef = (value: any) => {
    if (!value) return value;
    const ref = { ...value };
    liveRefs.add(ref);
    return ref;
  };
  const assertPlainState = (value: any) => {
    if (!value || typeof value !== "object") return;
    if (liveRefs.has(value))
      throw new Error("Cannot pass existing elements to element builder.");
    Object.values(value).forEach(assertPlainState);
  };
  const grouped = new WeakSet<object>();
  let designerEdit = false;
  const protect = (element: any) =>
    new Proxy(element, {
      set(target, key, value) {
        if (
          !designerEdit &&
          grouped.has(proxyFor(target)) &&
          ["top", "left", "width", "height", "rotation"].includes(String(key))
        )
          throw new Error("Group element contents cannot be moved or resized.");
        target[key] = value;
        return true;
      },
    });
  const handles = new WeakMap<object, object>();
  const proxyFor = (target: object) => handles.get(target) || target;
  const guarded = (target: any) => {
    const proxy = protect(target);
    handles.set(target, proxy);
    return proxy;
  };
  const list = (items: any[]) => ({ toArray: () => items });
  const page = {
    type: "absolute",
    id: "page1",
    locked: false,
    elements: {
      ...list(elements),
      insertBefore: (before: unknown, state: any) => {
        const index = before ? elements.indexOf(before) : elements.length;
        elements.splice(index, 0, state);
        return state;
      },
      delete: (element: any) => {
        elements.splice(elements.indexOf(element), 1);
      },
    },
  };
  const text = (options: any) => {
    let regions = options.text.regions;
    const element = guarded({
      ...options,
      type: "text",
      locked: false,
      transparency: options.transparency ?? 0,
      height: 20,
      text: {
        readPlaintext: () => regions.map((region: any) => region.text).join(""),
        readTextRegions: () => regions,
        replaceText: jest.fn((_: unknown, value: string, formatting: any) => {
          if (!designerEdit && grouped.has(element))
            throw new Error(
              "Group element contents cannot be moved or resized.",
            );
          const inlineKeys = [
            "color",
            "fontWeight",
            "fontStyle",
            "decoration",
            "strikethrough",
            "link",
          ];
          if (
            formatting &&
            Object.keys(formatting).some((key) => !inlineKeys.includes(key))
          )
            throw new Error(
              "Block attributes cannot be used in InlineFormatting",
            );
          regions = [{ text: value, formatting: formatting || {} }];
        }),
        formatParagraph: jest.fn((_: unknown, formatting: any) => {
          regions = regions.map((region: any) => ({
            ...region,
            formatting: { ...region.formatting, ...formatting },
          }));
        }),
      },
    });
    return element;
  };
  const sync = jest.fn().mockResolvedValue(undefined);
  const session = {
    page,
    sync,
    helpers: {
      elementStateBuilder: {
        createTextElement: text,
        createRectElement: (options: any) => {
          assertPlainState(options);
          const color = {
            ref: liveRef(options.fill.colorContainer),
            set: jest.fn((value) => {
              assertPlainState(value);
              color.ref = liveRef(value);
            }),
          };
          const media = {
            ref: liveRef(options.fill.mediaContainer),
            set: jest.fn((value) => {
              assertPlainState(value);
              media.ref = liveRef(value);
            }),
          };
          return guarded({
            ...options,
            type: "rect",
            locked: false,
            transparency: options.transparency ?? 0,
            rotation: options.rotation ?? 0,
            stroke: options.stroke
              ? {
                  weight: options.stroke.weight,
                  colorContainer: {
                    ref: liveRef(options.stroke.colorContainer),
                  },
                }
              : undefined,
            fill: {
              colorContainer: color,
              mediaContainer: media,
            },
          });
        },
      },
      group: jest.fn(async ({ elements: children }) => {
        const left = Math.min(...children.map((child: any) => child.left));
        const top = Math.min(...children.map((child: any) => child.top));
        const width =
          Math.max(...children.map((child: any) => child.left + child.width)) -
          left;
        const height =
          Math.max(...children.map((child: any) => child.top + child.height)) -
          top;
        for (const child of children) {
          child.left -= left;
          child.top -= top;
          grouped.add(child);
        }
        const group = {
          type: "group",
          locked: false,
          top,
          left,
          width,
          height,
          rotation: 0,
          contents: list([...children]),
        };
        const index = elements.indexOf(children[0]);
        for (const child of children)
          elements.splice(elements.indexOf(child), 1);
        elements.splice(index, 0, group);
        return group;
      }),
      ungroup: jest.fn(async ({ element }) => {
        const children = element.contents.toArray();
        for (const child of children) {
          grouped.delete(child);
          child.left += element.left;
          child.top += element.top;
        }
        elements.splice(elements.indexOf(element), 1, ...children);
        return children;
      }),
    },
  };
  jest
    .mocked(openDesign)
    .mockImplementation((async (
      _options: unknown,
      callback: (session: unknown) => Promise<void>,
    ) => callback(session)) as typeof openDesign);
  return {
    ...session,
    elements,
    editAsUser: (callback: () => void) => {
      designerEdit = true;
      try {
        callback();
      } finally {
        designerEdit = false;
      }
    },
  };
}

const data = parseSheetRows(
  ["ID", "Notes", "Photo"],
  [
    [
      { formattedValue: "A" },
      { formattedValue: "Old" },
      { formattedValue: "" },
    ],
    [{ formattedValue: "B" }, { formattedValue: "" }, { formattedValue: "" }],
  ],
);
const options = {
  sourceKey: "sheet:0",
  keyColumn: "column_0",
  includeImages: true,
  layout: {
    columns: data.columns!.map((column, index) => ({
      ...column,
      kind: index === 2 ? ("image" as const) : ("text" as const),
    })),
  },
};
const copyRecords = () =>
  JSON.parse(JSON.stringify(data.records)) as typeof data.records;

function deferred() {
  let resolve: () => void = () => {};
  const promise = new Promise<void>((complete) => {
    resolve = complete;
  });
  return { promise, resolve };
}

function enforceExclusiveSessions(
  canvas: ReturnType<typeof editor>,
  afterCallback = async () => {},
) {
  let active = false;
  jest.mocked(openDesign).mockClear();
  jest.mocked(openDesign).mockImplementation((async (
    _options: unknown,
    callback: (session: unknown) => Promise<void>,
  ) => {
    if (active)
      throw new Error("Cannot open design - a session is already open");
    active = true;
    try {
      await callback(canvas);
      await afterCallback();
    } finally {
      active = false;
    }
  }) as typeof openDesign);
}

describe("linked Canva tables", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    jest.mocked(upload).mockResolvedValue({
      ref: "image-ref",
      whenUploaded: jest.fn().mockResolvedValue(undefined),
    } as unknown as Awaited<ReturnType<typeof upload>>);
  });

  it("persists the link in the design and prevents duplicates on the same page", async () => {
    const canvas = editor();
    await insertLinkedTable(data.records, options);
    expect(canvas.elements).toHaveLength(1);
    expect((await readLinkedTable(options.sourceKey)).table?.keys).toEqual([
      "A",
      "B",
    ]);
    await expect(insertLinkedTable(data.records, options)).rejects.toThrow(
      "already has a table",
    );
    expect(canvas.helpers.group).toHaveBeenCalledTimes(1);
    canvas.elements.splice(0);
    expect((await readLinkedTable(options.sourceKey)).table).toBeNull();
    await insertLinkedTable(data.records, options);
    expect(canvas.elements).toHaveLength(1);
  });

  it("updates text and sheet colors while preserving geometry and typography", async () => {
    const canvas = editor();
    await insertLinkedTable(data.records, options);
    const group = canvas.elements[0];
    group.left = 280;
    const children = group.contents.toArray();
    const cell = children[9]; // First record's Notes content.
    canvas.editAsUser(() => {
      cell.left = 200;
      cell.width = 210;
    });
    cell.text.readTextRegions()[0].formatting = {
      fontSize: 18,
      color: "#ff0000",
      fontWeight: "bold",
    };
    const background = children[8];
    background.fill.colorContainer.ref.color = "#123456";
    const records = copyRecords();
    records[0]!.sourceCells!.column_1!.value = "New";
    records[1]!.sourceCells!.column_1!.value = "Filled";
    await updateLinkedTable(options.sourceKey, records);
    expect(canvas.elements).toHaveLength(1);
    expect(canvas.elements[0].left).toBe(280);
    expect(cell.left).toBe(200);
    expect(cell.width).toBe(210);
    expect(cell.text.readPlaintext()).toBe("New");
    expect(cell.text.readTextRegions()[0].formatting).toEqual({
      fontSize: 18,
      color: "#ff0000",
      fontWeight: "bold",
    });
    expect(background.fill.colorContainer.ref.color).toBe("#ffffff");
    expect(children[15].text.readPlaintext()).toBe("Filled");
    expect(canvas.helpers.group).toHaveBeenCalledTimes(2);
    expect(canvas.sync).toHaveBeenCalledTimes(2);
  });

  it("fills an existing image slot without moving or resizing it", async () => {
    const canvas = editor();
    await insertLinkedTable(data.records, options);
    const image = canvas.elements[0].contents.toArray()[11];
    const before = {
      left: image.left,
      top: image.top,
      width: image.width,
      height: image.height,
    };
    const records = copyRecords();
    records[0]!.sourceCells!.column_2!.value = "https://example.com/new.png";
    await updateLinkedTable(options.sourceKey, records);
    expect(image.fill.mediaContainer.ref.imageRef).toBe("image-ref");
    expect(image).toMatchObject(before);
    expect(image.transparency).toBe(0);
  });

  it("replaces text without passing Canva's block attributes to the inline API", async () => {
    const canvas = editor();
    await insertLinkedTable(data.records, options);
    const cell = canvas.elements[0].contents.toArray()[9];
    const formatting = {
      fontRef: "YAFdJjTk5UU:0",
      fontSize: 14,
      textAlign: "start",
      color: "#111111",
      fontWeight: "normal",
      fontStyle: "normal",
      decoration: "none",
      strikethrough: "none",
      link: "",
      listLevel: 0,
      listMarker: "none",
      lineHeightEm: 1.4,
      letterSpacingEm: 0,
    };
    cell.text.readTextRegions()[0].formatting = formatting;
    const records = copyRecords();
    records[0]!.sourceCells!.column_1!.value = "Updated specification";
    await updateLinkedTable(options.sourceKey, records);
    expect(cell.text.replaceText).toHaveBeenCalledWith(
      { index: 0, length: 3 },
      "Updated specification",
    );
    expect(cell.text.formatParagraph).toHaveBeenCalledWith(
      { index: 0, length: "Updated specification".length },
      formatting,
    );
    expect(cell.text.readTextRegions()[0].formatting).toEqual(formatting);
    expect(canvas.sync).toHaveBeenCalledTimes(2);
  });

  it("resizes individual rows and their images while retaining widths, source colors, borders, and the table position", async () => {
    const canvas = editor();
    const records = copyRecords();
    records[0]!.sourceCells!.column_0!.backgroundColor = "#aabbcc";
    records[0]!.sourceCells!.column_2!.value = "https://example.com/A.png";
    await insertLinkedTable(records, options);
    const group = canvas.elements[0];
    group.left = 250;
    group.top = 175;
    const old = group.contents.toArray();
    old[6].fill.colorContainer.ref.color = "#aabbcc";
    old[6].stroke.weight = 3;
    old[11].fill.mediaContainer.ref.flipX = true;
    const width = old[6].width;
    await updateLinkedTable(options.sourceKey, records, {
      rowHeights: { A: 160, B: 80 },
    });
    const updated = canvas.elements[0];
    const cells = updated.contents.toArray();
    expect(canvas.elements).toHaveLength(1);
    expect(updated).toMatchObject({ left: 250, top: 175 });
    expect(cells[6]).toMatchObject({ top: 32, width, height: 160 });
    expect(cells[8].height).toBe(160);
    expect(cells[11]).toMatchObject({ top: 33, height: 158 });
    expect(cells[11].fill.mediaContainer.ref).toMatchObject({
      imageRef: "image-ref",
      flipX: true,
    });
    expect(cells[12]).toMatchObject({ top: 192, height: 80 });
    expect(cells[6].fill.colorContainer.ref.color).toBe("#aabbcc");
    expect(cells[6].stroke.weight).toBe(3);
    expect((await readLinkedTable(options.sourceKey)).rowHeights).toEqual({
      A: 160,
      B: 80,
    });
    expect(canvas.helpers.ungroup).toHaveBeenCalledTimes(1);
    records[0]!.sourceCells!.column_1!.value = "Another update";
    await updateLinkedTable(options.sourceKey, records);
    expect(canvas.elements[0].contents.toArray()[6].height).toBe(160);
    expect(canvas.elements[0].contents.toArray()[9].text.readPlaintext()).toBe(
      "Another update",
    );
  });

  it("updates every selected text field with unchanged keys under Canva's group restrictions", async () => {
    const canvas = editor();
    const source = parseSheetRows(
      ["ID", "Supplier", "Notes"],
      [
        [
          { formattedValue: "A" },
          { formattedValue: "Old supplier" },
          { formattedValue: "Old note" },
        ],
      ],
    );
    await insertLinkedTable(source.records, {
      ...options,
      layout: { columns: source.columns! },
    });
    const records = JSON.parse(
      JSON.stringify(source.records),
    ) as typeof source.records;
    records[0]!.sourceCells!.column_1!.value = "New supplier";
    records[0]!.sourceCells!.column_2!.value = "New note";
    await updateLinkedTable(options.sourceKey, records);
    const children = canvas.elements[0].contents.toArray();
    expect(children[7].text.readPlaintext()).toBe("A");
    expect(children[9].text.readPlaintext()).toBe("New supplier");
    expect(children[11].text.readPlaintext()).toBe("New note");
    expect(canvas.helpers.ungroup).toHaveBeenCalledTimes(1);
    expect(canvas.elements).toHaveLength(1);
  });

  it("resizes placed columns, headers, text, and images without changing row heights or table position", async () => {
    const canvas = editor();
    const records = copyRecords();
    records[0]!.sourceCells!.column_2!.value = "https://example.com/A.png";
    await insertLinkedTable(records, options);
    canvas.elements[0].left = 250;
    canvas.elements[0].top = 175;
    const old = canvas.elements[0].contents.toArray();
    old[9].text.readTextRegions()[0].formatting = {
      fontSize: 18,
      color: "#123456",
      fontWeight: "bold",
    };
    old[10].stroke.weight = 3;
    await updateLinkedTable(options.sourceKey, records, {
      columnWidths: { column_0: 200, column_1: 240, column_2: 120 },
    });
    const table = canvas.elements[0];
    const cells = table.contents.toArray();
    expect(canvas.elements).toHaveLength(1);
    expect(table).toMatchObject({ left: 250, top: 175, width: 560 });
    expect(cells[0]).toMatchObject({ left: 0, width: 200, height: 32 });
    expect(cells[2]).toMatchObject({ left: 200, width: 240 });
    expect(cells[4]).toMatchObject({ left: 440, width: 120 });
    expect(cells[8]).toMatchObject({
      left: 200,
      width: 240,
      height: 96,
      top: 32,
    });
    expect(cells[9]).toMatchObject({ left: 207, width: 226 });
    expect(cells[9].text.readTextRegions()[0].formatting).toEqual({
      fontSize: 18,
      color: "#123456",
      fontWeight: "bold",
    });
    expect(cells[11]).toMatchObject({
      left: 441,
      width: 118,
      height: 94,
      top: 33,
    });
    expect(cells[11].fill.mediaContainer.ref.imageRef).toBe("image-ref");
    expect(cells[10].stroke.weight).toBe(3);
    expect((await readLinkedTable(options.sourceKey)).columnWidths).toEqual({
      column_0: 200,
      column_1: 240,
      column_2: 120,
    });
    await updateLinkedTable(options.sourceKey, records, {
      columnWidths: { column_0: 120, column_1: 120 },
    });
    expect(canvas.elements[0].width).toBe(360); // Hidden connection marker also shrinks.
    expect(canvas.elements[0].contents.toArray()[6].height).toBe(96);
  });

  it("applies column widths and keyed row heights together while records reorder", async () => {
    const canvas = editor();
    await insertLinkedTable(data.records, options);
    const records = copyRecords().reverse();
    records[0]!.sourceCells!.column_1!.value = "Updated B";
    await updateLinkedTable(options.sourceKey, records, {
      columnWidths: { column_0: 200 },
      rowHeights: { A: 160, B: 80 },
    });
    const cells = canvas.elements[0].contents.toArray();
    expect(cells[6]).toMatchObject({
      left: 0,
      width: 200,
      height: 160,
      top: 112,
    });
    expect(cells[12]).toMatchObject({
      left: 0,
      width: 200,
      height: 80,
      top: 32,
    });
    expect(cells[14].left).toBe(200);
    expect(cells[15].text.readPlaintext()).toBe("Updated B");
  });

  it("rejects a column width that would overflow its existing row before editing", async () => {
    const canvas = editor();
    const records = copyRecords();
    records[0]!.sourceCells!.column_1!.value = "Long note ".repeat(12);
    await insertLinkedTable(records, options);
    await expect(
      updateLinkedTable(options.sourceKey, records, {
        columnWidths: { column_1: 72 },
      }),
    ).rejects.toThrow("may not fit");
    expect(canvas.helpers.ungroup).not.toHaveBeenCalled();
    expect(canvas.sync).toHaveBeenCalledTimes(1);
  });

  it("rejects an undersized row before ungrouping or saving", async () => {
    const canvas = editor();
    await insertLinkedTable(data.records, options);
    await expect(
      updateLinkedTable(options.sourceKey, data.records, {
        rowHeights: { A: 32 },
      }),
    ).rejects.toThrow("may not fit");
    expect(canvas.helpers.ungroup).not.toHaveBeenCalled();
    expect(canvas.sync).toHaveBeenCalledTimes(1);
  });

  it.each(["duplicate", "empty", "overflow", "manual edit", "new key"])(
    "rejects %s before saving any update",
    async (scenario) => {
      const canvas = editor();
      await insertLinkedTable(data.records, options);
      const records = copyRecords();
      if (scenario === "new key")
        records[0]!.sourceCells!.column_0!.value = "C";
      if (scenario === "duplicate")
        records[1]!.sourceCells!.column_0!.value = "A";
      if (scenario === "empty") records[0]!.sourceCells!.column_0!.value = "";
      if (scenario === "overflow")
        records[0]!.sourceCells!.column_1!.value = "Very long content ".repeat(
          200,
        );
      if (scenario === "manual edit")
        canvas.editAsUser(() =>
          canvas.elements[0].contents
            .toArray()[9]
            .text.replaceText({}, "Designer edit"),
        );
      await expect(
        updateLinkedTable(options.sourceKey, records),
      ).rejects.toThrow();
      expect(canvas.sync).toHaveBeenCalledTimes(1);
    },
  );

  it("reorders records by key and updates every text/image column on repeated updates", async () => {
    const canvas = editor();
    await insertLinkedTable(data.records, options);
    const children = canvas.elements[0].contents.toArray();
    const rowA = children[6];
    const rowB = children[12];
    const oldATop = rowA.top;
    const oldBTop = rowB.top;
    rowA.fill.colorContainer.ref.color = "#aabbcc";
    const records = copyRecords().reverse();
    records[0]!.sourceCells!.column_1!.value = "Changed B";
    records[1]!.sourceCells!.column_1!.value = "Changed A";
    records[0]!.sourceCells!.column_2!.value = "https://example.com/B.png";
    await updateLinkedTable(options.sourceKey, records);
    expect(rowB.top).toBe(oldATop);
    expect(rowA.top).toBe(oldBTop);
    expect(rowA.fill.colorContainer.ref.color).toBe("#ffffff");
    expect(children[9].text.readPlaintext()).toBe("Changed A");
    expect(children[15].text.readPlaintext()).toBe("Changed B");
    expect(children[17].fill.mediaContainer.ref.imageRef).toBe("image-ref");
    expect(children[17].transparency).toBe(0);
    records[0]!.sourceCells!.column_1!.value = "Changed again";
    await updateLinkedTable(options.sourceKey, records);
    expect(children[15].text.readPlaintext()).toBe("Changed again");
    expect(rowB.top).toBe(oldATop);
    const saved = (await readLinkedTable(options.sourceKey)).table;
    expect(saved?.keys).toEqual(["B", "A"]);
    expect(saved?.cellKeys).toEqual(["A", "B"]);
  });

  it("repairs legacy invisible images even when the source image URL did not change", async () => {
    const canvas = editor();
    const records = copyRecords();
    records[0]!.sourceCells!.column_2!.value = "https://example.com/old.png";
    await insertLinkedTable(records, options);
    const children = canvas.elements[0].contents.toArray();
    const marker = children[children.length - 1];
    const saved = JSON.parse(
      marker.text.readPlaintext().slice("CanvaSync:v1:".length),
    );
    delete saved.renderingVersion;
    delete saved.cellKeys;
    marker.transparency = 0;
    canvas.editAsUser(() =>
      marker.text.replaceText({}, "CanvaSync:v1:" + JSON.stringify(saved)),
    );
    children[11].transparency = 1;
    await updateLinkedTable(options.sourceKey, records);
    expect(children[11].transparency).toBe(0);
    expect(marker.transparency).toBe(1);
    expect(upload).toHaveBeenCalledTimes(1);
  });

  it("waits for image upload completion and leaves the design untouched on delayed failure", async () => {
    const canvas = editor();
    const records = copyRecords();
    records[0]!.sourceCells!.column_2!.value =
      "https://example.com/delayed.png";
    jest.mocked(upload).mockResolvedValue({
      ref: "ref",
      whenUploaded: jest
        .fn()
        .mockRejectedValue(new Error("Image processing failed")),
    } as unknown as Awaited<ReturnType<typeof upload>>);
    await expect(insertLinkedTable(records, options)).rejects.toThrow(
      "Image processing failed",
    );
    expect(canvas.elements).toHaveLength(0);
    expect(canvas.sync).not.toHaveBeenCalled();
  });

  it("does not insert anything when an image upload fails", async () => {
    const canvas = editor();
    const records = copyRecords();
    records[0]!.sourceCells!.column_2!.value = "https://example.com/broken.png";
    jest.mocked(upload).mockRejectedValue(new Error("Upload failed"));
    await expect(insertLinkedTable(records, options)).rejects.toThrow(
      "Upload failed",
    );
    expect(canvas.elements).toHaveLength(0);
    expect(canvas.sync).not.toHaveBeenCalled();
  });

  it("serializes background reads until the SDK has fully closed the previous session", async () => {
    const canvas = editor();
    const closing = deferred();
    const release = deferred();
    let sessions = 0;
    enforceExclusiveSessions(canvas, async () => {
      if (++sessions === 1) {
        closing.resolve();
        await release.promise;
      }
    });
    const first = readLinkedTable(options.sourceKey);
    const second = readLinkedTable(options.sourceKey);
    await closing.promise;
    expect(openDesign).toHaveBeenCalledTimes(1);
    release.resolve();
    const results = await Promise.all([first, second]);
    expect(results.map((result) => result.pageId)).toEqual(["page1", "page1"]);
    expect(openDesign).toHaveBeenCalledTimes(2);
  });

  it("queues polling behind an update's active sync and reads the saved data afterward", async () => {
    const canvas = editor();
    await insertLinkedTable(data.records, options);
    enforceExclusiveSessions(canvas);
    const syncing = deferred();
    const release = deferred();
    canvas.sync.mockImplementationOnce(async () => {
      syncing.resolve();
      await release.promise;
    });
    const records = copyRecords();
    records[0]!.sourceCells!.column_1!.value = "Saved update";
    const update = updateLinkedTable(options.sourceKey, records);
    await syncing.promise;
    const poll = readLinkedTable(options.sourceKey);
    await Promise.resolve();
    expect(openDesign).toHaveBeenCalledTimes(2); // update snapshot, then its write session
    release.resolve();
    const [saved, checked] = await Promise.all([update, poll]);
    expect(checked.table?.values).toEqual(saved.values);
    expect(checked.table?.values).toContain("Saved update");
    expect(openDesign).toHaveBeenCalledTimes(3);
  });

  it("continues processing queued checks after a session fails", async () => {
    const canvas = editor();
    enforceExclusiveSessions(canvas);
    jest.mocked(openDesign).mockRejectedValueOnce(new Error("Session failed"));
    const results = await Promise.allSettled([
      readLinkedTable(options.sourceKey),
      readLinkedTable(options.sourceKey),
    ]);
    expect(results[0]).toMatchObject({
      status: "rejected",
      reason: new Error("Session failed"),
    });
    expect(results[1]).toMatchObject({
      status: "fulfilled",
      value: { pageId: "page1", table: null },
    });
  });

  it("retries a refused session open while Canva finishes cleanup", async () => {
    jest.useFakeTimers();
    try {
      const canvas = editor();
      enforceExclusiveSessions(canvas);
      jest
        .mocked(openDesign)
        .mockRejectedValueOnce(
          new Error(
            "[bad_request]: Cannot open design - a session is already open and only one session can be open at a time.",
          ),
        );
      const pending = readLinkedTable(options.sourceKey);
      await jest.advanceTimersByTimeAsync(100);
      expect((await pending).pageId).toBe("page1");
      expect(openDesign).toHaveBeenCalledTimes(2);
    } finally {
      jest.useRealTimers();
    }
  });

  it("confirms a saved edit without replaying it if the SDK rejects during cleanup", async () => {
    const canvas = editor();
    await insertLinkedTable(data.records, options);
    let sessions = 0;
    enforceExclusiveSessions(canvas, async () => {
      if (++sessions === 2)
        throw new Error("Cannot open design - a session is already open");
    });
    const records = copyRecords();
    records[0]!.sourceCells!.column_1!.value = "Updated once";
    const saved = await updateLinkedTable(options.sourceKey, records);
    expect(saved.values).toContain("Updated once");
    expect(openDesign).toHaveBeenCalledTimes(3);
    expect(canvas.helpers.ungroup).toHaveBeenCalledTimes(1);
    expect(canvas.elements[0].contents.toArray()[9].text.readPlaintext()).toBe(
      "Updated once",
    );
  });

  it("confirms actual saved images and text after an internal save-session error", async () => {
    const canvas = editor();
    await insertLinkedTable(data.records, options);
    let sessions = 0;
    enforceExclusiveSessions(canvas, async () => {
      if (++sessions === 2)
        throw Object.assign(
          new Error("[internal_error]: Something went wrong on our end"),
          { code: "internal_error" },
        );
    });
    const records = copyRecords();
    records[0]!.sourceCells!.column_1!.value = "Verified save";
    records[0]!.sourceCells!.column_2!.value =
      "https://example.com/replacement.png";
    const saved = await updateLinkedTable(options.sourceKey, records, {
      rowHeights: { A: 140 },
    });
    expect(saved.commitId).toBeDefined();
    expect(saved.values).toContain("Verified save");
    expect(
      canvas.elements[0].contents.toArray()[11].fill.mediaContainer.ref
        .imageRef,
    ).toBe("image-ref");
    expect(canvas.helpers.ungroup).toHaveBeenCalledTimes(1);
    expect(canvas.sync).toHaveBeenCalledTimes(2);
    expect(openDesign).toHaveBeenCalledTimes(3);
  });

  it("does not claim success from metadata alone if the saved cell content differs", async () => {
    const canvas = editor();
    await insertLinkedTable(data.records, options);
    let sessions = 0;
    enforceExclusiveSessions(canvas, async () => {
      if (++sessions === 2) {
        canvas.editAsUser(() =>
          canvas.elements[0].contents.toArray()[9].text.replaceText({}, "Old"),
        );
        throw new Error("[internal_error]: Something went wrong on our end");
      }
    });
    const records = copyRecords();
    records[0]!.sourceCells!.column_1!.value = "Not actually saved";
    await expect(updateLinkedTable(options.sourceKey, records)).rejects.toThrow(
      "internal_error",
    );
    expect(canvas.helpers.ungroup).toHaveBeenCalledTimes(1);
    expect(openDesign).toHaveBeenCalledTimes(3);
  });

  it("accepts a completed read when the SDK reports an internal cleanup error", async () => {
    const canvas = editor();
    enforceExclusiveSessions(canvas, async () => {
      throw new Error("[internal_error]: Something went wrong on our end");
    });
    expect((await readLinkedTable(options.sourceKey)).pageId).toBe("page1");
    expect(openDesign).toHaveBeenCalledTimes(1);
  });

  it("keeps the save error when the new commit was not persisted", async () => {
    const canvas = editor();
    await insertLinkedTable(data.records, options);
    const originalChildren = canvas.elements[0].contents.toArray();
    const originalMarkerText =
      originalChildren[originalChildren.length - 1].text.readPlaintext();
    canvas.sync.mockImplementationOnce(async () => {
      const children = canvas.elements[0].contents.toArray();
      canvas.editAsUser(() =>
        children[children.length - 1].text.replaceText({}, originalMarkerText),
      );
      throw new Error("[internal_error]: Save was not persisted");
    });
    const records = copyRecords();
    records[0]!.sourceCells!.column_1!.value = "Unconfirmed update";
    await expect(updateLinkedTable(options.sourceKey, records)).rejects.toThrow(
      "Save was not persisted",
    );
    expect(canvas.helpers.ungroup).toHaveBeenCalledTimes(1);
  });

  it("syncs color-only changes, including clearing a fill to white", async () => {
    const canvas = editor();
    const records = copyRecords();
    records[0]!.sourceCells!.column_1!.backgroundColor = "#ff0000";
    await insertLinkedTable(records, options);
    records[0]!.sourceCells!.column_1!.backgroundColor = "#00ff00";
    await updateLinkedTable(options.sourceKey, records);
    expect(
      canvas.elements[0].contents.toArray()[8].fill.colorContainer.ref.color,
    ).toBe("#00ff00");
    records[0]!.sourceCells!.column_1!.backgroundColor = undefined;
    await updateLinkedTable(options.sourceKey, records);
    expect(
      canvas.elements[0].contents.toArray()[8].fill.colorContainer.ref.color,
    ).toBe("#ffffff");
  });

  it("uses sheet colors even for designer fills on a legacy table without color history", async () => {
    const canvas = editor();
    const records = copyRecords();
    records[0]!.sourceCells!.column_1!.backgroundColor = "#ff0000";
    await insertLinkedTable(records, options);
    const children = canvas.elements[0].contents.toArray();
    const marker = children[children.length - 1];
    const legacy = JSON.parse(
      marker.text.readPlaintext().slice("CanvaSync:v1:".length),
    );
    delete legacy.sourceColors;
    canvas.editAsUser(() =>
      marker.text.replaceText({}, "CanvaSync:v1:" + JSON.stringify(legacy)),
    );
    canvas.elements[0].contents.toArray()[8].fill.colorContainer.ref.color =
      "#abcdef";
    records[0]!.sourceCells!.column_1!.backgroundColor = "#00ff00";
    await updateLinkedTable(options.sourceKey, records);
    expect(
      canvas.elements[0].contents.toArray()[8].fill.colorContainer.ref.color,
    ).toBe("#00ff00");
  });

  it("applies colors by record key when the sheet rows are reordered", async () => {
    const canvas = editor();
    await insertLinkedTable(data.records, options);
    const records = copyRecords().reverse();
    records[0]!.sourceCells!.column_1!.backgroundColor = "#123456";
    await updateLinkedTable(options.sourceKey, records);
    const children = canvas.elements[0].contents.toArray();
    expect(children[14].fill.colorContainer.ref.color).toBe("#123456");
    expect(children[14].top).toBe(32);
    expect(children[8].fill.colorContainer.ref.color).toBe("#ffffff");
  });

  it("does not replace colors when a source fetch returned values without formatting", async () => {
    const canvas = editor();
    const records = copyRecords();
    records[0]!.sourceCells!.column_1!.backgroundColor = "#123456";
    await insertLinkedTable(records, options);
    records[0]!.sourceCells!.column_1!.backgroundColor = undefined;
    const updated = await updateLinkedTable(options.sourceKey, records, {
      hasCellColors: false,
    });
    expect(
      canvas.elements[0].contents.toArray()[8].fill.colorContainer.ref.color,
    ).toBe("#123456");
    expect(updated.sourceColors?.[1]).toBe("#123456");
  });

  it("uploads Drive bytes to Canva while keeping only the original link in the saved table", async () => {
    const canvas = editor();
    const originalFetch = global.fetch;
    jest.mocked(getActiveGoogleToken).mockResolvedValue("secret-token");
    global.fetch = jest.fn().mockResolvedValue({
      ok: true,
      status: 200,
      headers: { get: () => null },
      blob: async () =>
        new Blob([new Uint8Array([1, 2, 3])], { type: "image/png" }),
    });
    try {
      const records = copyRecords();
      const url = "https://drive.google.com/file/d/drive_file/view?usp=sharing";
      records[0]!.sourceCells!.column_2!.value = url;
      const saved = await insertLinkedTable(records, options);
      expect(upload).toHaveBeenCalledWith(
        expect.objectContaining({
          url: "data:image/png;base64,AQID",
          thumbnailUrl: "data:image/png;base64,AQID",
          mimeType: "image/png",
        }),
      );
      expect(saved.values).toContain(url);
      expect(JSON.stringify(saved)).not.toContain("secret-token");
      expect(JSON.stringify(saved)).not.toContain("base64");
      expect(canvas.sync).toHaveBeenCalledTimes(1);
    } finally {
      jest.mocked(getActiveGoogleToken).mockReset();
      global.fetch = originalFetch;
    }
  });

  it("preserves the existing table when a Drive replacement image cannot be downloaded", async () => {
    const canvas = editor();
    await insertLinkedTable(data.records, options);
    const group = canvas.elements[0];
    const originalFetch = global.fetch;
    jest.mocked(getActiveGoogleToken).mockResolvedValue("secret-token");
    global.fetch = jest.fn().mockResolvedValue({ ok: false, status: 403 });
    try {
      const records = copyRecords();
      records[0]!.sourceCells!.column_2!.value =
        "https://drive.google.com/file/d/denied_file/view";
      await expect(
        updateLinkedTable(options.sourceKey, records),
      ).rejects.toThrow("denied access");
      expect(canvas.elements[0]).toBe(group);
      expect(canvas.helpers.ungroup).not.toHaveBeenCalled();
      expect(canvas.sync).toHaveBeenCalledTimes(1);
      expect(upload).not.toHaveBeenCalled();
    } finally {
      jest.mocked(getActiveGoogleToken).mockReset();
      global.fetch = originalFetch;
    }
  });
});
