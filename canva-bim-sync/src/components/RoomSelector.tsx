import React from "react";
import {
  FormField,
  Select,
  Rows,
  Box,
} from "@canva/app-ui-kit";
import { BimRoomRecord } from "../types/bim";
import { CheckCircle2, Image as ImageIcon } from "lucide-react";

interface RoomSelectorProps {
  records: BimRoomRecord[];
  selectedRecord: BimRoomRecord | null;
  onSelect: (record: BimRoomRecord) => void;
  disabled?: boolean;
}

export const RoomSelector: React.FC<RoomSelectorProps> = ({
  records,
  selectedRecord,
  onSelect,
  disabled = false,
}) => {
  if (records.length === 0) return null;

  const selectOptions = records.map((r) => ({
    value: r.revitId,
    label: `${r.revitId} — ${r.roomName}`,
    description: [r.areaLabel, r.level].filter(Boolean).join(" • "),
  }));

  const handleSelectChange = (value: string) => {
    const found = records.find((r) => r.revitId === value);
    if (found) {
      onSelect(found);
    }
  };

  return (
    <Box padding="2u">
      <Rows spacing="2u">
        <FormField
          label={`Select Room (${records.length} available)`}
          description="Choose an architectural space to place on current slide"
          control={(selectProps) => (
            <Select
              {...selectProps}
              options={selectOptions}
              value={selectedRecord?.revitId || selectOptions[0]?.value}
              onChange={handleSelectChange}
              disabled={disabled}
            />
          )}
        />

        {selectedRecord && (
          <div
            style={{
              borderRadius: "8px",
              border: "1px solid #E2E8F0",
              backgroundColor: "#F8FAFC",
              padding: "12px",
              display: "flex",
              flexDirection: "column",
              gap: "8px",
            }}
          >
            {/* Header with ID and Color pill */}
            <div
              style={{
                display: "flex",
                alignItems: "center",
                justifyContent: "space-between",
              }}
            >
              <div style={{ display: "flex", alignItems: "center", gap: "6px" }}>
                <span
                  style={{
                    display: "inline-block",
                    width: "12px",
                    height: "12px",
                    borderRadius: "3px",
                    backgroundColor: selectedRecord.badgeColorHex || "#1E293B",
                  }}
                />
                <strong style={{ fontSize: "13px", color: "#0F172A" }}>
                  {selectedRecord.revitId}
                </strong>
              </div>

              {selectedRecord.level && (
                <span
                  style={{
                    fontSize: "11px",
                    padding: "2px 6px",
                    backgroundColor: "#E2E8F0",
                    borderRadius: "4px",
                    color: "#334155",
                  }}
                >
                  {selectedRecord.level}
                </span>
              )}
            </div>

            {/* Room Name */}
            <div style={{ fontSize: "14px", fontWeight: 600, color: "#1E293B" }}>
              {selectedRecord.roomName}
            </div>

            {/* Specs Grid */}
            <div
              style={{
                display: "grid",
                gridTemplateColumns: "1fr 1fr",
                gap: "6px",
                fontSize: "12px",
                color: "#475569",
                borderTop: "1px solid #E2E8F0",
                paddingTop: "6px",
              }}
            >
              <div>
                <span style={{ color: "#94A3B8" }}>Area: </span>
                {selectedRecord.areaLabel || "N/A"}
              </div>
              <div>
                <span style={{ color: "#94A3B8" }}>Finish: </span>
                {selectedRecord.finishSpec || "None"}
              </div>
            </div>

            {/* Render Status Indicator */}
            <div
              style={{
                display: "flex",
                alignItems: "center",
                gap: "6px",
                fontSize: "12px",
                marginTop: "4px",
                color: selectedRecord.imageUrl ? "#16A34A" : "#94A3B8",
              }}
            >
              {selectedRecord.imageUrl ? (
                <>
                  <CheckCircle2 size={14} />
                  <span>3D Render Linked & Ready</span>
                </>
              ) : (
                <>
                  <ImageIcon size={14} />
                  <span>No 3D render image link</span>
                </>
              )}
            </div>
          </div>
        )}
      </Rows>
    </Box>
  );
};
