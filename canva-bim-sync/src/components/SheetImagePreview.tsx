import { useEffect, useRef, useState } from "react";
import { Text } from "@canva/app-ui-kit";
import { resolveImageSource } from "../services/imageSourceService";
import { useTranslations } from "../utils/i18n";

export function SheetImagePreview({
  url,
  label,
  refreshKey,
}: {
  url: string;
  label: string;
  refreshKey?: object;
}) {
  const t = useTranslations();
  const [source, setSource] = useState<{
    url: string;
    image?: string;
    error?: unknown;
  }>({ url });
  const resolved = useRef<{ url: string; image: string } | null>(null);
  useEffect(() => {
    if (resolved.current?.url === url) {
      setSource(resolved.current);
      return;
    }
    const controller = new AbortController();
    setSource({ url });
    void resolveImageSource(url, controller.signal).then(
      (image) => {
        if (!controller.signal.aborted) {
          resolved.current = { url, image: image.thumbnailUrl };
          setSource(resolved.current);
        }
      },
      (error) => {
        if (!controller.signal.aborted) setSource({ url, error });
      },
    );
    return () => controller.abort();
  }, [url, refreshKey]);
  if (source.url === url && source.error)
    return (
      <Text size="small" tone="secondary">
        {t.formatError(source.error, t.imagePreviewError)}
      </Text>
    );
  return (
    <div
      role="img"
      aria-label={label}
      aria-busy={source.url !== url || !source.image}
      style={{
        width: "100%",
        height: "54px",
        backgroundImage:
          source.url === url && source.image
            ? `url(${JSON.stringify(source.image)})`
            : undefined,
        backgroundSize: "cover",
        backgroundPosition: "center",
      }}
    />
  );
}
