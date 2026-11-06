import React, { useState, useEffect } from "react";
import {
  Button,
  Rows,
  Box,
  Text,
  Title,
  Checkbox,
} from "@canva/app-ui-kit";
import { BimRoomRecord } from "../types/bim";
import {
  injectScheduleTable,
  syncRoomElementsInPlace,
} from "../services/canvaCanvasService";

interface ScheduleTableManagerProps {
  records: BimRoomRecord[];
  sheetTitle?: string;
  selectedTab?: string;
  onRefresh: () => Promise<void>;
  onSuccess: (msg: string) => void;
  onError: (err: string) => void;
  disabled?: boolean;
}

function computeFingerprint(records: BimRoomRecord[]): string {
  return records
    .map((r) => `${r.revitId}:${r.roomName}:${r.finishSpec}:${r.badgeColorHex}`)
    .join("|");
}

export const ScheduleTableManager: React.FC<ScheduleTableManagerProps> = ({
  records,
  sheetTitle,
  selectedTab,
  onRefresh,
  onSuccess,
  onError,
  disabled,
}) => {
  const [includeImages, setIncludeImages] = useState<boolean>(true);
  const [isInjecting, setIsInjecting] = useState<boolean>(false);
  const [isSyncing, setIsSyncing] = useState<boolean>(false);

  const storageKey = `canvasync_ver_${sheetTitle || "default"}_${selectedTab || "main"}`;
  const [lastInsertedFingerprint, setLastInsertedFingerprint] = useState<string | null>(null);
  const [lastInsertedTime, setLastInsertedTime] = useState<string | null>(null);

  // Load version tracking state on mount or tab change
  useEffect(() => {
    try {
      const saved = localStorage.getItem(storageKey);
      if (saved) {
        const parsed = JSON.parse(saved);
        setLastInsertedFingerprint(parsed.fingerprint || null);
        setLastInsertedTime(parsed.time || null);
      } else {
        setLastInsertedFingerprint(null);
        setLastInsertedTime(null);
      }
    } catch {
      setLastInsertedFingerprint(null);
      setLastInsertedTime(null);
    }
  }, [storageKey]);

  const currentFingerprint = computeFingerprint(records);
  const hasInserted = lastInsertedFingerprint !== null;
  const isUpToDate = hasInserted && lastInsertedFingerprint === currentFingerprint;
  const hasUpdates = hasInserted && !isUpToDate;

  const markVersionInserted = () => {
    const nowTime = new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
    setLastInsertedFingerprint(currentFingerprint);
    setLastInsertedTime(nowTime);
    try {
      localStorage.setItem(
        storageKey,
        JSON.stringify({ fingerprint: currentFingerprint, time: nowTime }),
      );
    } catch {
      // Ignore localStorage errors
    }
  };

  const handleAddTable = async () => {
    setIsInjecting(true);
    try {
      const result = await injectScheduleTable(records, { includeImages });
      markVersionInserted();
      onSuccess(
        `Added schedule (${result.rowsCount} rows${
          result.imagesCount > 0 ? `, ${result.imagesCount} material images` : ""
        }) to slide.`,
      );
    } catch (err: any) {
      onError(err?.message || "Failed to add schedule to Canva slide.");
    } finally {
      setIsInjecting(false);
    }
  };

  const handleSyncTable = async () => {
    setIsSyncing(true);
    try {
      await onRefresh();
      const syncResult = await syncRoomElementsInPlace(records);
      markVersionInserted();
      onSuccess(
        `Synchronized schedule with Google Sheet (${syncResult.updatedCount} text updates).`,
      );
    } catch (err: any) {
      onError(err?.message || "Failed to synchronize schedule.");
    } finally {
      setIsSyncing(false);
    }
  };

  const previewRows = records.slice(0, 3);
  const hasImages = records.some((r) => r.imageUrl);

  return (
    <Box padding="2u">
      <Rows spacing="2u">
        {/* Schedule Summary Card */}
        <div
          style={{
            padding: "12px 14px",
            backgroundColor: "#F8FAFC",
            border: "1px solid #E2E8F0",
            borderRadius: "8px",
          }}
        >
          <div
            style={{
              display: "flex",
              justifyContent: "space-between",
              alignItems: "baseline",
              marginBottom: "8px",
            }}
          >
            <Title size="small">
              {sheetTitle || selectedTab || "Finish Schedule"}
            </Title>
            <Text size="small" tone="secondary">
              {records.length} {records.length === 1 ? "row" : "rows"}
            </Text>
          </div>

          {/* Version Tracking Status Badge */}
          <div
            style={{
              display: "flex",
              alignItems: "center",
              justifyContent: "space-between",
              padding: "6px 10px",
              backgroundColor: isUpToDate ? "#F0FDF4" : hasUpdates ? "#EFF6FF" : "#F1F5F9",
              border: `1px solid ${isUpToDate ? "#BBF7D0" : hasUpdates ? "#BFDBFE" : "#E2E8F0"}`,
              borderRadius: "5px",
              marginBottom: "10px",
              fontSize: "11px",
            }}
          >
            <div style={{ display: "flex", alignItems: "center", gap: "6px" }}>
              <span
                style={{
                  width: "6px",
                  height: "6px",
                  borderRadius: "50%",
                  backgroundColor: isUpToDate ? "#16A34A" : hasUpdates ? "#2563EB" : "#94A3B8",
                  flexShrink: 0,
                }}
              />
              <span style={{ fontWeight: 600, color: isUpToDate ? "#15803D" : hasUpdates ? "#1D4ED8" : "#475569" }}>
                {isUpToDate
                  ? "Slide is up to date"
                  : hasUpdates
                  ? "Updates available in Google Sheet"
                  : "Not yet inserted onto slide"}
              </span>
            </div>
            {lastInsertedTime && (
              <span style={{ color: "#64748B", fontSize: "10px" }}>
                Synced {lastInsertedTime}
              </span>
            )}
          </div>

          {/* Clean Micro Preview of Columns */}
          <div
            style={{
              display: "grid",
              gridTemplateColumns: "70px 1fr 1fr",
              gap: "6px",
              padding: "6px 8px",
              backgroundColor: "#FFFFFF",
              border: "1px solid #E2E8F0",
              borderRadius: "4px",
              fontSize: "11px",
              fontWeight: 600,
              color: "#475569",
              marginBottom: "6px",
            }}
          >
            <div>Revit ID</div>
            <div>Space</div>
            <div>Finish Spec</div>
          </div>

          {/* Sample Preview Rows */}
          {previewRows.map((r) => (
            <div
              key={r.revitId}
              style={{
                display: "grid",
                gridTemplateColumns: "70px 1fr 1fr",
                gap: "6px",
                alignItems: "center",
                padding: "4px 8px",
                fontSize: "11px",
                color: "#1E293B",
                borderBottom: "1px solid #F1F5F9",
              }}
            >
              <div>
                <span
                  style={{
                    display: "inline-block",
                    padding: "1px 6px",
                    borderRadius: "3px",
                    backgroundColor: r.badgeColorHex || "#334155",
                    color: "#FFFFFF",
                    fontSize: "10px",
                    fontWeight: 600,
                  }}
                >
                  {r.revitId}
                </span>
              </div>
              <div
                style={{
                  overflow: "hidden",
                  textOverflow: "ellipsis",
                  whiteSpace: "nowrap",
                }}
              >
                {r.roomName}
              </div>
              <div
                style={{
                  overflow: "hidden",
                  textOverflow: "ellipsis",
                  whiteSpace: "nowrap",
                  color: "#64748B",
                }}
              >
                {r.finishSpec || "-"}
              </div>
            </div>
          ))}

          {records.length > 3 && (
            <div style={{ marginTop: "6px", textAlign: "center" }}>
              <Text size="small" tone="secondary">
                +{records.length - 3} more schedule rows
              </Text>
            </div>
          )}
        </div>

        {/* Option: Include material / texture images */}
        {hasImages && (
          <Checkbox
            label="Include material images"
            checked={includeImages}
            onChange={(_, checked) => setIncludeImages(checked)}
            disabled={disabled || isInjecting || isSyncing}
          />
        )}

        {/* Add Table to Slide */}
        <Button
          variant={hasInserted ? "secondary" : "primary"}
          onClick={handleAddTable}
          disabled={disabled || isInjecting || isSyncing}
          loading={isInjecting}
          stretch
        >
          {hasInserted ? "Re-insert Table on Slide" : "Add Table to Slide"}
        </Button>

        {/* Sync Action: Enabled only when updates exist or when inserted */}
        <Button
          variant={hasUpdates ? "primary" : "secondary"}
          onClick={handleSyncTable}
          disabled={disabled || isInjecting || isSyncing || isUpToDate || !hasInserted}
          loading={isSyncing}
          stretch
        >
          {isUpToDate
            ? "Table is Up to Date"
            : hasUpdates
            ? "Sync Updates from Sheet"
            : "Sync Table from Sheet"}
        </Button>
      </Rows>
    </Box>
  );
};
