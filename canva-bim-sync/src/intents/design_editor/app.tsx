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

export const App = () => {
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

  const handleSignInGoogle = async (forceConsent: boolean = false) => {
    setIsLoading(true);
    setErrorMessage(null);
    try {
      await requestGoogleAccessToken(forceConsent);
      setIsAuthenticatedGoogle(true);
      setStatusMessage("Google sign-in completed.");
      if (activeUrl) {
        await handleInspectSheets(activeUrl);
      }
    } catch (err: any) {
      setErrorMessage(err.message || "Google sign-in failed.");
    } finally {
      setIsLoading(false);
    }
  };

  const handleSignOutGoogle = async () => {
    await clearGoogleSession();
    setIsAuthenticatedGoogle(false);
    setStatusMessage("Signed out of Google.");
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
      setErrorMessage(err.message || "Could not read sheet pages. Please ensure link is valid.");
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
        setErrorMessage("No schedule rows found. Please check column headers (e.g. Revit_ID, Finish_Spec).");
        return;
      }

      setRecords(result.records);
      setStatusMessage(
        `Loaded ${result.records.length} schedule rows from "${result.sheetTitle || selectedTab || 'Sheet'}".`,
      );
    } catch (err: any) {
      setErrorMessage(err.message || "Failed to load Google Sheet.");
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
        {/* Header */}
        <Box padding="2u">
          <Rows spacing="0.5u">
            <Title size="medium">CanvaSync</Title>
            <Text size="small" tone="secondary">
              Architectural schedule & finish specification bridge
            </Text>
          </Rows>
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

        {/* Sheet Connection */}
        <SheetConnector
          onConnect={handleConnectSheet}
          onInspectSheets={handleInspectSheets}
          onSignInGoogle={handleSignInGoogle}
          onSignOutGoogle={handleSignOutGoogle}
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
                {isAuthenticatedGoogle ? "Connected" : "Google Account"}
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
                Sign out
              </button>
            ) : (
              <Button
                variant="secondary"
                onClick={() => handleSignInGoogle()}
                disabled={isLoading}
              >
                Sign in with Google
              </Button>
            )}
          </div>
        </Box>
      </Rows>
    </div>
  );
};
