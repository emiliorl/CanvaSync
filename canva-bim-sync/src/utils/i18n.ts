import { defineMessages, useIntl } from "react-intl";
import { formatAppError } from "./localizedError";

/** Canva supplies locale and translated messages through AppI18nProvider. */
const messages = defineMessages({
  rowCount: {
    defaultMessage: "{count, plural, one {# row} other {# rows}}",
    description: "Imported row count",
  },
  imageCount: {
    defaultMessage: "{count, plural, one {# image} other {# images}}",
    description: "Imported image count",
  },
  appTitle: {
    defaultMessage: "CanvaSync",
    description: "CanvaSync: appTitle",
  },
  appSubtitle: {
    defaultMessage: "Bring spreadsheet tables and images into Canva",
    description: "CanvaSync: appSubtitle",
  },
  selectSpreadsheet: {
    defaultMessage: "Select Spreadsheet",
    description: "CanvaSync: selectSpreadsheet",
  },
  selectSpreadsheetDesc: {
    defaultMessage: "Choose a spreadsheet from your Google account",
    description: "CanvaSync: selectSpreadsheetDesc",
  },
  choosePlaceholder: {
    defaultMessage: "-- Select a Google Spreadsheet --",
    description: "CanvaSync: choosePlaceholder",
  },
  loadingSpreadsheets: {
    defaultMessage: "Loading Google Spreadsheets...",
    description: "CanvaSync: loadingSpreadsheets",
  },
  selectTab: {
    defaultMessage: "Select sheet tab",
    description: "CanvaSync: selectTab",
  },
  selectTabDesc: {
    defaultMessage: "Choose the spreadsheet tab to import",
    description: "CanvaSync: selectTabDesc",
  },
  pasteLinkManually: {
    defaultMessage: "Paste link manually",
    description: "CanvaSync: pasteLinkManually",
  },
  backToList: {
    defaultMessage: "Back to spreadsheet list",
    description: "CanvaSync: backToList",
  },
  googleSheetLink: {
    defaultMessage: "Google Sheet Link",
    description: "CanvaSync: googleSheetLink",
  },
  googleSheetLinkDesc: {
    defaultMessage: "Paste a link to your Google spreadsheet",
    description: "CanvaSync: googleSheetLinkDesc",
  },
  grantDriveTitle: {
    defaultMessage:
      "To select spreadsheets from your Google Drive directly in Canva:",
    description: "CanvaSync: grantDriveTitle",
  },
  grantDriveAction: {
    defaultMessage: "Grant Drive File Access",
    description: "CanvaSync: grantDriveAction",
  },
  connected: {
    defaultMessage: "Connected",
    description: "CanvaSync: connected",
  },
  notConnected: {
    defaultMessage: "Google Account",
    description: "CanvaSync: notConnected",
  },
  signOut: {
    defaultMessage: "Sign out",
    description: "CanvaSync: signOut",
  },
  signIn: {
    defaultMessage: "Sign in with Google",
    description: "CanvaSync: signIn",
  },
  slideUpToDate: {
    defaultMessage: "Up to date",
    description: "CanvaSync: slideUpToDate",
  },
  updatesAvailable: {
    defaultMessage: "Changes ready",
    description: "CanvaSync: updatesAvailable",
  },
  notInserted: {
    defaultMessage: "Not imported yet",
    description: "CanvaSync: notInserted",
  },
  syncedAt: {
    defaultMessage: "Synced",
    description: "CanvaSync: syncedAt",
  },
  revitId: {
    defaultMessage: "Revit ID",
    description: "CanvaSync: revitId",
  },
  space: {
    defaultMessage: "Space",
    description: "CanvaSync: space",
  },
  finishSpec: {
    defaultMessage: "Finish Spec",
    description: "CanvaSync: finishSpec",
  },
  area: {
    defaultMessage: "Area",
    description: "CanvaSync: area",
  },
  moreRows: {
    defaultMessage: "more rows",
    description: "CanvaSync: moreRows",
  },
  rows: {
    defaultMessage: "rows",
    description: "CanvaSync: rows",
  },
  row: {
    defaultMessage: "row",
    description: "CanvaSync: row",
  },
  includeMaterialImages: {
    defaultMessage: "Include images",
    description: "CanvaSync: includeMaterialImages",
  },
  addTableToSlide: {
    defaultMessage: "Insert table",
    description: "CanvaSync: addTableToSlide",
  },
  reinsertTable: {
    defaultMessage: "Insert updated copy",
    description: "CanvaSync: reinsertTable",
  },
  tableUpToDate: {
    defaultMessage: "Imported data is current",
    description: "CanvaSync: tableUpToDate",
  },
  syncUpdates: {
    defaultMessage: "Sync Updates from Sheet",
    description: "CanvaSync: syncUpdates",
  },
  syncFromSheet: {
    defaultMessage: "Sync Table from Sheet",
    description: "CanvaSync: syncFromSheet",
  },
  readingSheet: {
    defaultMessage: "Reading Sheet...",
    description: "CanvaSync: readingSheet",
  },
  connectSchedule: {
    defaultMessage: "Load table",
    description: "CanvaSync: connectSchedule",
  },
  noRowsFound: {
    defaultMessage:
      "No data rows found. Add column headers in the first row and data below them.",
    description: "CanvaSync: noRowsFound",
  },
  columnsToImport: {
    defaultMessage: "Columns to import",
    description: "CanvaSync: columnsToImport",
  },
  chooseColumns: {
    defaultMessage:
      "Search and select columns. Their import order is shown below.",
    description: "CanvaSync: chooseColumns",
  },
  columnWidth: {
    defaultMessage: "Width (px)",
    description: "CanvaSync: columnWidth",
  },
  rowHeight: {
    defaultMessage: "Height (px)",
    description: "CanvaSync: rowHeight",
  },
  rowSizes: {
    defaultMessage: "Row heights",
    description: "CanvaSync: rowSizes",
  },
  columnSizes: {
    defaultMessage: "Column widths",
    description: "CanvaSync: columnSizes",
  },
  importSettings: {
    defaultMessage: "Table dimensions",
    description: "CanvaSync: importSettings",
  },
  refreshData: {
    defaultMessage: "Refresh spreadsheet data",
    description: "CanvaSync: refreshData",
  },
  layoutHint: {
    defaultMessage:
      "Set column widths and row heights. You can adjust them here after inserting.",
    description: "CanvaSync: layoutHint",
  },
  rowHeightHint: {
    defaultMessage:
      "Rows expand automatically to fit longer text. Your height sets the minimum.",
    description: "CanvaSync: rowHeightHint",
  },
  selectColumnsError: {
    defaultMessage: "Select at least one column to import.",
    description: "CanvaSync: selectColumnsError",
  },
  moveUp: {
    defaultMessage: "Move column left",
    description: "CanvaSync: moveUp",
  },
  moveDown: {
    defaultMessage: "Move column right",
    description: "CanvaSync: moveDown",
  },
  signInSuccess: {
    defaultMessage: "Google sign-in completed.",
    description: "CanvaSync: signInSuccess",
  },
  signOutSuccess: {
    defaultMessage: "Signed out of Google.",
    description: "CanvaSync: signOutSuccess",
  },
  signInError: {
    defaultMessage: "Google sign-in failed.",
    description: "CanvaSync: signInError",
  },
  inspectError: {
    defaultMessage: "Could not read spreadsheet tabs. Check the link.",
    description: "CanvaSync: inspectError",
  },
  loadError: {
    defaultMessage: "Could not load the spreadsheet.",
    description: "CanvaSync: loadError",
  },
  importError: {
    defaultMessage: "Could not insert the table.",
    description: "CanvaSync: importError",
  },
  refreshSuccess: {
    defaultMessage:
      "Spreadsheet data refreshed. Insert an updated copy to apply changes.",
    description: "CanvaSync: refreshSuccess",
  },
  recent: {
    defaultMessage: "Recent",
    description: "CanvaSync: recent",
  },
  rowLabel: {
    defaultMessage: "Row {number}",
    description: "CanvaSync: rowLabel",
  },
  addedSuccess: {
    defaultMessage: "Inserted table ({rowsLabel}, {imagesLabel}).",
    description: "CanvaSync: addedSuccess",
  },
  syncSuccess: {
    defaultMessage:
      "Updated {updates, plural, one {# text element} other {# text elements}}.",
    description: "CanvaSync: syncSuccess",
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
