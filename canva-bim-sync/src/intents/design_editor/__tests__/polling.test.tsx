import { act, fireEvent, screen } from "@testing-library/react";
import { Button } from "@canva/app-ui-kit";
import { App } from "../app";
import { renderInTestProvider } from "../../../utils/test_render";
import {
  fetchSheetData,
  parseSheetRows,
} from "../../../services/googleSheetsService";
import type { BimRoomRecord } from "../../../types/bim";

jest.mock("../../../services/googleAuthService", () => ({
  checkIsGoogleAuthenticated: jest.fn().mockResolvedValue(false),
  getActiveGoogleToken: jest.fn().mockResolvedValue(null),
}));
jest.mock("../../../services/googleSheetsService", () => ({
  ...jest.requireActual("../../../services/googleSheetsService"),
  fetchSheetData: jest.fn(),
}));
jest.mock("../../../components/SheetConnector", () => ({
  SheetConnector: ({
    onConnect,
  }: {
    onConnect: (url: string, tab: string) => Promise<void>;
  }) => (
    <Button
      variant="secondary"
      onClick={() =>
        void onConnect("https://docs.google.com/spreadsheets/d/test", "Data")
      }
    >
      {connectLabel}
    </Button>
  ),
}));
const connectLabel = "Connect test sheet";
jest.mock("../../../components/ScheduleTableManager", () => ({
  ScheduleTableManager: ({ records }: { records: BimRoomRecord[] }) => (
    <div>{records[0]?.sourceCells?.column_1?.value}</div>
  ),
}));

const data = parseSheetRows(
  ["ID", "Notes"],
  [[{ formattedValue: "A" }, { formattedValue: "Original data" }]],
);

describe("automatic source checks", () => {
  beforeEach(() => {
    jest.useFakeTimers();
    jest.clearAllMocks();
    jest.mocked(fetchSheetData).mockResolvedValue(data);
    Object.defineProperty(document, "visibilityState", {
      configurable: true,
      value: "visible",
    });
  });
  afterEach(() => jest.useRealTimers());

  it("checks every 30 seconds, skips hidden panels, and checks on return", async () => {
    renderInTestProvider(<App />);
    await act(async () => {
      fireEvent.click(
        screen.getByRole("button", { name: "Connect test sheet" }),
      );
    });
    expect(fetchSheetData).toHaveBeenCalledTimes(1);
    await act(async () => {
      jest.advanceTimersByTime(30000);
    });
    expect(fetchSheetData).toHaveBeenCalledTimes(2);
    Object.defineProperty(document, "visibilityState", {
      configurable: true,
      value: "hidden",
    });
    await act(async () => {
      jest.advanceTimersByTime(60000);
    });
    expect(fetchSheetData).toHaveBeenCalledTimes(2);
    Object.defineProperty(document, "visibilityState", {
      configurable: true,
      value: "visible",
    });
    await act(async () => {
      document.dispatchEvent(new Event("visibilitychange"));
    });
    expect(fetchSheetData).toHaveBeenCalledTimes(3);
  });

  it("retains the last loaded preview when a background check fails", async () => {
    renderInTestProvider(<App />);
    await act(async () => {
      fireEvent.click(
        screen.getByRole("button", { name: "Connect test sheet" }),
      );
    });
    jest
      .mocked(fetchSheetData)
      .mockRejectedValueOnce(new Error("Connection lost"));
    await act(async () => {
      jest.advanceTimersByTime(30000);
    });
    expect(screen.getByText("Original data")).toBeDefined();
    expect(screen.getByText("Connection lost")).toBeDefined();
  });
});
