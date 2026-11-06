import { AppI18nProvider } from "@canva/app-i18n-kit";
import { cleanup, render, screen } from "@testing-library/react";
import { defineMessages, useIntl, type MessageDescriptor } from "react-intl";
import { useTranslations } from "./i18n";
import { LocalizedError } from "./localizedError";

// Simulate catalogs supplied by Canva, not a custom runtime language selector.
const fixtures: Record<
  "columns" | "rows" | "insert" | "count" | "validation",
  MessageDescriptor
> = defineMessages({
  columns: {
    defaultMessage: "Column widths",
    description: "CanvaSync: columnSizes",
  },
  rows: { defaultMessage: "Row heights", description: "CanvaSync: rowSizes" },
  insert: {
    defaultMessage: "Insert table",
    description: "CanvaSync: addTableToSlide",
  },
  count: {
    defaultMessage: "{count, plural, one {# row} other {# rows}}",
    description: "Imported row count",
  },
  validation: {
    defaultMessage: "Select at least one column to import.",
    description: "CanvaSync canvaCanvasService operation error",
  },
});

function Probe() {
  const t = useTranslations();
  const intl = useIntl();
  return (
    <div>
      <span>{intl.locale}</span>
      <span>{t.columnSizes}</span>
      <span>{t.rowSizes}</span>
      <span>{t.addTableToSlide}</span>
      <span>{t.rowCount(2)}</span>
      <span>
        {t.formatError(
          new LocalizedError(
            fixtures.validation,
            "Select at least one column to import.",
          ),
          t.importError,
        )}
      </span>
    </div>
  );
}

describe("Canva native Spanish localization", () => {
  const sdkDescriptor = Object.getOwnPropertyDescriptor(window, "canva_sdk");
  const originalLang = document.documentElement.lang;
  afterEach(() => {
    cleanup();
    if (sdkDescriptor)
      Object.defineProperty(window, "canva_sdk", sdkDescriptor);
    document.documentElement.lang = originalLang;
  });

  it.each(["es-ES", "es-419"])(
    "uses Canva's %s locale and supplied messages",
    async (locale) => {
      const getLocalizedMessages = jest.fn(() => ({
        messages: {
          [fixtures.columns.id!]: "Anchos de columna",
          [fixtures.rows.id!]: "Alturas de fila",
          [fixtures.insert.id!]: "Insertar tabla",
          [fixtures.count.id!]: "{count, plural, one {# fila} other {# filas}}",
          [fixtures.validation.id!]:
            "Selecciona al menos una columna para importar.",
        },
      }));
      Object.defineProperty(window, "canva_sdk", {
        configurable: true,
        value: {
          platform: {
            v2: { i18n: { getLocalizedMessages, pseudolocalize: jest.fn() } },
          },
        },
      });
      document.documentElement.lang = locale;
      render(
        <AppI18nProvider onError={() => {}}>
          <Probe />
        </AppI18nProvider>,
      );
      expect(await screen.findByText("Anchos de columna")).toBeDefined();
      expect(screen.getByText("Alturas de fila")).toBeDefined();
      expect(screen.getByText("Insertar tabla")).toBeDefined();
      expect(screen.getByText("2 filas")).toBeDefined();
      expect(
        screen.getByText("Selecciona al menos una columna para importar."),
      ).toBeDefined();
      expect(screen.getByText(locale)).toBeDefined();
      expect(getLocalizedMessages).toHaveBeenCalled();
    },
  );
});
