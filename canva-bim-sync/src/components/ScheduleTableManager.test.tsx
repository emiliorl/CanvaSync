import { act, fireEvent, screen, waitFor } from "@testing-library/react";
import { ScheduleTableManager } from "./ScheduleTableManager";
import { useTranslations } from "../utils/i18n";
import { renderInTestProvider } from "../utils/test_render";
import {
  insertLinkedTable,
  readLinkedTable,
  updateLinkedTable,
  linkedValues,
} from "../services/linkedTableService";
import { parseSheetRows } from "../services/googleSheetsService";

jest.mock("../services/linkedTableService", () => ({
  ...jest.requireActual("../services/linkedTableService"),
  insertLinkedTable: jest.fn(),
  readLinkedTable: jest.fn(),
  updateLinkedTable: jest.fn(),
}));

const data = parseSheetRows(
  ["ID", "Supplier", "Notes"],
  [
    [
      { formattedValue: "P-01" },
      { formattedValue: "Tiles Inc" },
      { formattedValue: "" },
    ],
    [
      { formattedValue: "P-02" },
      { formattedValue: "Stone Inc" },
      { formattedValue: "Exterior" },
    ],
  ],
);
const success = jest.fn();
const refresh = jest.fn().mockResolvedValue(undefined);
const error = jest.fn();
function Harness() {
  const t = useTranslations();
  return (
    <ScheduleTableManager
      t={t}
      records={data.records}
      columns={data.columns}
      sourceKey="test"
      onSuccess={success}
      onError={error}
      onRefresh={refresh}
    />
  );
}

