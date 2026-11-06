import { screen, waitFor } from "@testing-library/react";
import { SheetImagePreview } from "./SheetImagePreview";
import { renderInTestProvider } from "../utils/test_render";
import { resolveImageSource } from "../services/imageSourceService";
jest.mock("../services/imageSourceService", () => ({
  resolveImageSource: jest.fn(),
}));
const photoLabel = "Photo";
describe("Drive image preview", () => {
  beforeEach(() => jest.clearAllMocks());
  it("uses resolved image bytes instead of a Drive viewer URL", async () => {
    jest.mocked(resolveImageSource).mockResolvedValue({
      url: "data:image/png;base64,AQID",
      thumbnailUrl: "data:image/png;base64,AQID",
      mimeType: "image/png",
    });
    renderInTestProvider(
      <SheetImagePreview
        url="https://drive.google.com/file/d/file_123/view"
        label={photoLabel}
      />,
    );
    await waitFor(() =>
      expect(screen.getByRole("img").style.backgroundImage).toContain(
        "data:image/png;base64,AQID",
      ),
    );
    expect(screen.getByRole("img").getAttribute("aria-busy")).toBe("false");
  });
  it("shows an actionable preview error", async () => {
    jest
      .mocked(resolveImageSource)
      .mockRejectedValue(new Error("Sign in to Google"));
    renderInTestProvider(
      <SheetImagePreview
        url="https://drive.google.com/file/d/file_123/view"
        label={photoLabel}
      />,
    );
    expect(await screen.findByText("Sign in to Google")).toBeDefined();
  });

  it("retries failed previews after a sheet check and reuses successful previews", async () => {
    jest
      .mocked(resolveImageSource)
      .mockRejectedValueOnce(new Error("Permission required"));
    const url = "https://drive.google.com/file/d/file_123/view";
    const view = renderInTestProvider(
      <SheetImagePreview url={url} label={photoLabel} refreshKey={{}} />,
    );
    await screen.findByText("Permission required");
    jest
      .mocked(resolveImageSource)
      .mockResolvedValue({
        url: "data:image/png;base64,AQID",
        thumbnailUrl: "data:image/png;base64,AQID",
        mimeType: "image/png",
      });
    view.rerender(
      <SheetImagePreview url={url} label={photoLabel} refreshKey={{}} />,
    );
    await waitFor(() =>
      expect(screen.getByRole("img").getAttribute("aria-busy")).toBe("false"),
    );
    view.rerender(
      <SheetImagePreview url={url} label={photoLabel} refreshKey={{}} />,
    );
    expect(resolveImageSource).toHaveBeenCalledTimes(2);
  });
});
