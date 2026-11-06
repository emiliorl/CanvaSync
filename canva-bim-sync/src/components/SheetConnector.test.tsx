import { fireEvent, screen, waitFor } from "@testing-library/react";
import { requestOpenExternalUrl } from "@canva/platform";
import { SheetConnector } from "./SheetConnector";
import { renderInTestProvider } from "../utils/test_render";
import { useTranslations } from "../utils/i18n";
import { saveRecentSpreadsheet } from "../services/googleSheetsService";

const refresh = jest.fn();
const error = jest.fn();
const inspect = jest.fn();
const connect = jest.fn();
function Harness({ loading = false }: { loading?: boolean }) {
  const t = useTranslations();
  return (
    <SheetConnector
      t={t}
      onConnect={connect}
      onInspectSheets={inspect}
      onSignInGoogle={jest.fn()}
      isAuthenticatedGoogle={false}
      isLoading={loading}
      availableTabs={[{ title: "Presentation_View", sheetId: 22 }]}
      selectedTab="Presentation_View"
      onTabChange={jest.fn()}
      hasLoadedRecords
      sheetUrl="https://docs.google.com/spreadsheets/d/test/edit#gid=22"
      onRefresh={refresh}
      onError={error}
    />
  );
}
describe("sheet tab actions", () => {
  beforeEach(() => {
    localStorage.clear();
    saveRecentSpreadsheet({
      id: "test",
      title: "Test spreadsheet",
      url: "https://docs.google.com/spreadsheets/d/test",
    });
    jest.clearAllMocks();
    refresh.mockResolvedValue(undefined);
    inspect.mockResolvedValue([
      { title: "Floor", sheetId: 0 },
      { title: "Walls", sheetId: 73 },
    ]);
    connect.mockResolvedValue(undefined);
  });
  it("loads a pasted link's selected tab after discovering the workbook", async () => {
    renderInTestProvider(<Harness />);
    fireEvent.click(screen.getByRole("button", { name: /paste.*link/i }));
    const url = "https://docs.google.com/spreadsheets/d/example/edit?gid=73";
    fireEvent.change(screen.getByRole("textbox"), { target: { value: url } });
    await waitFor(() => expect(connect).toHaveBeenCalledWith(url, "Walls"));
    expect(inspect).toHaveBeenCalledTimes(1);
  });

  it("does not load a made-up tab when discovery fails", async () => {
    inspect.mockResolvedValueOnce([]);
    renderInTestProvider(<Harness />);
    fireEvent.click(screen.getByRole("button", { name: /paste.*link/i }));
    fireEvent.change(screen.getByRole("textbox"), {
      target: { value: "https://docs.google.com/spreadsheets/d/example" },
    });
    await waitFor(() => expect(inspect).toHaveBeenCalledTimes(1));
    expect(connect).not.toHaveBeenCalled();
  });
  it("opens the selected sheet tab from its adjacent icon", async () => {
    renderInTestProvider(<Harness />);
    const select = screen.getByRole("group", { name: "Select Spreadsheet" });
    const button = screen.getByRole("button", { name: "Open sheet" });
    expect(select.contains(button)).toBe(true);
    expect(
      screen.getByRole("group", { name: "Select sheet tab" }).contains(button),
    ).toBe(false);
    fireEvent.click(button);
    await waitFor(() =>
      expect(requestOpenExternalUrl).toHaveBeenCalledWith({
        url: "https://docs.google.com/spreadsheets/d/test/edit#gid=22",
      }),
    );
    expect(refresh).not.toHaveBeenCalled();
  });
  it("checks source changes from the reload icon", async () => {
    renderInTestProvider(<Harness />);
    const reload = screen.getByRole("button", { name: "Check for changes" });
    expect(
      screen.getByRole("group", { name: "Select sheet tab" }).contains(reload),
    ).toBe(true);
    expect(
      screen
        .getByRole("group", { name: "Select Spreadsheet" })
        .contains(reload),
    ).toBe(false);
    fireEvent.click(reload);
    await waitFor(() => expect(refresh).toHaveBeenCalledTimes(1));
    expect(requestOpenExternalUrl).not.toHaveBeenCalled();
  });
  it("reports a failed manual check", async () => {
    refresh.mockRejectedValueOnce(new Error("Offline"));
    renderInTestProvider(<Harness />);
    fireEvent.click(screen.getByRole("button", { name: "Check for changes" }));
    await waitFor(() => expect(error).toHaveBeenCalledWith("Offline"));
  });
});
