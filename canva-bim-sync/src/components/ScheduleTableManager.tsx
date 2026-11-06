import React, { useState } from "react";
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

  const handleAddTable = async () => {
    setIsInjecting(true);
    try {
      const result = await injectScheduleTable(records, { includeImages });
      onSuccess(
        `Added schedule table (${result.rowsCount} rows) to active slide.`,
      );
    } catch (err: any) {
      onError(err?.message || "Failed to add table to Canva slide.");
    } finally {
      setIsInjecting(false);
    }
  };

  const handleSyncTable = async () => {
    setIsSyncing(true);
    try {
      // 1. Refresh latest data from Google Sheet
      await onRefresh();
      // 2. Safely sync matching elements
      const syncResult = await syncRoomElementsInPlace(records);
      onSuccess(
        `Synchronized schedule from Google Sheet (${syncResult.updatedCount} updates).`,
      );
    } catch (err: any) {
      onError(err?.message || "Failed to synchronize schedule table.");
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

        {/* Option: Include companion render images */}
        {hasImages && (
          <Checkbox
            label="Include 3D render images"
            checked={includeImages}
            onChange={(_, checked) => setIncludeImages(checked)}
            disabled={disabled || isInjecting || isSyncing}
          />
        )}

        {/* Primary Action: Add Complete Schedule Table to Canva Slide */}
        <Button
          variant="primary"
          onClick={handleAddTable}
          disabled={disabled || isInjecting || isSyncing}
          loading={isInjecting}
          stretch
        >
          Add Table to Slide
        </Button>

        {/* Sync Action: Re-fetch latest sheet data and sync */}
        <Button
          variant="secondary"
          onClick={handleSyncTable}
          disabled={disabled || isInjecting || isSyncing}
          loading={isSyncing}
          stretch
        >
          Sync Table from Sheet
        </Button>
      </Rows>
    </Box>
  );
};
