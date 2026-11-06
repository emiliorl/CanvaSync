export type Language = "es" | "en";

export interface Translations {
  appTitle: string;
  appSubtitle: string;
  selectSpreadsheet: string;
  selectSpreadsheetDesc: string;
  choosePlaceholder: string;
  loadingSpreadsheets: string;
  selectTab: string;
  selectTabDesc: string;
  pasteLinkManually: string;
  backToList: string;
  googleSheetLink: string;
  googleSheetLinkDesc: string;
  grantDriveTitle: string;
  grantDriveAction: string;
  connected: string;
  notConnected: string;
  signOut: string;
  signIn: string;
  slideUpToDate: string;
  updatesAvailable: string;
  notInserted: string;
  syncedAt: string;
  revitId: string;
  space: string;
  finishSpec: string;
  area: string;
  moreRows: string;
  rows: string;
  row: string;
  includeMaterialImages: string;
  addTableToSlide: string;
  reinsertTable: string;
  tableUpToDate: string;
  syncUpdates: string;
  syncFromSheet: string;
  addedSuccess: (rows: number, images: number) => string;
  syncSuccess: (updates: number) => string;
  readingSheet: string;
  connectSchedule: string;
  noRowsFound: string;
}

export const translations: Record<Language, Translations> = {
  es: {
    appTitle: "CanvaSync",
    appSubtitle: "Integración de tablas de acabados y especificaciones",
    selectSpreadsheet: "Seleccionar archivo",
    selectSpreadsheetDesc: "Elige una hoja de cálculo de tu cuenta de Google",
    choosePlaceholder: "-- Elige una hoja de cálculo --",
    loadingSpreadsheets: "Cargando hojas de Google Drive...",
    selectTab: "Pestaña / Vista del proyecto",
    selectTabDesc: "Elige la hoja con las especificaciones de acabados",
    pasteLinkManually: "Pegar enlace manualmente",
    backToList: "Elegir de la lista de Google Drive",
    googleSheetLink: "Enlace de Google Sheets",
    googleSheetLinkDesc: "Pega el enlace de tu tabla de acabados o especificaciones",
    grantDriveTitle: "Para seleccionar archivos de tu Google Drive directamente en Canva:",
    grantDriveAction: "Autorizar acceso a Google Drive",
    connected: "Conectado",
    notConnected: "Sin conectar",
    signOut: "Cerrar sesión",
    signIn: "Iniciar sesión con Google",
    slideUpToDate: "Diapositiva al día",
    updatesAvailable: "Hay cambios en Google Sheets",
    notInserted: "Aún no insertada en la diapositiva",
    syncedAt: "Sincronizado",
    revitId: "ID Acabado",
    space: "Ambiente / Espacio",
    finishSpec: "Especificación de Material",
    area: "Área",
    moreRows: "filas adicionales",
    rows: "filas",
    row: "fila",
    includeMaterialImages: "Incluir imágenes de materiales",
    addTableToSlide: "Insertar tabla en diapositiva",
    reinsertTable: "Reinsertar tabla en diapositiva",
    tableUpToDate: "Tabla al día con Google Sheets",
    syncUpdates: "Sincronizar cambios de la hoja",
    syncFromSheet: "Sincronizar tabla desde la hoja",
    addedSuccess: (rows: number, images: number) =>
      `Tabla de acabados (${rows} filas${images > 0 ? `, ${images} imágenes` : ""}) agregada a la diapositiva.`,
    syncSuccess: (updates: number) =>
      `Tabla sincronizada con Google Sheets (${updates} actualizaciones de texto).`,
    readingSheet: "Cargando datos...",
    connectSchedule: "Cargar tabla",
    noRowsFound: "No se encontraron filas con encabezados de acabados (ej. Revit_ID, Finish_Spec).",
  },
  en: {
    appTitle: "CanvaSync",
    appSubtitle: "Architectural schedule & finish specification bridge",
    selectSpreadsheet: "Select Spreadsheet",
    selectSpreadsheetDesc: "Choose a spreadsheet from your Google account",
    choosePlaceholder: "-- Select a Google Spreadsheet --",
    loadingSpreadsheets: "Loading Google Spreadsheets...",
    selectTab: "Select Sheet Page / Tab",
    selectTabDesc: "Choose the schedule page to load",
    pasteLinkManually: "Paste link manually",
    backToList: "Back to spreadsheet list",
    googleSheetLink: "Google Sheet Link",
    googleSheetLinkDesc: "Link to your architectural or interior finish schedule",
    grantDriveTitle: "To select spreadsheets from your Google Drive directly in Canva:",
    grantDriveAction: "Grant Drive File Access",
    connected: "Connected",
    notConnected: "Google Account",
    signOut: "Sign out",
    signIn: "Sign in with Google",
    slideUpToDate: "Slide is up to date",
    updatesAvailable: "Updates available in Google Sheet",
    notInserted: "Not yet inserted onto slide",
    syncedAt: "Synced",
    revitId: "Revit ID",
    space: "Space",
    finishSpec: "Finish Spec",
    area: "Area",
    moreRows: "more schedule rows",
    rows: "rows",
    row: "row",
    includeMaterialImages: "Include material images",
    addTableToSlide: "Add Table to Slide",
    reinsertTable: "Re-insert Table on Slide",
    tableUpToDate: "Table is Up to Date",
    syncUpdates: "Sync Updates from Sheet",
    syncFromSheet: "Sync Table from Sheet",
    addedSuccess: (rows: number, images: number) =>
      `Added schedule (${rows} rows${images > 0 ? `, ${images} material images` : ""}) to slide.`,
    syncSuccess: (updates: number) =>
      `Synchronized schedule with Google Sheet (${updates} text updates).`,
    readingSheet: "Reading Sheet...",
    connectSchedule: "Load Schedule",
    noRowsFound: "No schedule rows found. Please check column headers (e.g. Revit_ID, Finish_Spec).",
  },
};

/**
 * Detects browser default language, prioritizing Spanish for Latin America / Guatemala (es, es-419, es-GT).
 */
export function getInitialLanguage(): Language {
  try {
    const saved = localStorage.getItem("canvasync_lang");
    if (saved === "es" || saved === "en") return saved;
    const browserLang = (navigator.language || "").toLowerCase();
    if (browserLang.startsWith("es")) return "es";
  } catch {
    // Fallback
  }
  return "es"; // Default to Spanish as requested
}

export function saveLanguagePreference(lang: Language): void {
  try {
    localStorage.setItem("canvasync_lang", lang);
  } catch {
    // Ignore
  }
}
