import React, { useState, useEffect } from "react";
import {
  Button,
  FormField,
  TextInput,
  Select,
  Rows,
  Box,
  Text,
} from "@canva/app-ui-kit";
import {
  SheetTabInfo,
  DriveSpreadsheetItem,
  fetchUserSpreadsheets,
  getRecentSpreadsheets,
  saveRecentSpreadsheet,
  extractSpreadsheetInfo,
} from "../services/googleSheetsService";
import { getActiveGoogleToken } from "../services/googleAuthService";

interface SheetConnectorProps {
  onConnect: (url: string, tabName?: string) => Promise<void>;
  onInspectSheets: (url: string) => Promise<SheetTabInfo[]>;
  onSignInGoogle: (forceConsent?: boolean) => Promise<void>;
  onSignOutGoogle: () => void;
  isAuthenticatedGoogle: boolean;
  isLoading: boolean;
  availableTabs: SheetTabInfo[];
  selectedTab: string;
  onTabChange: (tab: string) => void;
  hasLoadedRecords: boolean;
}

export const SheetConnector: React.FC<SheetConnectorProps> = ({
  onConnect,
  onInspectSheets,
  onSignInGoogle,
  onSignOutGoogle,
  isAuthenticatedGoogle,
  isLoading,
  availableTabs,
  selectedTab,
  onTabChange,
  hasLoadedRecords,
}) => {
  const [url, setUrl] = useState<string>("");
  const [isInspecting, setIsInspecting] = useState<boolean>(false);
  const [driveFiles, setDriveFiles] = useState<DriveSpreadsheetItem[]>([]);
  const [isDriveLoading, setIsDriveLoading] = useState<boolean>(false);
  const [driveScopeMissing, setDriveScopeMissing] = useState<boolean>(false);
  const [selectedFileId, setSelectedFileId] = useState<string>("");
  const [showManualInput, setShowManualInput] = useState<boolean>(false);

  // When authenticated, auto-fetch the user's spreadsheets from Google Drive
  useEffect(() => {
    if (isAuthenticatedGoogle) {
      loadDriveFiles();
    } else {
      setDriveFiles([]);
      setDriveScopeMissing(false);
      setSelectedFileId("");
    }
  }, [isAuthenticatedGoogle]);

  const loadDriveFiles = async () => {
    setIsDriveLoading(true);
    setDriveScopeMissing(false);
    try {
      const token = await getActiveGoogleToken();
      if (!token) return;
      const files = await fetchUserSpreadsheets(token);
      setDriveFiles(files);
      if (files.length > 0 && !url) {
        handleSelectFile(files[0]?.id || "");
      }
    } catch (err: any) {
      const msg = err?.message || String(err);
      if (
        msg.includes("insufficient") ||
        msg.includes("Insufficient") ||
        msg.includes("scopes") ||
        msg.includes("403")
      ) {
        setDriveScopeMissing(true);
      }
    } finally {
      setIsDriveLoading(false);
    }
  };

  const handleSelectFile = (fileId: string) => {
    setSelectedFileId(fileId);
    if (!fileId) return;

    if (fileId === "MANUAL") {
      setShowManualInput(true);
      return;
    }

    setShowManualInput(false);
    const newUrl = `https://docs.google.com/spreadsheets/d/${fileId}`;
    setUrl(newUrl);

    setIsInspecting(true);
    onInspectSheets(newUrl)
      .then((tabs) => {
        const found = driveFiles.find((f) => f.id === fileId);
        saveRecentSpreadsheet({
          id: fileId,
          title: found?.name || `Spreadsheet (${tabs.length} tabs)`,
          url: newUrl,
        });
      })
      .finally(() => setIsInspecting(false));
  };

  // Auto-inspect sheets when user types/pastes a URL
  useEffect(() => {
    if (url.includes("/spreadsheets/d/")) {
      const timer = setTimeout(() => {
        try {
          const { spreadsheetId } = extractSpreadsheetInfo(url);
          setSelectedFileId(spreadsheetId);
          setIsInspecting(true);
          onInspectSheets(url.trim()).finally(() => setIsInspecting(false));
        } catch {
          // Incomplete URL while typing, ignore
        }
      }, 500);
      return () => clearTimeout(timer);
    }
    return undefined;
  }, [url]);

  const handleConnect = () => {
    if (!url.trim()) return;
    onConnect(url.trim(), selectedTab || undefined);
  };

  // Build spreadsheet select options
  const recentList = getRecentSpreadsheets();
  const fileOptions: { value: string; label: string }[] = [];

  if (isDriveLoading) {
    fileOptions.push({ value: "", label: "Loading Google Spreadsheets..." });
  } else {
    fileOptions.push({ value: "", label: "-- Select a Google Spreadsheet --" });
  }

  driveFiles.forEach((f) => {
    fileOptions.push({
      value: f.id,
      label: f.name,
    });
  });

  recentList
    .filter((s) => !driveFiles.some((df) => df.id === s.id))
    .forEach((s) => {
      fileOptions.push({
        value: s.id,
        label: `${s.title} (Recent)`,
      });
    });

  fileOptions.push({
    value: "MANUAL",
    label: "Enter Sheet link manually...",
  });

  const tabOptions = availableTabs.map((t) => ({
    value: t.title,
    label: t.title,
  }));

  const hasFilesToPick = driveFiles.length > 0 || recentList.length > 0;

  return (
    <Box padding="2u">
      <Rows spacing="1.5u">
        {/* If user needs to grant Drive permission for the file picker */}
        {driveScopeMissing && isAuthenticatedGoogle && (
          <div
            style={{
              padding: "10px 12px",
              backgroundColor: "#F8FAFC",
              border: "1px solid #E2E8F0",
              borderRadius: "6px",
            }}
          >
            <Rows spacing="1u">
              <Text size="small" tone="secondary">
                To select spreadsheets from your Google Drive directly in Canva:
              </Text>
              <Button
                variant="secondary"
                onClick={() => onSignInGoogle(true)}
                disabled={isLoading}
                stretch
              >
                Grant Drive File Access
              </Button>
            </Rows>
          </div>
        )}

        {/* Google Spreadsheet Dropdown Selector */}
        {hasFilesToPick && !showManualInput && (
          <FormField
            label="Select Spreadsheet"
            description="Choose a spreadsheet from your Google account"
            control={(props) => (
              <Select
                {...props}
                options={fileOptions}
                value={selectedFileId}
                onChange={(val) => handleSelectFile(val)}
                disabled={isLoading || isDriveLoading}
              />
            )}
          />
        )}

        {/* Toggle to paste link manually */}
        {hasFilesToPick && (
          <div style={{ display: "flex", justifyContent: "flex-end" }}>
            <button
              type="button"
              onClick={() => setShowManualInput(!showManualInput)}
              style={{
                background: "none",
                border: "none",
                fontSize: "11px",
                color: "#64748B",
                cursor: "pointer",
                textDecoration: "underline",
                padding: 0,
              }}
            >
              {showManualInput ? "Back to spreadsheet list" : "Paste link manually"}
            </button>
          </div>
        )}

        {/* Google Sheet URL Input (when no files found or manual mode active) */}
        {(!hasFilesToPick || showManualInput) && (
          <FormField
            label="Google Sheet Link"
            description="Link to your architectural or interior finish schedule"
            control={(props) => (
              <TextInput
                {...props}
                type="url"
                value={url}
                onChange={(val) => setUrl(val)}
                placeholder="https://docs.google.com/spreadsheets/d/..."
                disabled={isLoading}
              />
            )}
          />
        )}

        {/* Sheet Tab Dropdown (shown when tabs exist) */}
        {tabOptions.length > 0 && (
          <FormField
            label="Select Sheet Page / Tab"
            description="Choose the schedule page to load"
            control={(props) => (
              <Select
                {...props}
                options={tabOptions}
                value={selectedTab || tabOptions[0]?.value}
                onChange={(val) => onTabChange(val)}
                disabled={isLoading}
              />
            )}
          />
        )}

        {/* Connect Action Button */}
        {!hasLoadedRecords && (
          <Button
            variant="primary"
            onClick={handleConnect}
            disabled={isLoading || !url.trim() || isInspecting}
            loading={isLoading || isInspecting}
            stretch
          >
            {isInspecting ? "Reading Sheet..." : "Connect Schedule"}
          </Button>
        )}
      </Rows>
    </Box>
  );
};
