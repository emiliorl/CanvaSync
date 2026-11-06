import type { ImageMimeType } from "@canva/asset";
import { defineMessages } from "react-intl";
import { LocalizedError } from "../utils/localizedError";
import { getActiveGoogleToken } from "./googleAuthService";

const errors = defineMessages({
  link: {
    defaultMessage: "Use a Google Drive file link, not a folder link.",
    description: "Invalid Google Drive image link",
  },
  signIn: {
    defaultMessage: "Sign in to Google in CanvaSync to load Drive images.",
    description: "Google sign-in required for Drive image import",
  },
  denied: {
    defaultMessage:
      "Google Drive denied access to this image. Sign in again and allow Drive access, and check that the file is shared with your Google account.",
    description: "Drive image authorization failure",
  },
  missing: {
    defaultMessage:
      "This Drive image was not found or is not shared with your Google account.",
    description: "Drive image missing or inaccessible",
  },
  download: {
    defaultMessage:
      "Could not download this image from Google Drive. Try again.",
    description: "Drive image download failure",
  },
  format: {
    defaultMessage:
      "Use a PNG, JPEG, WebP, or SVG image file in Drive, not a document or web page.",
    description: "Unsupported Drive image file type",
  },
  size: {
    defaultMessage:
      "This Drive image is too large to import. Use an image smaller than 7.5 MB.",
    description: "Drive image exceeds Canva data URL limit",
  },
});
const fallback = {
  link: "Use a Google Drive file link, not a folder link.",
  signIn: "Sign in to Google in CanvaSync to load Drive images.",
  denied:
    "Google Drive denied access to this image. Sign in again and allow Drive access, and check that the file is shared with your Google account.",
  missing:
    "This Drive image was not found or is not shared with your Google account.",
  download: "Could not download this image from Google Drive. Try again.",
  format:
    "Use a PNG, JPEG, WebP, or SVG image file in Drive, not a document or web page.",
  size: "This Drive image is too large to import. Use an image smaller than 7.5 MB.",
};
const fail = (key: keyof typeof errors) =>
  new LocalizedError(errors[key], fallback[key]);
const MAX_DATA_URL_LENGTH = 10 * 1024 * 1024;
const MAX_IMAGE_BYTES = Math.floor(((MAX_DATA_URL_LENGTH - 100) * 3) / 4);

export function driveImageInfo(
  value: string,
): { fileId: string; resourceKey?: string } | null {
  let url: URL;
  try {
    url = new URL(value.trim());
  } catch {
    return null;
  }
  if (
    url.protocol !== "https:" ||
    !["drive.google.com", "docs.google.com"].includes(url.hostname)
  )
    return null;
  const fileId =
    url.pathname.match(/^\/file\/d\/([a-zA-Z0-9_-]+)(?:\/|$)/)?.[1] ||
    (["/open", "/uc", "/thumbnail"].includes(url.pathname)
      ? url.searchParams.get("id")
      : null);
  if (!fileId || !/^[a-zA-Z0-9_-]+$/.test(fileId)) throw fail("link");
  const resourceKey = url.searchParams.get("resourcekey") || undefined;
  if (resourceKey && !/^[a-zA-Z0-9_-]+$/.test(resourceKey)) throw fail("link");
  return { fileId, ...(resourceKey ? { resourceKey } : {}) };
}

export interface ResolvedImageSource {
  url: string;
  thumbnailUrl: string;
  mimeType: ImageMimeType;
}

function toDataUrl(blob: Blob): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () =>
      typeof reader.result === "string"
        ? resolve(reader.result)
        : reject(fail("download"));
    reader.onerror = () => reject(fail("download"));
    reader.readAsDataURL(blob);
  });
}

/** Resolve Drive viewer links to authenticated image bytes; never send auth to Canva or external hosts. */
export async function resolveImageSource(
  value: string,
  signal?: AbortSignal,
): Promise<ResolvedImageSource> {
  const url = value.trim();
  const drive = driveImageInfo(url);
  if (!drive) {
    const path = url.split(/[?#]/)[0]?.toLowerCase();
    const mimeType = path?.endsWith(".png")
      ? "image/png"
      : path?.endsWith(".webp")
        ? "image/webp"
        : path?.endsWith(".svg")
          ? "image/svg+xml"
          : "image/jpeg";
    return { url, thumbnailUrl: url, mimeType };
  }
  const token = await getActiveGoogleToken();
  if (!token) throw fail("signIn");
  const headers: Record<string, string> = { Authorization: `Bearer ${token}` };
  if (drive.resourceKey)
    headers["X-Goog-Drive-Resource-Keys"] =
      `${drive.fileId}/${drive.resourceKey}`;
  let response: Response;
  try {
    response = await fetch(
      `https://www.googleapis.com/drive/v3/files/${encodeURIComponent(drive.fileId)}?alt=media&supportsAllDrives=true`,
      { headers, credentials: "omit", signal },
    );
  } catch (error) {
    if (signal?.aborted) throw error;
    throw fail("download");
  }
  if (response.status === 401 || response.status === 403) throw fail("denied");
  if (response.status === 404) throw fail("missing");
  if (!response.ok) throw fail("download");
  const contentLength = Number(response.headers.get("content-length"));
  if (Number.isFinite(contentLength) && contentLength > MAX_IMAGE_BYTES)
    throw fail("size");
  const blob = await response.blob();
  const rawType = (blob.type || response.headers.get("content-type") || "")
    .split(";")[0]
    ?.toLowerCase();
  const mimeType = rawType === "image/jpg" ? "image/jpeg" : rawType;
  if (
    !["image/jpeg", "image/png", "image/webp", "image/svg+xml"].includes(
      mimeType || "",
    )
  )
    throw fail("format");
  if (!blob.size || blob.size > MAX_IMAGE_BYTES) throw fail("size");
  const dataUrl = await toDataUrl(new Blob([blob], { type: mimeType }));
  if (dataUrl.length > MAX_DATA_URL_LENGTH) throw fail("size");
  return {
    url: dataUrl,
    thumbnailUrl: dataUrl,
    mimeType: mimeType as ImageMimeType,
  };
}
