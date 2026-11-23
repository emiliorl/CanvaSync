import { defineMessages, useIntl } from "react-intl";
import { formatAppError } from "./localizedError";

/** Canva supplies locale and translated messages through AppI18nProvider. */
const messages = defineMessages({
  cellColorsUnavailable: {
    defaultMessage:
      "Cell colors could not be loaded from this link. Sign in with Google and reload the sheet to include colors.",
    description:
      "Sheet values are available but source cell formatting could not be retrieved",
  },
  rowCount: {
    defaultMessage: "{count, plural, one {# row} other {# rows}}",
    description: "Imported row count",
  },
  imageCount: {
    defaultMessage: "{count, plural, one {# image} other {# images}}",
    description: "Imported image count",
  },
  appTitle: {
    defaultMessage: "CellBridge",
    description: "CellBridge: appTitle",
  },
  appSubtitle: {
    defaultMessage: "Bring spreadsheet tables and images into Canva",
    description: "CellBridge: appSubtitle",
  },
  selectSpreadsheet: {
    defaultMessage: "Select Spreadsheet",
    description: "CellBridge: selectSpreadsheet",
  },
  selectSpreadsheetDesc: {
    defaultMessage: "Choose a spreadsheet from your Google account",
    description: "CellBridge: selectSpreadsheetDesc",
  },
  choosePlaceholder: {
    defaultMessage: "-- Select a Google Spreadsheet --",
    description: "CellBridge: choosePlaceholder",
  },
  loadingSpreadsheets: {
    defaultMessage: "Loading Google Spreadsheets...",
    description: "CellBridge: loadingSpreadsheets",
  },
  selectTab: {
    defaultMessage: "Select sheet tab",
    description: "CellBridge: selectTab",
  },
  selectTabDesc: {
    defaultMessage: "Choose the spreadsheet tab to import",
    description: "CellBridge: selectTabDesc",
  },
  pasteLinkManually: {
    defaultMessage: "Paste link manually",
    description: "CellBridge: pasteLinkManually",
  },
  backToList: {
    defaultMessage: "Back to spreadsheet list",
    description: "CellBridge: backToList",
  },
  googleSheetLink: {
    defaultMessage: "Google Sheet Link",
    description: "CellBridge: googleSheetLink",
  },
  googleSheetLinkDesc: {
    defaultMessage: "Paste a link to your Google spreadsheet",
    description: "CellBridge: googleSheetLinkDesc",
  },
  grantDriveTitle: {
    defaultMessage:
      "To select spreadsheets from your Google Drive directly in Canva:",
    description: "CellBridge: grantDriveTitle",
  },
  grantDriveAction: {
    defaultMessage: "Grant Drive File Access",
    description: "CellBridge: grantDriveAction",
  },
  connected: {
    defaultMessage: "Connected",
    description: "CellBridge: connected",
  },
  notConnected: {
    defaultMessage: "Google Account",
    description: "CellBridge: notConnected",
  },
  signOut: {
    defaultMessage: "Sign out",
    description: "CellBridge: signOut",
  },
  signIn: {
    defaultMessage: "Sign in with Google",
    description: "CellBridge: signIn",
  },
  slideUpToDate: {
    defaultMessage: "Up to date",
    description: "CellBridge: slideUpToDate",
  },
  updatesAvailable: {
    defaultMessage: "Changes ready",
    description: "CellBridge: updatesAvailable",
  },
  notInserted: {
    defaultMessage: "Not imported yet",
    description: "CellBridge: notInserted",
  },
  syncedAt: {
    defaultMessage: "Synced",
    description: "CellBridge: syncedAt",
  },
  revitId: {
    defaultMessage: "Revit ID",
    description: "CellBridge: revitId",
  },
  space: {
    defaultMessage: "Space",
    description: "CellBridge: space",
  },
  finishSpec: {
    defaultMessage: "Finish Spec",
    description: "CellBridge: finishSpec",
  },
  area: {
    defaultMessage: "Area",
    description: "CellBridge: area",
  },
  moreRows: {
    defaultMessage: "more rows",
    description: "CellBridge: moreRows",
  },
  rows: {
    defaultMessage: "rows",
    description: "CellBridge: rows",
  },
  row: {
    defaultMessage: "row",
    description: "CellBridge: row",
  },
  includeMaterialImages: {
    defaultMessage: "Include images",
    description: "CellBridge: includeMaterialImages",
  },
  addTableToSlide: {
    defaultMessage: "Insert table",
    description: "CellBridge: addTableToSlide",
  },
  reinsertTable: {
    defaultMessage: "Insert updated copy",
    description: "CellBridge: reinsertTable",
  },
  tableUpToDate: {
    defaultMessage: "Imported data is current",
    description: "CellBridge: tableUpToDate",
  },
  syncUpdates: {
    defaultMessage: "Sync Updates from Sheet",
    description: "CellBridge: syncUpdates",
  },
  syncFromSheet: {
    defaultMessage: "Sync Table from Sheet",
    description: "CellBridge: syncFromSheet",
  },
  readingSheet: {
    defaultMessage: "Reading Sheet...",
    description: "CellBridge: readingSheet",
  },
  connectSchedule: {
    defaultMessage: "Load table",
    description: "CellBridge: connectSchedule",
  },
  noRowsFound: {
    defaultMessage:
      "No data rows found. Add column headers in the first row and data below them.",
    description: "CellBridge: noRowsFound",
  },
  columnsToImport: {
    defaultMessage: "Columns to import",
    description: "CellBridge: columnsToImport",
  },
  chooseColumns: {
    defaultMessage:
      "Search and select columns. Their import order is shown below.",
    description: "CellBridge: chooseColumns",
  },
  columnWidth: {
    defaultMessage: "Width (px)",
    description: "CellBridge: columnWidth",
  },
  rowHeight: {
    defaultMessage: "Height (px)",
    description: "CellBridge: rowHeight",
  },
  rowSizes: {
    defaultMessage: "Row heights",
    description: "CellBridge: rowSizes",
  },
  columnSizes: {
    defaultMessage: "Column widths",
    description: "CellBridge: columnSizes",
  },
  importSettings: {
    defaultMessage: "Table dimensions",
    description: "CellBridge: importSettings",
  },
  refreshData: {
    defaultMessage: "Refresh spreadsheet data",
    description: "CellBridge: refreshData",
  },
  layoutHint: {
    defaultMessage:
      "Set column widths and row heights. You can adjust them here after inserting.",
    description: "CellBridge: layoutHint",
  },
  rowHeightHint: {
    defaultMessage:
      "Rows expand automatically to fit longer text. Your height sets the minimum.",
    description: "CellBridge: rowHeightHint",
  },
  selectColumnsError: {
    defaultMessage: "Select at least one column to import.",
    description: "CellBridge: selectColumnsError",
  },
  moveUp: {
    defaultMessage: "Move column left",
    description: "CellBridge: moveUp",
  },
  moveDown: {
    defaultMessage: "Move column right",
    description: "CellBridge: moveDown",
  },
  signInSuccess: {
    defaultMessage: "Google sign-in completed.",
    description: "CellBridge: signInSuccess",
  },
  signOutSuccess: {
    defaultMessage: "Signed out of Google.",
    description: "CellBridge: signOutSuccess",
  },
  signInError: {
    defaultMessage: "Google sign-in failed.",
    description: "CellBridge: signInError",
  },
  inspectError: {
    defaultMessage: "Could not read spreadsheet tabs. Check the link.",
    description: "CellBridge: inspectError",
  },
  loadError: {
    defaultMessage: "Could not load the spreadsheet.",
    description: "CellBridge: loadError",
  },
  importError: {
    defaultMessage: "Could not insert the table.",
    description: "CellBridge: importError",
  },
  refreshSuccess: {
    defaultMessage:
      "Spreadsheet data refreshed. Insert an updated copy to apply changes.",
    description: "CellBridge: refreshSuccess",
  },
  recent: {
    defaultMessage: "Recent",
    description: "CellBridge: recent",
  },
  rowLabel: {
    defaultMessage: "Row {number}",
    description: "CellBridge: rowLabel",
  },
  addedSuccess: {
    defaultMessage: "Inserted table ({rowsLabel}, {imagesLabel}).",
    description: "CellBridge: addedSuccess",
  },
  syncSuccess: {
    defaultMessage:
      "Updated {updates, plural, one {# text element} other {# text elements}}.",
    description: "CellBridge: syncSuccess",
  },
});

