import {
  fetchPrivateSheetData,
  fetchSheetData,
  parseSheetRows,
} from "./googleSheetsService";

describe("spreadsheet imports", () => {
  afterEach(() => jest.restoreAllMocks());

  it("preserves arbitrary columns, duplicates, empty values, and source order", () => {
    const result = parseSheetRows(
      ["Cost", "Note", "Note", "Image_Slot"],
      [
        [
          { formattedValue: "$12" },
          { formattedValue: "" },
          { formattedValue: "Keep this" },
          { formattedValue: "https://example.com/tile.jpg" },
        ],
        [],
      ],
    );
    expect(result.columns?.map((column) => column.key)).toEqual([
      "column_0",
      "column_1",
      "column_2",
      "column_3",
    ]);
    expect(result.records).toHaveLength(1);
    expect(result.records[0]?.sourceCells?.column_1?.value).toBe("");
    expect(result.records[0]?.sourceCells?.column_2?.value).toBe("Keep this");
    expect(result.columns?.[3]?.kind).toBe("image");
    expect(result.records[0]?.revitId).toBe("");
    expect(result.records[0]?.finishSpec).toBe("");
  });

  it("does not invent colors, IDs, or specifications for unformatted cells", () => {
    const result = parseSheetRows(
      ["Revit_ID", "Finish_Spec"],
      [
        [{ formattedValue: "REV-101" }, { formattedValue: "" }],
        [{ formattedValue: "REV-102" }, { formattedValue: "Concrete" }],
      ],
    );
    expect(result.records.every((record) => !record.badgeColorHex)).toBe(true);
    expect(result.records[0]?.finishSpec).toBe("");
    expect(
      Object.values(result.records[0]?.sourceCells || {}).every(
        (cell) => !cell.backgroundColor,
      ),
    ).toBe(true);
  });

  it("reads colors from their actual columns, including conditional formatting and black", () => {
    const result = parseSheetRows(
      ["Notes", "Revit_ID", "Cost"],
      [
        [
          {
            formattedValue: "Note",
            userEnteredFormat: {
              backgroundColor: { red: 1, green: 0, blue: 0 },
            },
          },
          {
            formattedValue: "P-01",
            userEnteredFormat: { backgroundColor: { red: 1 } },
            effectiveFormat: {
              backgroundColorStyle: { rgbColor: { green: 1 } },
            },
          },
          { formattedValue: "12", userEnteredFormat: { backgroundColor: {} } },
        ],
      ],
    );
    expect(result.records[0]?.badgeColorHex).toBe("#00FF00");
    expect(result.records[0]?.sourceCells?.column_0?.backgroundColor).toBe(
      "#FF0000",
    );
    expect(result.records[0]?.sourceCells?.column_2?.backgroundColor).toBe(
      "#000000",
    );
  });

  it("keeps all public CSV columns without inventing unavailable cell colors", async () => {
    global.fetch = jest.fn().mockResolvedValue({
      ok: true,
      text: async () => 'Supplier,Quantity,Notes\nTiles Inc,12,""',
    });
    const result = await fetchSheetData(
      "https://docs.google.com/spreadsheets/d/example",
      "Materials",
    );
    expect(result.columns?.map((column) => column.title)).toEqual([
      "Supplier",
      "Quantity",
      "Notes",
    ]);
    expect(result.records[0]?.sourceCells?.column_0?.value).toBe("Tiles Inc");
    expect(result.records[0]?.badgeColorHex).toBeUndefined();
  });

  it("keeps columns and blank cells when grid formatting is unavailable", async () => {
    global.fetch = jest
      .fn()
      .mockResolvedValueOnce({ ok: false })
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          values: [
            ["Supplier", "Quantity"],
            ["Tiles Inc", ""],
          ],
        }),
      });
    const result = await fetchPrivateSheetData(
      "https://docs.google.com/spreadsheets/d/example",
      "token",
      "Floor Finishes",
    );
    expect(result.columns).toHaveLength(2);
    expect(result.records[0]?.sourceCells?.column_1?.value).toBe("");
    expect(result.records[0]?.badgeColorHex).toBeUndefined();
    expect(jest.mocked(fetch).mock.calls[1]?.[0]).toContain(
      "'Floor%20Finishes'",
    );
  });
});
