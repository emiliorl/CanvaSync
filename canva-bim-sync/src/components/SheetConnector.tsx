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
  SavedSpreadsheet,
  fetchUserSpreadsheets,
  getRecentSpreadsheets,
  saveRecentSpreadsheet,
  extractSpreadsheetInfo,
} from "../services/googleSheetsService";
import { getActiveGoogleToken } from "../services/googleAuthService";

interface SheetConnectorProps {
  onConnect: (url: string, tabName?: string) => Promise<void>;
  onInspectSheets: (url: string) => Promise<SheetTabInfo[]>;
  onSignInGoogle: () => Promise<void>;
  onSignOutGoogle: () => void;
  isAuthenticatedGoogle: boolean;
  isLoading: boolean;
  spreadsheetTitle?: string;
  availableTabs: SheetTabInfo[];
  selectedTab: string;
  onTabChange: (tab: string) => void;
}

export const SheetConnector: React.FC<SheetConnectorProps> = ({
  onConnect,
  onInspectSheets,
  onSignInGoogle,
  onSignOutGoogle,
  isAuthenticatedGoogle,
  isLoading,
  spreadsheetTitle,
  availableTabs,
  selectedTab,
  onTabChange,
}) => {
  const [url, setUrl] = useState<string>("");
  const [isInspecting, setIsInspecting] = useState<boolean>(false);
  const [driveFiles, setDriveFiles] = useState<DriveSpreadsheetItem[]>([]);
  const [isDriveLoading, setIsDriveLoading] = useState<boolean>(false);
  const [driveError, setDriveError] = useState<string | null>(null);
  const [recentSheets, setRecentSheets] = useState<SavedSpreadsheet[]>([]);
  const [selectedSpreadsheetId, setSelectedSpreadsheetId] = useState<string>("");
  const [isManualInput, setIsManualInput] = useState<boolean>(false);

  // Load recent spreadsheets from localStorage on mount
  useEffect(() => {
    setRecentSheets(getRecentSpreadsheets());
  }, []);

  // When authenticated, auto-fetch the user's spreadsheets from Google Drive
  useEffect(() => {
    if (isAuthenticatedGoogle) {
      loadDriveFiles();
    } else {
      setDriveFiles([]);
      setDriveError(null);
      setSelectedSpreadsheetId("");
    }
  }, [isAuthenticatedGoogle]);

  const loadDriveFiles = async () => {
    setIsDriveLoading(true);
    setDriveError(null);
    try {
      const token = await getActiveGoogleToken();
      if (!token) return;
      const files = await fetchUserSpreadsheets(token);
      setDriveFiles(files);

      // If user has files and no URL is selected yet, select the first spreadsheet
      if (files.length > 0 && !url) {
        const first = files[0];
        if (first) {
          handleSelectFile(first.id);
        }
      }
    } catch (err: any) {
      const msg = err?.message || String(err);
      if (
        msg.includes("Google Drive API has not been used") ||
        msg.includes("disabled") ||
        msg.includes("it is disabled")
      ) {
        setDriveError(
          "Tip: To auto-list spreadsheets directly from your Google Drive, enable 'Google Drive API' in your Google Cloud Console. You can also paste the link below.",
        );
      } else if (msg.includes("Insufficient Permission") || msg.includes("403")) {
        setDriveError(
          "Tip: Drive read permissions needed. Sign out and sign in again to grant permission, or paste the link below.",
        );
      } else {
        setDriveError(`Drive fetch note: ${msg}`);
      }
    } finally {
      setIsDriveLoading(false);
    }
  };

  const handleSelectFile = (fileId: string) => {
    setSelectedSpreadsheetId(fileId);
    if (!fileId) return;

    if (fileId === "MANUAL_INPUT") {
      setIsManualInput(true);
      return;
    }

    setIsManualInput(false);
    const newUrl = `https://docs.google.com/spreadsheets/d/${fileId}`;
    setUrl(newUrl);

    setIsInspecting(true);
    onInspectSheets(newUrl)
      .then(() => {
        // Find title if available
        const found = driveFiles.find((f) => f.id === fileId);
        if (found) {
          saveRecentSpreadsheet({ id: fileId, title: found.name, url: newUrl });
          setRecentSheets(getRecentSpreadsheets());
        }
      })
      .finally(() => setIsInspecting(false));
  };

  // Auto-inspect sheets when user manually pastes a valid URL
  useEffect(() => {
    if (url.includes("/spreadsheets/d/")) {
      const timer = setTimeout(() => {
        try {
          const { spreadsheetId } = extractSpreadsheetInfo(url);
          setSelectedSpreadsheetId(spreadsheetId);
          setIsInspecting(true);
          onInspectSheets(url.trim())
            .then((tabs) => {
              saveRecentSpreadsheet({
                id: spreadsheetId,
                title: spreadsheetTitle || `Spreadsheet (${tabs.length} tabs)`,
                url: url.trim(),
              });
              setRecentSheets(getRecentSpreadsheets());
            })
            .finally(() => setIsInspecting(false));
        } catch {
          // Incomplete URL while typing, ignore
        }
      }, 500);
      return () => clearTimeout(timer);
    }
    return undefined;
  }, [url]);

  const handleSubmit = (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    if (!url.trim()) return;
    onConnect(url.trim(), selectedTab || undefined);
  };

  const tabOptions = availableTabs.map((t) => ({
    value: t.title,
    label: t.title,
  }));

  // Build the list of file options for the dropdown
  const fileOptions: { value: string; label: string }[] = [];

  if (isDriveLoading) {
    fileOptions.push({ value: "", label: "Loading Drive spreadsheets..." });
  } else {
    fileOptions.push({ value: "", label: "-- Select a Google Sheet --" });
  }

  driveFiles.forEach((f) => {
    fileOptions.push({
      value: f.id,
      label: `📄 ${f.name}`,
    });
  });

  recentSheets
    .filter((s) => !driveFiles.some((df) => df.id === s.id))
    .forEach((s) => {
      fileOptions.push({
        value: s.id,
        label: `🕒 ${s.title || "Recent Sheet"}`,
      });
    });

  fileOptions.push({
    value: "MANUAL_INPUT",
    label: "✏️ Enter / Paste link manually...",
  });

  const hasFilesToPick = driveFiles.length > 0 || recentSheets.length > 0;

  return (
    <Box padding="2u">
      <Rows spacing="1.5u">
        {/* Google Authentication Status */}
        <div
          style={{
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            padding: "8px 12px",
            backgroundColor: isAuthenticatedGoogle ? "#F0FDF4" : "#F8FAFC",
            border: `1px solid ${isAuthenticatedGoogle ? "#BBF7D0" : "#E2E8F0"}`,
            borderRadius: "6px",
          }}
        >
          <div style={{ display: "flex", alignItems: "center", gap: "8px", minWidth: 0 }}>
            <span
              style={{
                width: "8px",
                height: "8px",
                borderRadius: "50%",
                backgroundColor: isAuthenticatedGoogle ? "#16A34A" : "#94A3B8",
                flexShrink: 0,
              }}
            />
            <Text size="small">
              {isAuthenticatedGoogle ? "Connected to Google" : "Google Account"}
            </Text>
          </div>

          {isAuthenticatedGoogle ? (
            <Button
              variant="tertiary"
              onClick={onSignOutGoogle}
              disabled={isLoading}
            >
              Sign out
            </Button>
          ) : (
            <Button
              variant="secondary"
              onClick={onSignInGoogle}
              disabled={isLoading}
            >
              Sign in with Google
            </Button>
          )}
        </div>

        {/* Drive Info / Hint (if Drive API is not enabled in Cloud Console) */}
        {driveError && (
          <div
            style={{
              padding: "8px 10px",
              backgroundColor: "#FFFBEB",
              border: "1px solid #FDE68A",
              borderRadius: "6px",
            }}
          >
            <Text size="small" tone="secondary">
              {driveError}
            </Text>
          </div>
        )}

        {/* Google Drive / Saved Spreadsheet Picker Dropdown */}
        {hasFilesToPick && !isManualInput && (
          <FormField
            label="Pick Google Sheet"
            description={
              spreadsheetTitle
                ? `Active: ${spreadsheetTitle}`
                : "Select a spreadsheet from your Google Drive or recent history"
            }
            control={(selectProps) => (
              <Select
                {...selectProps}
                options={fileOptions}
                value={selectedSpreadsheetId}
                onChange={(val) => handleSelectFile(val)}
                disabled={isLoading || isDriveLoading}
              />
            )}
          />
        )}

        {/* Toggle between Dropdown and Manual Link */}
        {hasFilesToPick && (
          <div style={{ display: "flex", justifyContent: "flex-end" }}>
            <Button
              variant="tertiary"
              onClick={() => setIsManualInput(!isManualInput)}
              disabled={isLoading}
            >
              {isManualInput ? "📁 Pick from Drive list" : "✏️ Paste link manually"}
            </Button>
          </div>
        )}

        {/* Manual Google Sheet URL Input */}
        {(!hasFilesToPick || isManualInput) && (
          <FormField
            label={spreadsheetTitle ? `Spreadsheet: ${spreadsheetTitle}` : "Google Sheet Link"}
            description="Paste your Google Sheet URL"
            control={(inputProps) => (
              <TextInput
                {...inputProps}
                type="url"
                value={url}
                onChange={(val) => setUrl(val)}
                placeholder="https://docs.google.com/spreadsheets/d/..."
                disabled={isLoading}
              />
            )}
          />
        )}

        {/* Sheet Page / Tab Dropdown */}
        {tabOptions.length > 0 && (
          <FormField
            label="Select Sheet Page / Tab"
            description="Choose the sheet tab containing room finish specifications"
            control={(selectProps) => (
              <Select
                {...selectProps}
                options={tabOptions}
                value={selectedTab || tabOptions[0]?.value}
                onChange={(val) => onTabChange(val)}
                disabled={isLoading}
              />
            )}
          />
        )}

        {/* Connect / Load Button */}
        <Button
          variant="primary"
          onClick={() => handleSubmit()}
          disabled={isLoading || !url.trim() || isInspecting}
          loading={isLoading || isInspecting}
          stretch
        >
          {isInspecting ? "Inspecting Sheet Tabs..." : "Connect & Load Sheet Page"}
        </Button>
      </Rows>
    </Box>
  );
};
