import React, { useState, useEffect } from "react";
import { Rows, Title, Text, Alert, Button, Box } from "@canva/app-ui-kit";
import * as styles from "styles/components.css";
import { SheetConnector } from "../../components/SheetConnector";
import { RoomSelector } from "../../components/RoomSelector";
import { ElementInjector } from "../../components/ElementInjector";
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
  const [selectedRecord, setSelectedRecord] = useState<BimRoomRecord | null>(null);
  const [isLoading, setIsLoading] = useState<boolean>(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [statusMessage, setStatusMessage] = useState<string | null>(null);
  const [isAuthenticatedGoogle, setIsAuthenticatedGoogle] = useState<boolean>(false);

  useEffect(() => {
    checkIsGoogleAuthenticated().then(setIsAuthenticatedGoogle).catch(() => {});
  }, []);

  const handleSignInGoogle = async () => {
    setIsLoading(true);
    setErrorMessage(null);
    try {
      await requestGoogleAccessToken();
      setIsAuthenticatedGoogle(true);
      setStatusMessage("Google sign-in successful. Private sheet access enabled.");
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
        setErrorMessage("No valid room records found in the sheet. Check column headers.");
        return;
      }

      setRecords(result.records);

      if (selectedRecord) {
        const stillExists = result.records.find((r) => r.revitId === selectedRecord.revitId);
        setSelectedRecord(stillExists || result.records[0] || null);
      } else {
        setSelectedRecord(result.records[0] || null);
      }

      setStatusMessage(`Successfully loaded ${result.records.length} spaces from tab "${result.sheetTitle || selectedTab || 'Sheet'}".`);
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

  const handlePlacementComplete = (msg: string) => {
    setStatusMessage(msg);
    setErrorMessage(null);
  };

  const handlePlacementError = (err: string) => {
    setErrorMessage(err);
  };

  return (
    <div className={styles.scrollContainer}>
      <Rows spacing="2u">
        {/* App Title Header */}
        <Box padding="2u">
          <Rows spacing="0.5u">
            <Title size="medium">CanvaSync (BIM Bridge)</Title>
            <Text size="small" tone="secondary">
              Sync Google Sheets room schedules and tables into your slides with in-place updates.
            </Text>
          </Rows>
        </Box>

        {/* Error Notification */}
        {errorMessage && (
          <Box padding="2u">
            <Alert
              tone="critical"
              onDismiss={() => setErrorMessage(null)}
            >
              {errorMessage}
            </Alert>
          </Box>
        )}

        {/* Success Status Notification */}
        {statusMessage && (
          <Box padding="2u">
            <Alert
              tone="positive"
              onDismiss={() => setStatusMessage(null)}
            >
              {statusMessage}
            </Alert>
          </Box>
        )}

        {/* Google Sheet Connector & Sheet Page Selector */}
        <SheetConnector
          onConnect={handleConnectSheet}
          onInspectSheets={handleInspectSheets}
          onSignInGoogle={handleSignInGoogle}
          onSignOutGoogle={handleSignOutGoogle}
          isAuthenticatedGoogle={isAuthenticatedGoogle}
          isLoading={isLoading}
          spreadsheetTitle={spreadsheetTitle}
          availableTabs={availableTabs}
          selectedTab={selectedTab}
          onTabChange={(tab) => {
            setSelectedTab(tab);
            if (activeUrl) {
              handleConnectSheet(activeUrl, tab);
            }
          }}
        />

        {/* Refresh Sheet Data Button */}
        {activeUrl && (
          <Box padding="2u">
            <Button
              variant="secondary"
              onClick={handleRefreshSheet}
              disabled={isLoading}
              stretch
            >
              🔄 Refresh Latest Data from Sheet
            </Button>
          </Box>
        )}

        {/* Room Record Selector */}
        {records.length > 0 && (
          <RoomSelector
            records={records}
            selectedRecord={selectedRecord}
            onSelect={(rec) => setSelectedRecord(rec)}
            disabled={isLoading}
          />
        )}

        {/* In-Place Sync & Architectural Table Controls */}
        {selectedRecord && (
          <ElementInjector
            selectedRecord={selectedRecord}
            onPlacementComplete={handlePlacementComplete}
            onError={handlePlacementError}
            disabled={isLoading}
          />
        )}
      </Rows>
    </div>
  );
};
