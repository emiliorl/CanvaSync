import { fireEvent, screen, waitFor } from "@testing-library/react";
import { requestOpenExternalUrl } from "@canva/platform";
import { SheetConnector } from "./SheetConnector";
import { renderInTestProvider } from "../utils/test_render";
import { useTranslations } from "../utils/i18n";
import { saveRecentSpreadsheet } from "../services/googleSheetsService";

const refresh = jest.fn();
const error = jest.fn();
function Harness({ loading = false }: { loading?: boolean }) {
  const t = useTranslations();
  return (
    <SheetConnector
      t={t}
      onConnect={jest.fn()}
      onInspectSheets={jest.fn()}
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
