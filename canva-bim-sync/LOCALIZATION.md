# Native Canva localization

CanvaSync uses `AppI18nProvider` at its root. The provider reads Canva's language
setting and platform-supplied messages. There is no separate language switch, browser
language override, or custom production translation catalog.

The UI labels, validation messages, and app-owned service errors use FormatJS message
descriptors. Errors are formatted at the UI boundary so they use the same native locale
as the controls. Spreadsheet names, column headers, cell values, URLs, and provider
diagnostics remain source content.

## Activating Spanish

Canva's native translation workflow is managed by Canva after app review. It supports
Spanish for Spain (`es-ES`) and Latin America (`es-419`). The app cannot enable these
catalogs locally or upload its own Spanish translations through this workflow.

1. Run `npm run build` in this directory.
2. Upload `dist/app.js` and `dist/messages_en.json` on the Developer Portal's Code
   upload page as part of app review. Request Spanish availability in the review notes.
3. After Canva supplies translations, preview `es-ES` and `es-419` in the Dev Toolkit
   and verify labels, plurals, validation messages, and the collapsible dimension controls.
4. Release the translated version. Users with the matching Canva language setting
   then receive the platform's Spanish catalog automatically.

Until Canva provisions those translations, the native provider falls back to English.
Pseudolocalization tests layout expansion; it does not provide Spanish translations.

The automated Spanish tests simulate catalogs supplied by Canva. These fixtures are
test-only and are not bundled as production Spanish translations.

Reference: [Canva localization process](https://www.canva.dev/docs/apps/localization/).
