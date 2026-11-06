import { readFileSync } from "node:fs";
import { join } from "node:path";
import {
  extractSpreadsheetInfo,
  fetchSpreadsheetMetadata,
  fetchPrivateSheetData,
  fetchSheetData,
  parseSheetRows,
} from "./googleSheetsService";

describe("spreadsheet imports", () => {
  afterEach(() => jest.restoreAllMocks());

  it("reads Google's actual public grid without importing row labels or freeze bars", async () => {
    global.fetch = jest.fn().mockResolvedValue({
      ok: true,
      text: async () =>
        readFileSync(
          join(__dirname, "__fixtures__/publicSheetGrid.html"),
          "utf8",
        ),
    });
    const result = await fetchSheetData(
      "https://docs.google.com/spreadsheets/d/example/edit#gid=0",
    );
    expect(result.hasCellColors).toBe(true);
    expect(result.columns?.map((column) => column.title)).toEqual([
      "Student Name",
      "Gender",
      "Class Level",
      "Home State",
      "Major",
      "Extracurricular Activity",
    ]);
    expect(result.records).toHaveLength(1);
    expect(result.records[0]?.sourceCells?.column_0?.value).toBe("Alexandra");
  });

  it("imports public sheet fills, including blank cells and merged cells, from the selected tab", async () => {
    global.fetch = jest
      .fn()
      .mockResolvedValueOnce({
        ok: true,
        text: async () =>
          `<ul id="sheet-menu"><li id="sheet-button-0">First</li><li id="sheet-button-73">Materials</li></ul>`,
      })
      .mockResolvedValueOnce({
        ok: true,
        text: async () => `<style>
        .ritz .waffle .s0 { background-color:#aabbcc; }
        .ritz .waffle .s1 { background-color:#ff0000; }
        .ritz .waffle .s2 { background-color:rgb(0, 255, 0); }
        .ritz .waffle .s3 { background-color:#000000; }
        </style><div class="ritz"><table class="waffle"><tbody>
        <tr><th>1</th><td class="s0">ID</td><td class="s0">Note</td><td class="s0">Note</td></tr>
        <tr><th>2</th><td class="s1">P-01</td><td class="s2"></td><td class="s3" style="background-color:#123456">Tile<br>Finish</td></tr>
        <tr><th>3</th><td class="s3">P-02</td><td class="s2" colspan="2">Merged</td></tr>
        </tbody></table></div>`,
      });
    const result = await fetchSheetData(
      "https://docs.google.com/spreadsheets/d/example/edit#gid=0",
      "Materials",
    );
    expect(fetch).toHaveBeenLastCalledWith(
      expect.stringContaining("headers=false&gid=73"),
    );
    expect(result.hasCellColors).toBe(true);
    expect(result.columns?.map((column) => column.backgroundColor)).toEqual([
      "#AABBCC",
      "#AABBCC",
      "#AABBCC",
    ]);
    expect(result.records[0]?.sourceCells).toEqual({
      column_0: { value: "P-01", backgroundColor: "#FF0000" },
      column_1: { value: "", backgroundColor: "#00FF00" },
      column_2: { value: "Tile\nFinish", backgroundColor: "#123456" },
    });
    expect(result.records[1]?.sourceCells?.column_0?.backgroundColor).toBe(
      "#000000",
    );
    expect(result.records[1]?.sourceCells?.column_2).toEqual({
      value: "",
      backgroundColor: "#00FF00",
    });
  });

  it("retains values when the public formatting request fails", async () => {
    global.fetch = jest
      .fn()
      .mockRejectedValueOnce(new Error("Network error"))
      .mockResolvedValueOnce({
        ok: true,
        text: async () => "ID,Note\nP-01,Keep this",
      });
    const result = await fetchSheetData(
      "https://docs.google.com/spreadsheets/d/example/edit#gid=73",
    );
    expect(result.hasCellColors).toBe(false);
    expect(result.records[0]?.sourceCells?.column_1?.value).toBe("Keep this");
    expect(fetch).toHaveBeenLastCalledWith(
      expect.stringContaining("out:csv&gid=73"),
    );
  });

  it("reads the captured response from Google's public sample spreadsheet", async () => {
    global.fetch = jest.fn().mockResolvedValue({
      ok: true,
      text: async () =>
        readFileSync(
          join(__dirname, "__fixtures__/publicSheetViewer.html"),
          "utf8",
        ),
    });
    const result = await fetchSpreadsheetMetadata(
      "https://docs.google.com/spreadsheets/d/1BxiMVs0XRA5nFMdKvBdBZjgmUUqptlbs74OgvE2upms/edit",
    );
    expect(result.title).toBe("Example Spreadsheet");
    expect(result.sheets).toEqual([{ title: "Class Data", sheetId: 0 }]);
  });

  it("discovers tabs from Google's script-generated HTML viewer menu", async () => {
    // The items.push structure and escapes are from Google's public example
    // spreadsheet HTML response. No menu buttons exist until its script runs.
    global.fetch = jest.fn().mockResolvedValue({
      ok: true,
      text: async () => String.raw`<title>Example Spreadsheet - Google Drive</title>
        <script>
          var items = [];items.push({name: "Class Data", pageUrl: "https:\/\/docs.google.com\/spreadsheets\/d\/example\/htmlview\/sheet?headers\x3dtrue&gid=0", gid: "0",initialSheet: ("0" == gid)});
          items.push({name: "Floor \x26 Wall \u2013 \"Tiles\"", pageUrl: "https:\/\/docs.google.com\/spreadsheets\/d\/example\/htmlview\/sheet?headers\x3dtrue&gid=73", gid: "73",initialSheet: ("73" == gid)});
          items.push({name: "Literal \\x26 and O\'Brien", pageUrl: "https:\/\/docs.google.com\/spreadsheets\/d\/example\/htmlview\/sheet?gid=95", gid: "95",initialSheet: ("95" == gid)});
          window.__sheetScriptExecuted = true;
        </script><div id="sheets-viewport"></div>`,
    });
    await expect(
      fetchSpreadsheetMetadata(
        "https://docs.google.com/spreadsheets/d/example",
      ),
    ).resolves.toEqual({
      spreadsheetId: "example",
      title: "Example Spreadsheet",
      sheets: [
        { title: "Class Data", sheetId: 0 },
        { title: 'Floor & Wall – "Tiles"', sheetId: 73 },
        { title: "Literal \\x26 and O'Brien", sheetId: 95 },
      ],
    });
    expect(
      (window as unknown as Record<string, unknown>).__sheetScriptExecuted,
    ).toBeUndefined();
  });

  it("skips malformed script data while retaining other valid tabs", async () => {
    global.fetch = jest.fn().mockResolvedValue({
      ok: true,
      text: async () => String.raw`<script>
        items.push({name: "Bad \q", pageUrl: "?gid=0", gid: "0"});
        items.push({name: "Good", pageUrl: "?gid=42", gid: "42"});
      </script>`,
    });
    const result = await fetchSpreadsheetMetadata(
      "https://docs.google.com/spreadsheets/d/example",
    );
    expect(result.sheets).toEqual([{ title: "Good", sheetId: 42 }]);
  });

  it("discovers every public tab with its actual name and ID", async () => {
    global.fetch = jest.fn().mockResolvedValue({
      ok: true,
      text: async () => `<title>Finishes - Google Sheets</title>
        <ul id="sheet-menu">
          <li id="sheet-button-0" onclick="switchToSheet('12')">Floor &amp; Wall</li>
          <li id="sheet-button-1"><a href="?gid=73">Materials</a></li>
          <li id="sheet-button-95">Summary</li>
        </ul>`,
    });
    await expect(
      fetchSpreadsheetMetadata(
        "https://docs.google.com/spreadsheets/d/example/edit#gid=73",
      ),
    ).resolves.toEqual({
      spreadsheetId: "example",
      title: "Finishes",
      sheets: [
        { title: "Floor & Wall", sheetId: 12 },
        { title: "Materials", sheetId: 73 },
        { title: "Summary", sheetId: 95 },
      ],
    });
    expect(fetch).toHaveBeenCalledWith(
      "https://docs.google.com/spreadsheets/d/example/htmlview",
    );
  });

  it("reports inaccessible tab metadata instead of inventing Sheet1", async () => {
    global.fetch = jest.fn().mockResolvedValue({
      ok: true,
      text: async () => "<html><title>Sign in</title></html>",
    });
    await expect(
      fetchSpreadsheetMetadata(
        "https://docs.google.com/spreadsheets/d/example",
      ),
    ).rejects.toThrow("Please sign in with Google");
  });

  it("uses the Sheets API to list all authenticated tabs", async () => {
    global.fetch = jest.fn().mockResolvedValue({
      ok: true,
      json: async () => ({
        properties: { title: "Finishes" },
        sheets: [
          { properties: { title: "Floor", sheetId: 0 } },
          { properties: { title: "Walls", sheetId: 73 } },
        ],
      }),
    });
    const result = await fetchSpreadsheetMetadata(
      "https://docs.google.com/spreadsheets/d/example",
      "token",
    );
    expect(result.sheets).toEqual([
      { title: "Floor", sheetId: 0 },
      { title: "Walls", sheetId: 73 },
    ]);
    expect(fetch).toHaveBeenCalledWith(
      expect.stringContaining("sheets.googleapis.com"),
      {
        headers: { Authorization: "Bearer token" },
      },
    );
  });

  it.each(["?gid=73", "#gid=73", "?usp=sharing&gid=73"])(
    "reads the tab ID from %s",
    (suffix) => {
      expect(
        extractSpreadsheetInfo(
          `https://docs.google.com/spreadsheets/d/example/edit${suffix}`,
        ).gid,
      ).toBe("73");
    },
  );

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

  it("preserves header and effective body fills from authenticated grid data", async () => {
    global.fetch = jest.fn().mockResolvedValue({
      ok: true,
      json: async () => ({
        sheets: [
          {
            data: [
              {
                rowData: [
                  {
                    values: [
                      {
                        formattedValue: "ID",
                        effectiveFormat: { backgroundColor: { red: 1 } },
                      },
                    ],
                  },
                  {
                    values: [
                      {
                        formattedValue: "P-01",
                        userEnteredFormat: { backgroundColor: { red: 1 } },
                        effectiveFormat: {
                          backgroundColorStyle: { rgbColor: { green: 1 } },
                        },
                      },
                    ],
                  },
                ],
              },
            ],
          },
        ],
      }),
    });
    const result = await fetchPrivateSheetData(
      "https://docs.google.com/spreadsheets/d/example",
      "token",
      "Materials",
    );
    expect(result.hasCellColors).toBe(true);
    expect(result.columns?.[0]?.backgroundColor).toBe("#FF0000");
    expect(result.records[0]?.sourceCells?.column_0?.backgroundColor).toBe(
      "#00FF00",
    );
  });
});
