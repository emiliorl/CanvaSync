import { driveImageInfo, resolveImageSource } from "./imageSourceService";
import { getActiveGoogleToken } from "./googleAuthService";

jest.mock("./googleAuthService", () => ({ getActiveGoogleToken: jest.fn() }));
const originalFetch = global.fetch;
function response(
  type = "image/png",
  status = 200,
  contentLength?: string,
): Response {
  return {
    ok: status === 200,
    status,
    headers: {
      get: (key: string) =>
        key === "content-type"
          ? type
          : key === "content-length"
            ? contentLength || null
            : null,
    },
    blob: async () => new Blob([new Uint8Array([1, 2, 3])], { type }),
  } as Response;
}
describe("Drive image sources", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    jest.mocked(getActiveGoogleToken).mockResolvedValue("private-token");
    global.fetch = jest.fn().mockResolvedValue(response());
  });
  afterEach(() => {
    global.fetch = originalFetch;
  });
  it.each([
    "https://drive.google.com/file/d/file_123/view?usp=sharing",
    "https://drive.google.com/open?id=file_123",
    "https://drive.google.com/uc?export=download&id=file_123",
    "https://drive.google.com/thumbnail?id=file_123&sz=w1000",
  ])("recognizes the file ID in %s", (url) => {
    expect(driveImageInfo(url)).toEqual({ fileId: "file_123" });
  });
  it("downloads a Drive image with authentication and creates a thumbnail from actual image bytes", async () => {
    const source = await resolveImageSource(
      "https://drive.google.com/file/d/file_123/view?resourcekey=key_456",
    );
    expect(fetch).toHaveBeenCalledWith(
      "https://www.googleapis.com/drive/v3/files/file_123?alt=media&supportsAllDrives=true",
      expect.objectContaining({
        headers: {
          Authorization: "Bearer private-token",
          "X-Goog-Drive-Resource-Keys": "file_123/key_456",
        },
        credentials: "omit",
      }),
    );
    expect(source).toEqual({
      mimeType: "image/png",
      url: "data:image/png;base64,AQID",
      thumbnailUrl: "data:image/png;base64,AQID",
    });
    expect(source.url).not.toContain("private-token");
  });
  it("does not fetch or send Google credentials to ordinary or lookalike image hosts", async () => {
    const url =
      "https://drive.google.com.evil.example/file/d/file_123/photo.png";
    expect(await resolveImageSource(url)).toEqual({
      mimeType: "image/png",
      url,
      thumbnailUrl: url,
    });
    expect(fetch).not.toHaveBeenCalled();
    expect(getActiveGoogleToken).not.toHaveBeenCalled();
  });
  it("explains when Google sign-in is missing", async () => {
    jest.mocked(getActiveGoogleToken).mockResolvedValue(null);
    await expect(
      resolveImageSource("https://drive.google.com/file/d/file_123/view"),
    ).rejects.toThrow("Sign in to Google");
    expect(fetch).not.toHaveBeenCalled();
  });
  it.each([401, 403, 404])(
    "reports a Drive access error (%s) before any Canva upload",
    async (status) => {
      jest.mocked(fetch).mockResolvedValue(response("text/html", status));
      await expect(
        resolveImageSource("https://drive.google.com/file/d/file_123/view"),
      ).rejects.toThrow(/access|shared/);
    },
  );
  it("rejects a folder, a non-image response, and an oversized image", async () => {
    expect(() =>
      driveImageInfo("https://drive.google.com/drive/folders/folder_123"),
    ).toThrow("file link");
    jest.mocked(fetch).mockResolvedValueOnce(response("text/html"));
    await expect(
      resolveImageSource("https://drive.google.com/file/d/file_123/view"),
    ).rejects.toThrow("image file");
    jest
      .mocked(fetch)
      .mockResolvedValueOnce(response("image/png", 200, "9000000"));
    await expect(
      resolveImageSource("https://drive.google.com/file/d/file_123/view"),
    ).rejects.toThrow("too large");
  });
});
