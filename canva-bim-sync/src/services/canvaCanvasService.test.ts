import { upload } from "@canva/asset";
import { addElementAtCursor, addElementAtPoint } from "@canva/design";
import type { BimRoomRecord } from "../types/bim";
import {
  buildEditableSchedule,
  injectScheduleTable,
} from "./canvaCanvasService";

const records: BimRoomRecord[] = Array.from({ length: 5 }, (_, index) => ({
  revitId: `REV-${101 + index}`,
  roomName: `Room ${index}`,
  areaLabel: "",
  finishSpec: index === 0 ? "Walnut & Veneer" : "Polished Concrete",
  imageUrl: `https://example.com/material-${index}.jpg`,
  badgeColorHex: index === 0 ? "#6AA84F" : "#6FA8DC",
}));

describe("finish schedule layout", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    jest.mocked(upload).mockImplementation(
      async (options) =>
        ({
          ref: options.type === "image" ? options.name : undefined,
        }) as Awaited<ReturnType<typeof upload>>,
    );
    jest.mocked(addElementAtPoint).mockResolvedValue(undefined);
  });

  it("creates editable cell shapes and original text rather than a table image", () => {
    const table = buildEditableSchedule(records);
    expect(
      table.children.every(
        (element) => element.type === "shape" || element.type === "text",
      ),
    ).toBe(true);
    const texts = table.children.filter((element) => element.type === "text");
    expect(texts.slice(0, 3).map((element) => element.children[0])).toEqual([
      "Revit_ID",
      "Image_Slot",
      "Finish_Spec",
    ]);
    expect(
      texts.find((element) => element.children[0] === "Walnut & Veneer"),
    ).toMatchObject({ type: "text", left: 347, width: 226 });
    expect(
      texts.find((element) => element.children[0] === "REV-101"),
    ).toMatchObject({ type: "text", left: 7, width: 146 });
    const shapes = table.children.filter((element) => element.type === "shape");
    expect(shapes).toHaveLength((records.length + 1) * 3);
    expect(
      shapes.find((element) => element.top === 32 && element.left === 0),
    ).toMatchObject({
      type: "shape",
      width: 160,
      height: 96,
      paths: [{ fill: { color: "#6AA84F" }, stroke: { weight: 1 } }],
    });
  });

  it("inserts all images inside their matching rows in one group", async () => {
    const result = await injectScheduleTable(records, { includeImages: true });
    expect(result.imagesCount).toBe(5);
    expect(addElementAtPoint).toHaveBeenCalledTimes(1);
    const element = jest.mocked(addElementAtPoint).mock.calls[0]![0];
    expect(element.type).toBe("group");
    if (element.type !== "group") throw new Error("Expected grouped schedule");
    const images = element.children.filter((child) => child.type === "image");
    expect(images).toHaveLength(5);
    expect(upload).toHaveBeenCalledTimes(5);
    images.forEach((image, index) => {
      expect(image).toMatchObject({
        type: "image",
        ref: `${records[index]!.revitId}_material`,
        left: 161,
        top: 33 + index * 96,
        width: 178,
        height: 94,
      });
    });
    expect(addElementAtCursor).not.toHaveBeenCalled();
  });

  it("keeps empty and failed image cells from shifting later images", async () => {
    jest.mocked(upload).mockImplementation(async (options) => {
      if (
        (options.type === "image" ? options.name : undefined) ===
        "REV-102_material"
      )
        throw new Error("Image unavailable");
      return {
        ref: options.type === "image" ? options.name : undefined,
      } as Awaited<ReturnType<typeof upload>>;
    });
    const rows = records.map((record, index) =>
      index === 0 ? { ...record, imageUrl: "" } : record,
    );
    const result = await injectScheduleTable(rows, { includeImages: true });
    expect(result.imagesCount).toBe(3);
    const element = jest.mocked(addElementAtPoint).mock.calls[0]![0];
    if (element.type !== "group") throw new Error("Expected grouped schedule");
    expect(
      element.children.find((child) => child.type === "image"),
    ).toMatchObject({
      ref: "REV-103_material",
      top: 225,
    });
  });

  it("positions images using expanded rows for multiline specifications", async () => {
    const rows = [
      { ...records[0]!, finishSpec: "Line\n".repeat(8) },
      records[1]!,
    ];
    const table = buildEditableSchedule(rows);
    await injectScheduleTable(rows, { includeImages: true });
    const element = jest.mocked(addElementAtPoint).mock.calls[0]![0];
    if (element.type !== "group") throw new Error("Expected grouped schedule");
    expect(table.imageSlots[1]!.top).toBeGreaterThan(129);
    expect(
      element.children.filter((child) => child.type === "image")[1],
    ).toMatchObject({
      left: table.imageSlots[1]!.left,
      top: table.imageSlots[1]!.top,
      width: table.imageSlots[1]!.width,
      height: table.imageSlots[1]!.height,
    });
    const spec = element.children.find(
      (child) =>
        child.type === "text" && child.children[0] === rows[0]!.finishSpec,
    );
    expect(spec).toMatchObject({ children: [rows[0]!.finishSpec] });
  });

  it("omits images when unchecked", async () => {
    const result = await injectScheduleTable(records, { includeImages: false });
    expect(result.imagesCount).toBe(0);
    expect(upload).not.toHaveBeenCalled();
    expect(addElementAtPoint).toHaveBeenCalledWith(
      expect.objectContaining({ type: "group", width: 580 }),
    );
    const element = jest.mocked(addElementAtPoint).mock.calls[0]![0];
    if (element.type !== "group") throw new Error("Expected grouped schedule");
    expect(element.children.some((child) => child.type === "image")).toBe(
      false,
    );
    expect(element.children.some((child) => child.type === "text")).toBe(true);
  });

  it("does not detach images if grouped insertion fails", async () => {
    jest
      .mocked(addElementAtPoint)
      .mockRejectedValue(new Error("Unsupported design"));
    await expect(
      injectScheduleTable(records, { includeImages: true }),
    ).rejects.toThrow("Unsupported design");
    expect(addElementAtCursor).not.toHaveBeenCalled();
  });
  it("resizes rows and columns independently, including their images", () => {
    const table = buildEditableSchedule(records, {
      columns: [
        { key: "revitId", title: "ID", kind: "text" },
        { key: "imageUrl", title: "Image", kind: "image" },
        { key: "finishSpec", title: "Finish", kind: "text" },
      ],
      columnWidths: { revitId: 100, imageUrl: 220, finishSpec: 300 },
      rowHeights: { 0: 160, 1: 64 },
    });
    expect(table.width).toBe(620);
    expect(table.imageSlots[0]).toMatchObject({
      left: 101,
      top: 33,
      width: 218,
      height: 158,
    });
    expect(table.imageSlots[1]).toMatchObject({
      left: 101,
      top: 193,
      width: 218,
      height: 62,
    });
    expect(table.imageSlots[2]).toMatchObject({ top: 257, height: 94 });
  });

  it("imports arbitrary selected columns in the chosen order with source colors only", () => {
    const row = {
      ...records[0]!,
      badgeColorHex: undefined,
      sourceCells: {
        cost: { value: "$45", backgroundColor: "#FFEEDD" },
        notes: { value: "" },
        ignored: { value: "Do not import" },
      },
    };
    const table = buildEditableSchedule([row], {
      columns: [
        { key: "notes", title: "Notes", kind: "text" },
        { key: "cost", title: "Unit cost", kind: "text" },
      ],
    });
    const texts = table.children.filter((child) => child.type === "text");
    expect(texts.map((child) => child.children[0])).toEqual([
      "Notes",
      "Unit cost",
      "$45",
    ]);
    const shapes = table.children.filter((child) => child.type === "shape");
    expect(
      shapes.find((shape) => shape.top === 32 && shape.left === 0)?.paths[0]
        ?.fill.color,
    ).toBe("#FFFFFF");
    expect(
      shapes.find((shape) => shape.top === 32 && shape.left === 160)?.paths[0]
        ?.fill.color,
    ).toBe("#FFEEDD");
  });
});