describe("column selection and table sizing", () => {
  beforeEach(() => {
    localStorage.clear();
    jest.clearAllMocks();
    jest
      .mocked(readLinkedTable)
      .mockResolvedValue({ pageId: "page1", table: null });
    jest
      .mocked(insertLinkedTable)
      .mockImplementation(async (records, options) => ({
        ...options,
        keys: ["P-01", "P-02"],
        values: linkedValues(records, options.layout),
        imageAssets: {},
        time: Date.now(),
      }));
    refresh.mockResolvedValue(data);
  });

  it("imports chosen columns, their order, and independent row/column dimensions", async () => {
    renderInTestProvider(<Harness />);
    await waitFor(() =>
      expect(
        screen
          .getByRole("button", { name: "Insert table" })
          .getAttribute("aria-disabled"),
      ).not.toBe("true"),
    );
    fireEvent.click(screen.getAllByRole("combobox")[0]!);
    fireEvent.click(await screen.findByRole("option", { name: "Notes" }));
    fireEvent.keyDown(screen.getAllByRole("combobox")[0]!, { key: "Escape" });
    fireEvent.click(screen.getByText("Table dimensions"));
    fireEvent.click(screen.getByText("Column widths"));
    fireEvent.click(screen.getByText("Row heights"));
    fireEvent.change(screen.getAllByLabelText("Width (px)")[0]!, {
      target: { value: "220" },
    });
    fireEvent.change(screen.getByLabelText("Row 1 (P-01)"), {
      target: { value: "140" },
    });
    fireEvent.click(
      screen.getAllByRole("button", { name: "Move column left" })[1]!,
    );
    fireEvent.click(screen.getByRole("button", { name: "Insert table" }));
    await waitFor(() => expect(insertLinkedTable).toHaveBeenCalledTimes(1));
    const options = jest.mocked(insertLinkedTable).mock.calls[0]?.[1];
    expect(options?.layout?.columns.map((column) => column.title)).toEqual([
      "Supplier",
      "ID",
    ]);
    expect(options?.layout?.columnWidths).toEqual({ column_0: 220 });
    expect(options?.layout?.rowHeights).toEqual({ 0: 140 });
    await waitFor(() => expect(success).toHaveBeenCalled());
  });

  it("prevents importing an empty selection", async () => {
    renderInTestProvider(<Harness />);
    await waitFor(() =>
      expect(
        screen.getAllByRole("combobox")[0]!.getAttribute("aria-disabled"),
      ).not.toBe("true"),
    );
    fireEvent.click(screen.getAllByRole("combobox")[0]!);
    for (const title of ["ID", "Supplier", "Notes"])
      fireEvent.click(await screen.findByRole("option", { name: title }));
    expect(
      screen.getByText("Select at least one column to import."),
    ).toBeDefined();
    const insert = screen.getByRole("button", { name: "Insert table" });
    expect(
      insert.hasAttribute("disabled") ||
        insert.getAttribute("aria-disabled") === "true",
    ).toBe(true);
    fireEvent.click(insert);
    expect(insertLinkedTable).not.toHaveBeenCalled();
  });

  it("disables insertion while a linked table exists, then re-enables after deletion", async () => {
    jest.useFakeTimers();
    const table = await insertLinkedTable(data.records, {
      sourceKey: "test",
      layout: { columns: data.columns! },
      includeImages: false,
      keyColumn: "column_0",
    });
    jest.mocked(insertLinkedTable).mockClear();
    jest.mocked(readLinkedTable).mockResolvedValue({ pageId: "page1", table });
    renderInTestProvider(<Harness />);
    await act(async () => {});
    const insert = screen.getByRole("button", { name: "Insert table" });
    expect(
      insert.getAttribute("aria-disabled") === "true" ||
        insert.hasAttribute("disabled"),
    ).toBe(true);
    jest
      .mocked(readLinkedTable)
      .mockResolvedValue({ pageId: "page1", table: null });
    await act(async () => {
      jest.advanceTimersByTime(3000);
    });
    expect(insert.getAttribute("aria-disabled")).not.toBe("true");
    expect(insert.hasAttribute("disabled")).toBe(false);
    jest.useRealTimers();
  });

  it("fetches fresh source data before updating the linked table", async () => {
    const table = await insertLinkedTable(data.records, {
      sourceKey: "test",
      layout: { columns: data.columns! },
      includeImages: false,
      keyColumn: "column_0",
    });
    jest.mocked(readLinkedTable).mockResolvedValue({ pageId: "page1", table });
    jest.mocked(updateLinkedTable).mockResolvedValue(table);
    renderInTestProvider(<Harness />);
    await waitFor(() =>
      expect(
        screen
          .getByRole("button", { name: "Update table" })
          .getAttribute("aria-disabled"),
      ).not.toBe("true"),
    );
    fireEvent.click(screen.getByRole("button", { name: "Update table" }));
    await waitFor(() =>
      expect(updateLinkedTable).toHaveBeenCalledWith("test", data.records),
    );
    expect(refresh.mock.invocationCallOrder[0]).toBeLessThan(
      jest.mocked(updateLinkedTable).mock.invocationCallOrder[0]!,
    );
    await waitFor(() =>
      expect(success).toHaveBeenCalledWith(
        "Updated the existing table in Canva.",
      ),
    );
  });

  it("enables existing row heights and applies changes by stable record key", async () => {
    const table = await insertLinkedTable(data.records, {
      sourceKey: "test",
      layout: { columns: data.columns! },
      includeImages: false,
      keyColumn: "column_0",
    });
    jest.mocked(readLinkedTable).mockResolvedValue({
      pageId: "page1",
      table,
      rowHeights: { "P-01": 120, "P-02": 73.63434466720345 },
    });
    jest.mocked(updateLinkedTable).mockResolvedValue(table);
    renderInTestProvider(<Harness />);
    await waitFor(() =>
      expect(
        screen
          .getByRole("button", { name: "Update table" })
          .getAttribute("aria-disabled"),
      ).not.toBe("true"),
    );
    fireEvent.click(screen.getByText("Table dimensions"));
    const height = screen.getByLabelText("Row 1 (P-01)") as HTMLInputElement;
    expect(height.value).toBe("120");
    expect(height.disabled).toBe(false);
    expect(
      (screen.getByLabelText("Row 2 (P-02)") as HTMLInputElement).value,
    ).toBe("73.6");
    fireEvent.change(height, { target: { value: "160" } });
    fireEvent.click(screen.getByRole("button", { name: "Update table" }));
    await waitFor(() =>
      expect(updateLinkedTable).toHaveBeenCalledWith("test", data.records, {
        rowHeights: { "P-01": 160 },
      }),
    );
  });

  it("keeps the linked-table panel compact without extra color-sync controls", async () => {
    const table = await insertLinkedTable(data.records, {
      sourceKey: "test",
      layout: { columns: data.columns! },
      includeImages: false,
      keyColumn: "column_0",
    });
    jest.mocked(readLinkedTable).mockResolvedValue({ pageId: "page1", table });
    jest.mocked(updateLinkedTable).mockResolvedValue(table);
    renderInTestProvider(<Harness />);
    await waitFor(() =>
      expect(
        screen
          .getByRole("button", { name: "Update table" })
          .getAttribute("aria-disabled"),
      ).not.toBe("true"),
    );
    expect(screen.queryByText(/Checks for sheet changes every/)).toBeNull();
    expect(screen.queryByText(/Sheet last checked at/)).toBeNull();
    expect(screen.queryByText("Synced")).toBeNull();
    expect(
      screen.getByText("Columns and import options").closest("details")?.open,
    ).toBe(false);
    fireEvent.click(screen.getByText("Columns and import options"));
    expect(
      screen.queryByLabelText("Use sheet colors for all cells"),
    ).toBeNull();
    fireEvent.click(screen.getByRole("button", { name: "Update table" }));
    await waitFor(() =>
      expect(updateLinkedTable).toHaveBeenCalledWith("test", data.records),
    );
  });

  it("enables placed column widths and submits only changed widths with pending row heights", async () => {
    const table = await insertLinkedTable(data.records, {
      sourceKey: "test",
      layout: { columns: data.columns! },
      includeImages: false,
      keyColumn: "column_0",
    });
    jest.mocked(readLinkedTable).mockResolvedValue({
      pageId: "page1",
      table,
      columnWidths: { column_0: 132.365, column_1: 180, column_2: 210 },
      rowHeights: { "P-01": 120, "P-02": 80 },
    });
    jest.mocked(updateLinkedTable).mockResolvedValue(table);
    renderInTestProvider(<Harness />);
    await waitFor(() =>
      expect(
        screen
          .getByRole("button", { name: "Update table" })
          .getAttribute("aria-disabled"),
      ).not.toBe("true"),
    );
    fireEvent.click(screen.getByText("Table dimensions"));
    const widths = screen.getAllByLabelText("Width (px)") as HTMLInputElement[];
    expect(widths[0]?.disabled).toBe(false);
    expect(widths[0]?.value).toBe("132.4");
    expect(widths[1]?.value).toBe("180");
    fireEvent.change(widths[1]!, { target: { value: "240" } });
    fireEvent.change(screen.getByLabelText("Row 1 (P-01)"), {
      target: { value: "160" },
    });
    fireEvent.click(screen.getByRole("button", { name: "Update table" }));
    await waitFor(() =>
      expect(updateLinkedTable).toHaveBeenCalledWith("test", data.records, {
        columnWidths: { column_1: 240 },
        rowHeights: { "P-01": 160 },
      }),
    );
  });

  it("collapses widths and heights independently without discarding changes", async () => {
    renderInTestProvider(<Harness />);
    await waitFor(() =>
      expect(
        screen
          .getByRole("button", { name: "Insert table" })
          .getAttribute("aria-disabled"),
      ).not.toBe("true"),
    );
    fireEvent.click(screen.getByText("Table dimensions"));
    const widthSummary = screen.getByText("Column widths");
    const heightSummary = screen.getByText("Row heights");
    const widthSection = widthSummary.closest("details")!;
    const heightSection = heightSummary.closest("details")!;
    expect(widthSection).not.toBe(heightSection);
    expect(widthSection.open).toBe(false);
    expect(heightSection.open).toBe(false);
    fireEvent.click(widthSummary);
    fireEvent.click(heightSummary);
    fireEvent.change(screen.getAllByLabelText("Width (px)")[0]!, {
      target: { value: "220" },
    });
    fireEvent.change(screen.getByLabelText("Row 1 (P-01)"), {
      target: { value: "140" },
    });
    fireEvent.click(widthSummary);
    expect(widthSection.open).toBe(false);
    expect(heightSection.open).toBe(true);
    fireEvent.click(heightSummary);
    fireEvent.click(widthSummary);
    expect(
      (screen.getAllByLabelText("Width (px)")[0] as HTMLInputElement).value,
    ).toBe("220");
    expect(
      (screen.getByLabelText("Row 1 (P-01)") as HTMLInputElement).value,
    ).toBe("140");
  });

  it("recovers background check errors without leaving a stale global error after a saved update", async () => {
    jest.useFakeTimers();
    try {
      const table = await insertLinkedTable(data.records, {
        sourceKey: "test",
        layout: { columns: data.columns! },
        includeImages: false,
        keyColumn: "column_0",
      });
      jest
        .mocked(readLinkedTable)
        .mockResolvedValue({ pageId: "page1", table });
      renderInTestProvider(<Harness />);
      await act(async () => {});
      jest
        .mocked(readLinkedTable)
        .mockRejectedValue(
          new Error("[internal_error]: Something went wrong on our end"),
        );
      await act(async () => {
        jest.advanceTimersByTime(3000);
      });
      expect(screen.queryByRole("alert")).toBeNull();
      expect(error).not.toHaveBeenCalled();
      await act(async () => {
        await jest.advanceTimersByTimeAsync(6000);
      });
      expect(
        screen.getByText(
          "Canva is temporarily unavailable. We will check the table again automatically.",
        ),
      ).toBeDefined();
      jest
        .mocked(readLinkedTable)
        .mockResolvedValue({ pageId: "page1", table });
      await act(async () => {
        jest.advanceTimersByTime(3000);
      });
      expect(
        screen.queryByText(
          "Canva is temporarily unavailable. We will check the table again automatically.",
        ),
      ).toBeNull();
      expect(error).not.toHaveBeenCalled();
    } finally {
      jest.useRealTimers();
    }
  });
});
