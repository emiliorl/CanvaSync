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
import { Translations } from "../utils/i18n";

interface SheetConnectorProps {
  t: Translations;
  onConnect: (url: string, tabName?: string) => Promise<void>;
  onInspectSheets: (url: string) => Promise<SheetTabInfo[]>;
  onSignInGoogle: (forceConsent?: boolean) => Promise<void>;
  isAuthenticatedGoogle: boolean;
  isLoading: boolean;
  availableTabs: SheetTabInfo[];
  selectedTab: string;
  onTabChange: (tab: string) => void;
  hasLoadedRecords: boolean;
}

export const SheetConnector: React.FC<SheetConnectorProps> = ({
  t,
  onConnect,
  onInspectSheets,
  onSignInGoogle,
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
        // Auto-connect immediately so user doesn't have to click an extra button
        const defaultTab = tabs[0]?.title;
        onConnect(newUrl, defaultTab);
      })
      .finally(() => setIsInspecting(false));
  };

  // Auto-inspect and load when user pastes a URL
  useEffect(() => {
    if (url.includes("/spreadsheets/d/")) {
      const timer = setTimeout(() => {
        try {
          const { spreadsheetId } = extractSpreadsheetInfo(url);
          setSelectedFileId(spreadsheetId);
          setIsInspecting(true);
          onInspectSheets(url.trim())
            .then((tabs) => {
              const defaultTab = tabs[0]?.title;
              onConnect(url.trim(), defaultTab);
            })
            .finally(() => setIsInspecting(false));
        } catch {
          // Incomplete URL while typing, ignore
        }
      }, 600);
      return () => clearTimeout(timer);
    }
    return undefined;
  }, [url]);

  // Build spreadsheet select options
  const recentList = getRecentSpreadsheets();
  const fileOptions: { value: string; label: string }[] = [];

  if (isDriveLoading) {
    fileOptions.push({ value: "", label: t.loadingSpreadsheets });
  } else {
    fileOptions.push({ value: "", label: t.choosePlaceholder });
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
        label: `${s.title} (Reciente)`,
      });
    });

  fileOptions.push({
    value: "MANUAL",
    label: t.pasteLinkManually,
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
                {t.grantDriveTitle}
              </Text>
              <Button
                variant="secondary"
                onClick={() => onSignInGoogle(true)}
                disabled={isLoading}
                stretch
              >
                {t.grantDriveAction}
              </Button>
            </Rows>
          </div>
        )}

        {/* Google Spreadsheet Dropdown Selector */}
        {hasFilesToPick && !showManualInput && (
          <FormField
            label={t.selectSpreadsheet}
            description={t.selectSpreadsheetDesc}
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
              {showManualInput ? t.backToList : t.pasteLinkManually}
            </button>
          </div>
        )}

        {/* Google Sheet URL Input (when manual input is active) */}
        {(!hasFilesToPick || showManualInput) && (
          <FormField
            label={t.googleSheetLink}
            description={t.googleSheetLinkDesc}
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
            label={t.selectTab}
            description={t.selectTabDesc}
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

        {/* Loading status feedback while reading */}
        {isInspecting && (
          <Text size="small" tone="secondary">
            {t.readingSheet}
          </Text>
        )}
      </Rows>
    </Box>
  );
};