export function useTranslations() {
  const intl = useIntl();
  return {
    designCheckUnavailable: intl.formatMessage({
      defaultMessage:
        "Canva is temporarily unavailable. We will check the table again automatically.",
      description: "Repeated failure checking the current Canva table",
    }),
    imagePreviewError: intl.formatMessage({
      defaultMessage: "Image preview unavailable",
      description: "Spreadsheet image preview could not be loaded",
    }),
    formatError: (error: unknown, fallback: string) =>
      formatAppError(intl, error, fallback),
    columnSizes: intl.formatMessage(messages.columnSizes),
    spreadsheetWithTabs: (count: number) =>
      intl.formatMessage(
        {
          defaultMessage:
            "Spreadsheet ({count, plural, one {# tab} other {# tabs}})",
          description: "Unnamed spreadsheet with tab count",
        },
        { count },
      ),
    resizeColumnHint: intl.formatMessage({
      defaultMessage:
        "Set column widths, then click Update table. Headers, text, and images resize together.",
      description: "Resize columns of an existing linked table",
    }),
    rowCount: (count: number) =>
      intl.formatMessage(messages.rowCount, { count }),
    tableStatus: (count: number, status: string) =>
      intl.formatMessage(
        {
          defaultMessage:
            "{count, plural, one {# row} other {# rows}} · {status}",
          description: "Compact linked table row count and sync state",
        },
        { count, status },
      ),
    importOptions: intl.formatMessage({
      defaultMessage: "Columns and import options",
      description: "Expandable table import configuration",
    }),
    tableHelp: intl.formatMessage({
      defaultMessage: "Table help",
      description: "Expandable help for linked tables",
    }),
    resizeRowHint: intl.formatMessage({
      defaultMessage:
        "Set a height for each row, then click Update table. Its text and image cells move together. Text must fit inside the chosen height.",
      description: "Resize rows of an existing linked table",
    }),
    openSheet: intl.formatMessage({
      defaultMessage: "Open sheet",
      description: "Open Google spreadsheet in another tab",
    }),
    checkChanges: intl.formatMessage({
      defaultMessage: "Check for changes",
      description: "Manually fetch current spreadsheet data",
    }),
    autoCheckHint: intl.formatMessage({
      defaultMessage:
        "Checks for sheet changes every 30 seconds while visible and when you return. Update table applies them to Canva.",
      description: "Automatic spreadsheet check explanation",
    }),
    updateTable: intl.formatMessage({
      defaultMessage: "Update table",
      description: "Update the existing Canva table from the sheet",
    }),
    tableUpdated: intl.formatMessage({
      defaultMessage: "Updated the existing table in Canva.",
      description: "Confirmed table update",
    }),
    recordKey: intl.formatMessage({
      defaultMessage: "Record key column",
      description: "Stable record identifier selection",
    }),
    recordKeyHint: intl.formatMessage({
      defaultMessage:
        "Choose a column with a unique, nonempty value for every row.",
      description: "Stable key requirements",
    }),
    linkedTableHint: intl.formatMessage({
      defaultMessage:
        "This sheet is already inserted on this page. Update table follows record keys, including reordered rows, and keeps their Canva design. Keep the table grouped and record keys stable. Adding or deleting rows requires a new import.",
      description: "Linked table limitations",
    }),
    checkedAt: (time: number) =>
      intl.formatMessage(
        {
          defaultMessage: "Sheet last checked at {time}",
          description: "Last successful source data fetch",
        },
        {
          time: intl.formatTime(time, {
            hour: "numeric",
            minute: "numeric",
            second: "numeric",
          }),
        },
      ),
    appTitle: intl.formatMessage(messages.appTitle),
    appSubtitle: intl.formatMessage(messages.appSubtitle),
    selectSpreadsheet: intl.formatMessage(messages.selectSpreadsheet),
    selectSpreadsheetDesc: intl.formatMessage(messages.selectSpreadsheetDesc),
    choosePlaceholder: intl.formatMessage(messages.choosePlaceholder),
    loadingSpreadsheets: intl.formatMessage(messages.loadingSpreadsheets),
    selectTab: intl.formatMessage(messages.selectTab),
    selectTabDesc: intl.formatMessage(messages.selectTabDesc),
    pasteLinkManually: intl.formatMessage(messages.pasteLinkManually),
    backToList: intl.formatMessage(messages.backToList),
    googleSheetLink: intl.formatMessage(messages.googleSheetLink),
    googleSheetLinkDesc: intl.formatMessage(messages.googleSheetLinkDesc),
    grantDriveTitle: intl.formatMessage(messages.grantDriveTitle),
    grantDriveAction: intl.formatMessage(messages.grantDriveAction),
    connected: intl.formatMessage(messages.connected),
    notConnected: intl.formatMessage(messages.notConnected),
    signOut: intl.formatMessage(messages.signOut),
    signIn: intl.formatMessage(messages.signIn),
    slideUpToDate: intl.formatMessage(messages.slideUpToDate),
    updatesAvailable: intl.formatMessage(messages.updatesAvailable),
    notInserted: intl.formatMessage(messages.notInserted),
    syncedAt: intl.formatMessage(messages.syncedAt),
    revitId: intl.formatMessage(messages.revitId),
    space: intl.formatMessage(messages.space),
    finishSpec: intl.formatMessage(messages.finishSpec),
    area: intl.formatMessage(messages.area),
    moreRows: intl.formatMessage(messages.moreRows),
    rows: intl.formatMessage(messages.rows),
    row: intl.formatMessage(messages.row),
    includeMaterialImages: intl.formatMessage(messages.includeMaterialImages),
    addTableToSlide: intl.formatMessage(messages.addTableToSlide),
    reinsertTable: intl.formatMessage(messages.reinsertTable),
    tableUpToDate: intl.formatMessage(messages.tableUpToDate),
    syncUpdates: intl.formatMessage(messages.syncUpdates),
    syncFromSheet: intl.formatMessage(messages.syncFromSheet),
    readingSheet: intl.formatMessage(messages.readingSheet),
    connectSchedule: intl.formatMessage(messages.connectSchedule),
    noRowsFound: intl.formatMessage(messages.noRowsFound),
    columnsToImport: intl.formatMessage(messages.columnsToImport),
    chooseColumns: intl.formatMessage(messages.chooseColumns),
    columnWidth: intl.formatMessage(messages.columnWidth),
    rowHeight: intl.formatMessage(messages.rowHeight),
    rowSizes: intl.formatMessage(messages.rowSizes),
    importSettings: intl.formatMessage(messages.importSettings),
    refreshData: intl.formatMessage(messages.refreshData),
    layoutHint: intl.formatMessage(messages.layoutHint),
    rowHeightHint: intl.formatMessage(messages.rowHeightHint),
    selectColumnsError: intl.formatMessage(messages.selectColumnsError),
    moveUp: intl.formatMessage(messages.moveUp),
    moveDown: intl.formatMessage(messages.moveDown),
    signInSuccess: intl.formatMessage(messages.signInSuccess),
    signOutSuccess: intl.formatMessage(messages.signOutSuccess),
    signInError: intl.formatMessage(messages.signInError),
    inspectError: intl.formatMessage(messages.inspectError),
    loadError: intl.formatMessage(messages.loadError),
    cellColorsUnavailable: intl.formatMessage(messages.cellColorsUnavailable),
    importError: intl.formatMessage(messages.importError),
    refreshSuccess: intl.formatMessage(messages.refreshSuccess),
    recent: intl.formatMessage(messages.recent),
    addedSuccess: (rows: number, images: number) =>
      intl.formatMessage(messages.addedSuccess, {
        rowsLabel: intl.formatMessage(messages.rowCount, { count: rows }),
        imagesLabel: intl.formatMessage(messages.imageCount, { count: images }),
      }),
    syncSuccess: (updates: number) =>
      intl.formatMessage(messages.syncSuccess, { updates }),
    rowLabel: (number: number) =>
      intl.formatMessage(messages.rowLabel, { number }),
  };
}

export type Translations = ReturnType<typeof useTranslations>;
