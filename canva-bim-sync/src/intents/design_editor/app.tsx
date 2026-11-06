import React, { useState, useEffect } from "react";
import { Rows, Title, Text, Alert, Box, Button } from "@canva/app-ui-kit";
import * as styles from "styles/components.css";
import { SheetConnector } from "../../components/SheetConnector";
import { ScheduleTableManager } from "../../components/ScheduleTableManager";
import {
  fetchSheetData,
  fetchPrivateSheetData,
  fetchSpreadsheetMetadata,
  type SheetTabInfo,
} from "../../services/googleSheetsService";
import {
  requestGoogleAccessToken,
  getActiveGoogleToken,
  checkIsGoogleAuthenticated,
  clearGoogleSession,
} from "../../services/googleAuthService";
import { BimRoomRecord } from "../../types/bim";
import {
  type Language,
  translations,
  getInitialLanguage,
  saveLanguagePreference,
} from "../../utils/i18n";

export const App = () => {
  const [lang, setLang] = useState<Language>(getInitialLanguage());
  const t = translations[lang];

  const [activeUrl, setActiveUrl] = useState<string>("");
  const [spreadsheetTitle, setSpreadsheetTitle] = useState<string>("");
  const [availableTabs, setAvailableTabs] = useState<SheetTabInfo[]>([]);
  const [selectedTab, setSelectedTab] = useState<string>("");
  const [records, setRecords] = useState<BimRoomRecord[]>([]);
  const [isLoading, setIsLoading] = useState<boolean>(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [statusMessage, setStatusMessage] = useState<string | null>(null);
  const [isAuthenticatedGoogle, setIsAuthenticatedGoogle] = useState<boolean>(false);

  useEffect(() => {
    checkIsGoogleAuthenticated().then(setIsAuthenticatedGoogle).catch(() => {});
  }, []);

  const handleToggleLanguage = (newLang: Language) => {
    setLang(newLang);
    saveLanguagePreference(newLang);
  };

  const handleSignInGoogle = async (forceConsent: boolean = false) => {
    setIsLoading(true);
    setErrorMessage(null);
    try {
      await requestGoogleAccessToken(forceConsent);
      setIsAuthenticatedGoogle(true);
      setStatusMessage(lang === "es" ? "Sesión iniciada con Google." : "Google sign-in completed.");
      if (activeUrl) {
        await handleInspectSheets(activeUrl);
      }
    } catch (err: any) {
      setErrorMessage(err.message || (lang === "es" ? "Error al iniciar sesión con Google." : "Google sign-in failed."));
    } finally {
      setIsLoading(false);
    }
  };

  const handleSignOutGoogle = async () => {
    await clearGoogleSession();
    setIsAuthenticatedGoogle(false);
    setStatusMessage(lang === "es" ? "Sesión cerrada." : "Signed out of Google.");
  };

  const handleInspectSheets = async (url: string): Promise<SheetTabInfo[]> => {
    try {
      const token = await getActiveGoogleToken();
      const meta = await fetchSpreadsheetMetadata(url, token);
      setSpreadsheetTitle(meta.title);
      setAvailableTabs(meta.sheets);
      if (meta.sheets.length > 0) {
        const defaultTab = meta.sheets[0]?.title || "Sheet1";
        setSelectedTab(defaultTab);
      }
      return meta.sheets;
    } catch (err: any) {
      setErrorMessage(
        err.message || (lang === "es" ? "No se pudieron leer las pestañas. Verifica el enlace." : "Could not read sheet pages. Please ensure link is valid."),
      );
      return [];
    }
  };

  const handleConnectSheet = async (url: string, tabName?: string) => {
    setIsLoading(true);
    setErrorMessage(null);
    setStatusMessage(null);
    setActiveUrl(url);

    try {
      const token = await getActiveGoogleToken();
      let result;

      if (token) {
        result = await fetchPrivateSheetData(url, token, tabName || selectedTab);
      } else {
        result = await fetchSheetData(url, tabName || selectedTab);
      }

      if (result.records.length === 0) {
        setErrorMessage(t.noRowsFound);
        return;
      }

      setRecords(result.records);
    } catch (err: any) {
      setErrorMessage(err.message || (lang === "es" ? "Error al cargar la hoja de Google." : "Failed to load Google Sheet."));
    } finally {
      setIsLoading(false);
    }
  };

  const handleRefreshSheet = async () => {
    if (!activeUrl) return;
    await handleConnectSheet(activeUrl, selectedTab);
  };

  return (
    <div className={styles.scrollContainer}>
      <Rows spacing="2u">
        {/* Header with Title and Language Switcher */}
        <Box padding="2u">
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start" }}>
            <Rows spacing="0.5u">
              <Title size="medium">{t.appTitle}</Title>
              <Text size="small" tone="secondary">
                {t.appSubtitle}
              </Text>
            </Rows>
            {/* Subtle Language Pill Toggle */}
            <div style={{ display: "flex", gap: "2px", backgroundColor: "#F1F5F9", padding: "2px", borderRadius: "5px" }}>
              <button
                type="button"
                onClick={() => handleToggleLanguage("es")}
                style={{
                  background: lang === "es" ? "#FFFFFF" : "transparent",
                  border: lang === "es" ? "1px solid #CBD5E1" : "none",
                  borderRadius: "4px",
                  padding: "2px 7px",
                  fontSize: "11px",
                  fontWeight: lang === "es" ? 700 : 500,
                  color: lang === "es" ? "#0F172A" : "#64748B",
                  cursor: "pointer",
                }}
              >
                ES
              </button>
              <button
                type="button"
                onClick={() => handleToggleLanguage("en")}
                style={{
                  background: lang === "en" ? "#FFFFFF" : "transparent",
                  border: lang === "en" ? "1px solid #CBD5E1" : "none",
                  borderRadius: "4px",
                  padding: "2px 7px",
                  fontSize: "11px",
                  fontWeight: lang === "en" ? 700 : 500,
                  color: lang === "en" ? "#0F172A" : "#64748B",
                  cursor: "pointer",
                }}
              >
                EN
              </button>
            </div>
          </div>
        </Box>

        {/* Error Notification */}
        {errorMessage && (
          <Box padding="2u">
            <Alert tone="critical" onDismiss={() => setErrorMessage(null)}>
              {errorMessage}
            </Alert>
          </Box>
        )}

        {/* Success Status Notification */}
        {statusMessage && (
          <Box padding="2u">
            <Alert tone="positive" onDismiss={() => setStatusMessage(null)}>
              {statusMessage}
            </Alert>
          </Box>
        )}

        {/* Sheet Connection (Automatic upon selection) */}
        <SheetConnector
          t={t}
          onConnect={handleConnectSheet}
          onInspectSheets={handleInspectSheets}
          onSignInGoogle={handleSignInGoogle}
          isAuthenticatedGoogle={isAuthenticatedGoogle}
          isLoading={isLoading}
          availableTabs={availableTabs}
          selectedTab={selectedTab}
          hasLoadedRecords={records.length > 0}
          onTabChange={(tab) => {
            setSelectedTab(tab);
            if (activeUrl) {
              handleConnectSheet(activeUrl, tab);
            }
          }}
        />

        {/* Schedule Table Actions & Summary */}
        {records.length > 0 && (
          <ScheduleTableManager
            t={t}
            records={records}
            sheetTitle={spreadsheetTitle}
            selectedTab={selectedTab}
            onRefresh={handleRefreshSheet}
            onSuccess={(msg) => {
              setStatusMessage(msg);
              setErrorMessage(null);
            }}
            onError={(err) => setErrorMessage(err)}
            disabled={isLoading}
          />
        )}

        {/* Account Footer at Bottom */}
        <Box padding="2u">
          <div
            style={{
              display: "flex",
              alignItems: "center",
              justifyContent: "space-between",
              padding: "8px 12px",
              backgroundColor: isAuthenticatedGoogle ? "#F0FDF4" : "#F8FAFC",
              border: `1px solid ${isAuthenticatedGoogle ? "#DCFCE7" : "#E2E8F0"}`,
              borderRadius: "6px",
              marginTop: "8px",
            }}
          >
            <div style={{ display: "flex", alignItems: "center", gap: "6px", minWidth: 0 }}>
              <span
                style={{
                  width: "7px",
                  height: "7px",
                  borderRadius: "50%",
                  backgroundColor: isAuthenticatedGoogle ? "#16A34A" : "#94A3B8",
                  flexShrink: 0,
                }}
              />
              <Text size="small">
                {isAuthenticatedGoogle ? t.connected : t.notConnected}
              </Text>
            </div>

            {isAuthenticatedGoogle ? (
              <button
                type="button"
                onClick={handleSignOutGoogle}
                disabled={isLoading}
                style={{
                  background: "none",
                  border: "none",
                  padding: "2px 6px",
                  fontSize: "12px",
                  fontWeight: 600,
                  color: "#475569",
                  cursor: "pointer",
                  textDecoration: "underline",
                  whiteSpace: "nowrap",
                  flexShrink: 0,
                }}
              >
                {t.signOut}
              </button>
            ) : (
              <Button
                variant="secondary"
                onClick={() => handleSignInGoogle()}
                disabled={isLoading}
              >
                {t.signIn}
              </Button>
            )}
          </div>
        </Box>
      </Rows>
    </div>
  );
};
