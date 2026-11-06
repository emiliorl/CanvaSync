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
import { SheetTabInfo } from "../services/googleSheetsService";

interface SheetConnectorProps {
  onConnect: (url: string, tabName?: string) => Promise<void>;
  onInspectSheets: (url: string) => Promise<SheetTabInfo[]>;
  onSignInGoogle: () => Promise<void>;
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

  // Auto-inspect sheets when user enters a valid Google Sheets URL
  useEffect(() => {
    if (url.includes("/spreadsheets/d/")) {
      const timer = setTimeout(() => {
        setIsInspecting(true);
        onInspectSheets(url.trim()).finally(() => setIsInspecting(false));
      }, 500);
      return () => clearTimeout(timer);
    }
    return undefined;
  }, [url]);

  const handleConnect = () => {
    if (!url.trim()) return;
    onConnect(url.trim(), selectedTab || undefined);
  };

  const tabOptions = availableTabs.map((t) => ({
    value: t.title,
    label: t.title,
  }));

  return (
    <Box padding="2u">
      <Rows spacing="1.5u">
        {/* Subtle Google Authentication Status */}
        <div
          style={{
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            padding: "8px 12px",
            backgroundColor: isAuthenticatedGoogle ? "#F0FDF4" : "#F8FAFC",
            border: `1px solid ${isAuthenticatedGoogle ? "#DCFCE7" : "#E2E8F0"}`,
            borderRadius: "6px",
          }}
        >
          <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
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
              {isAuthenticatedGoogle ? "Google Account Connected" : "Private Sheet Access"}
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

        {/* Google Sheet URL Input */}
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

        {/* Sheet Tab Dropdown (shown only when multiple tabs exist) */}
        {tabOptions.length > 1 && (
          <FormField
            label="Sheet Tab"
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

        {/* Connect Action Button (only shown if not yet connected) */}
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
