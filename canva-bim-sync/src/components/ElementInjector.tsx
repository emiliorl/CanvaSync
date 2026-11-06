import React, { useState } from "react";
import { Button, Rows, Box, Text, Select, FormField } from "@canva/app-ui-kit";
import { BimRoomRecord } from "../types/bim";
import {
  injectRoomElements,
  syncRoomElementsInPlace,
} from "../services/canvaCanvasService";

interface ElementInjectorProps {
  selectedRecord: BimRoomRecord | null;
  onPlacementComplete: (msg: string) => void;
  onError: (err: string) => void;
  disabled?: boolean;
}

export const ElementInjector: React.FC<ElementInjectorProps> = ({
  selectedRecord,
  onPlacementComplete,
  onError,
  disabled = false,
}) => {
  const [layoutMode, setLayoutMode] = useState<"table" | "card">("table");
  const [isInjecting, setIsInjecting] = useState<boolean>(false);
  const [isSyncing, setIsSyncing] = useState<boolean>(false);

  const handlePlaceNew = async () => {
    if (!selectedRecord) return;
    setIsInjecting(true);

    try {
      const result = await injectRoomElements(selectedRecord, { layoutMode });
      const msg = result.imageUploaded
        ? `Placed "${selectedRecord.revitId}" specification ${layoutMode} with 3D render.`
        : `Placed "${selectedRecord.revitId}" specification ${layoutMode}.`;

      onPlacementComplete(msg);
    } catch (err: any) {
      console.error("Injection error:", err);
      onError(err?.message || "Failed to insert elements into active slide.");
    } finally {
      setIsInjecting(false);
    }
  };

  const handleSyncInPlace = async () => {
    if (!selectedRecord) return;
    setIsSyncing(true);

    try {
      const { updatedCount } = await syncRoomElementsInPlace(selectedRecord);
      if (updatedCount > 0) {
        onPlacementComplete(
          `Updated ${updatedCount} specification field(s) in-place on current slide without shifting layout.`,
        );
      } else {
        onPlacementComplete(
          `No matching text found on this slide. Use "Place on Slide" to insert the elements first.`,
        );
      }
    } catch (err: any) {
      console.error("Sync error:", err);
      onError(err?.message || "In-place sync failed.");
    } finally {
      setIsSyncing(false);
    }
  };

  if (!selectedRecord) return null;

  const layoutOptions = [
    {
      value: "table",
      label: "Architectural Table (ID Cell + Long Description)",
      description: "Generates native Canva table matching your Google Sheet layout",
    },
    {
      value: "card",
      label: "Callout Badge & Title",
      description: "Separate text blocks for custom placement",
    },
  ];

  return (
    <Box padding="2u">
      <Rows spacing="1.5u">
        <FormField
          label="Placement Style"
          description="Choose how specifications are formatted on the slide"
          control={(selectProps) => (
            <Select
              {...selectProps}
              options={layoutOptions}
              value={layoutMode}
              onChange={(val) => setLayoutMode(val as "table" | "card")}
              disabled={disabled || isSyncing || isInjecting}
            />
          )}
        />

        {/* Primary In-Place Sync Button */}
        <Button
          variant="primary"
          onClick={handleSyncInPlace}
          disabled={disabled || isSyncing || isInjecting}
          loading={isSyncing}
          stretch
        >
          Sync Updates In-Place (Keep Layout)
        </Button>

        {/* Place New Elements Button */}
        <Button
          variant="secondary"
          onClick={handlePlaceNew}
          disabled={disabled || isInjecting || isSyncing}
          loading={isInjecting}
          stretch
        >
          {layoutMode === "table" ? "Place Spec Table on Slide" : "Place New Elements on Slide"}
        </Button>

        <Text size="small" tone="secondary">
          "Sync Updates In-Place" updates long material descriptions inside existing cells or text boxes without shifting your coordinates or custom fonts.
        </Text>
      </Rows>
    </Box>
  );
};
