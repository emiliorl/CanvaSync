import React, { useState, useEffect, useRef } from "react";
import { Rows, Title, Text, Alert, Box, Button } from "@canva/app-ui-kit";
import * as styles from "styles/components.css";
import { SheetConnector } from "../../components/SheetConnector";
import { ScheduleTableManager } from "../../components/ScheduleTableManager";
import {
  fetchSheetData,
  fetchPrivateSheetData,
  fetchSpreadsheetMetadata,
  type SheetTabInfo,
  extractSpreadsheetInfo,
} from "../../services/googleSheetsService";
import {
  requestGoogleAccessToken,
  getActiveGoogleToken,
  checkIsGoogleAuthenticated,
  clearGoogleSession,
} from "../../services/googleAuthService";
import type {
  BimRoomRecord,
  SheetColumn,
  SheetFetchResult,
} from "../../types/bim";
import { useTranslations } from "../../utils/i18n";

export const App = () => {
  const t = useTranslations();
  const latestLoad = useRef(0);
  const loadInFlight = useRef(false);
  const [columns, setColumns] = useState<SheetColumn[]>([]);
  const [hasCellColors, setHasCellColors] = useState<boolean | undefined>();
  const [activeUrl, setActiveUrl] = useState<string>("");
  const [spreadsheetTitle, setSpreadsheetTitle] = useState<string>("");
  const [availableTabs, setAvailableTabs] = useState<SheetTabInfo[]>([]);
  const [selectedTab, setSelectedTab] = useState<string>("");
  const [records, setRecords] = useState<BimRoomRecord[]>([]);
  const [isLoading, setIsLoading] = useState<boolean>(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [statusMessage, setStatusMessage] = useState<string | null>(null);
  const [isAuthenticatedGoogle, setIsAuthenticatedGoogle] =
    useState<boolean>(false);

  useEffect(() => {
    if (!statusMessage) return;
    const timer = setTimeout(() => setStatusMessage(null), 4000);
    return () => clearTimeout(timer);
  }, [statusMessage]);

  useEffect(() => {
    checkIsGoogleAuthenticated()
      .then(setIsAuthenticatedGoogle)
      .catch(() => {});
  }, []);

  const handleSignInGoogle = async (forceConsent = false) => {
    setIsLoading(true);
    setErrorMessage(null);
    try {
      await requestGoogleAccessToken(forceConsent);
      setIsAuthenticatedGoogle(true);
      setStatusMessage(t.signInSuccess);
      if (activeUrl) {
        await handleInspectSheets(activeUrl);
      }
    } catch (err: any) {
      setErrorMessage(t.formatError(err, t.signInError));
    } finally {
      setIsLoading(false);
    }
  };

  const handleSignOutGoogle = async () => {
    await clearGoogleSession();
    setIsAuthenticatedGoogle(false);
    setStatusMessage(t.signOutSuccess);
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
      setErrorMessage(t.formatError(err, t.inspectError));
      return [];
    }
  };

  const handleConnectSheet = async (
    url: string,
    tabName?: string,
    refreshing = false,
    quiet = false,
  ): Promise<SheetFetchResult | undefined> => {
    const request = ++latestLoad.current;
    if (tabName) setSelectedTab(tabName);
    loadInFlight.current = true;
    if (!quiet) setIsLoading(true);
    setErrorMessage(null);
    if (!quiet) setStatusMessage(null);
    setActiveUrl(url);

    try {
      const token = await getActiveGoogleToken();
      let result;

      if (token) {
        result = await fetchPrivateSheetData(
          url,
          token,
          tabName || selectedTab,
        );
      } else {
        result = await fetchSheetData(url, tabName || selectedTab);
      }

      if (request !== latestLoad.current) return;
      if (result.records.length === 0) {
        if (refreshing) throw new Error(t.noRowsFound);
        setRecords([]);
        setColumns([]);
        setErrorMessage(t.noRowsFound);
        return;
      }

      setRecords(result.records);
      setColumns(result.columns || []);
      setHasCellColors(result.hasCellColors);
      return result;
    } catch (err: any) {
      if (request !== latestLoad.current) return;
      if (!refreshing) {
        setRecords([]);
        setColumns([]);
      }
      setErrorMessage(t.formatError(err, t.loadError));
      if (refreshing) throw err;
      return undefined;
    } finally {
      if (request === latestLoad.current) {
        setIsLoading(false);
        loadInFlight.current = false;
      }
    }
  };

  const handleRefreshSheet = async () => {
    if (!activeUrl) return;
    return handleConnectSheet(activeUrl, selectedTab, true);
  };

  const refreshRef = useRef(handleConnectSheet);
  refreshRef.current = handleConnectSheet;
  useEffect(() => {
    if (!activeUrl) return;
    const check = () => {
      if (document.visibilityState === "hidden" || loadInFlight.current) return;
      void refreshRef
        .current(activeUrl, selectedTab, true, true)
        .catch(() => {});
    };
    const timer = setInterval(check, 30000);
    window.addEventListener("focus", check);
    document.addEventListener("visibilitychange", check);
    return () => {
      clearInterval(timer);
      window.removeEventListener("focus", check);
      document.removeEventListener("visibilitychange", check);
    };
  }, [activeUrl, selectedTab]);

  let sheetUrl: string | undefined;
  let sourceKey: string | undefined;
  if (activeUrl) {
    const { spreadsheetId, gid } = extractSpreadsheetInfo(activeUrl);
    const tabId =
      availableTabs.find((tab) => tab.title === selectedTab)?.sheetId ?? gid;
    sheetUrl = `https://docs.google.com/spreadsheets/d/${spreadsheetId}/edit${tabId !== undefined ? `#gid=${tabId}` : ""}`;
    sourceKey = `${spreadsheetId}:${tabId ?? selectedTab}`;
  }

  return (
    <div className={styles.scrollContainer}>
      <Rows spacing="2u">
        {/* Header */}
        {records.length === 0 && (
          <Box padding="2u">
            <div
              style={{
                display: "flex",
                justifyContent: "space-between",
                alignItems: "flex-start",
              }}
            >
              <Rows spacing="0.5u">
                <Title size="medium">{t.appTitle}</Title>
                <Text size="small" tone="secondary">
                  {t.appSubtitle}
                </Text>
              </Rows>
            </div>
          </Box>
        )}

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
          onConnect={async (url, tab) => {
            await handleConnectSheet(url, tab);
          }}
          onInspectSheets={handleInspectSheets}
          onSignInGoogle={handleSignInGoogle}
          isAuthenticatedGoogle={isAuthenticatedGoogle}
          isLoading={isLoading}
          availableTabs={availableTabs}
          selectedTab={selectedTab}
          hasLoadedRecords={records.length > 0}
          sheetUrl={sheetUrl}
          onRefresh={handleRefreshSheet}
          onError={setErrorMessage}
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
            key={sourceKey}
            t={t}
            records={records}
            columns={columns}
            hasCellColors={hasCellColors}
            sourceKey={sourceKey}
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
            <div
              style={{
                display: "flex",
                alignItems: "center",
                gap: "6px",
                minWidth: 0,
              }}
            >
              <span
                style={{
                  width: "7px",
                  height: "7px",
                  borderRadius: "50%",
                  backgroundColor: isAuthenticatedGoogle
                    ? "#16A34A"
                    : "#94A3B8",
                  flexShrink: 0,
                }}
              />
              <Text size="small">
                {isAuthenticatedGoogle ? t.connected : t.notConnected}
              </Text>
            </div>

            {isAuthenticatedGoogle ? (
              <Button
                variant="tertiary"
                onClick={handleSignOutGoogle}
                disabled={isLoading}
              >
                {t.signOut}
              </Button>
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
