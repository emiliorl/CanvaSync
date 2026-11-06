import React, { useEffect, useRef, useState } from "react";
import {
  Button,
  Alert,
  Rows,
  Box,
  Text,
  Checkbox,
  FormField,
  NumberInput,
  Select,
} from "@canva/app-ui-kit";
import { useIntl } from "react-intl";
import type { BimRoomRecord, SheetColumn } from "../types/bim";
import {
  buildEditableSchedule,
  defaultColumns,
  getRecordCell,
} from "../services/canvaCanvasService";
import {
  insertLinkedTable,
  readLinkedTable,
  updateLinkedTable,
  linkedValues,
  linkedColors,
  isTransientDesignError,
  type LinkedTable,
} from "../services/linkedTableService";
import type { Translations } from "../utils/i18n";
import { SheetImagePreview } from "./SheetImagePreview";

interface ScheduleTableManagerProps {
  t: Translations;
  records: BimRoomRecord[];
  columns?: SheetColumn[];
  sourceKey?: string;
  sheetTitle?: string;
  selectedTab?: string;
  hasCellColors?: boolean;
  onRefresh: () => Promise<
    | {
        records: BimRoomRecord[];
        columns?: SheetColumn[];
        hasCellColors?: boolean;
      }
    | undefined
  >;
  onSuccess: (msg: string) => void;
  onError: (err: string) => void;
  disabled?: boolean;
}

export const ScheduleTableManager: React.FC<ScheduleTableManagerProps> = ({
  t,
  records,
  columns = defaultColumns,
  sourceKey,
  sheetTitle,
  selectedTab,
  hasCellColors,
  onRefresh,
  onSuccess,
  onError,
  disabled,
}) => {
  const intl = useIntl();
  const [selectedKeys, setSelectedKeys] = useState<string[]>(
    columns.map((column) => column.key),
  );
  const [kinds, setKinds] = useState<Record<string, "text" | "image">>({});
  const [columnWidths, setColumnWidths] = useState<Record<string, number>>({});
  const [liveColumnWidths, setLiveColumnWidths] = useState<
    Record<string, number>
  >({});
  const [pendingColumnWidths, setPendingColumnWidths] = useState<
    Record<string, number>
  >({});
  const [rowHeights, setRowHeights] = useState<Record<number, number>>({});
  const [liveRowHeights, setLiveRowHeights] = useState<Record<string, number>>(
    {},
  );
  const [pendingRowHeights, setPendingRowHeights] = useState<
    Record<string, number>
  >({});
  const [includeImages, setIncludeImages] = useState(true);
  const [busy, setBusy] = useState(false);
  const [lastImport, setLastImport] = useState<LinkedTable | null>(null);
  const [checkingTable, setCheckingTable] = useState(true);
  const [designCheckError, setDesignCheckError] = useState<string | null>(null);
  const operationVersion = useRef(0);
  const [keyColumn, setKeyColumn] = useState(columns[0]?.key || "");
  const operation = useRef(false);
  const context = useRef(sourceKey);
  context.current = sourceKey;
  const storageKey = `canvasync_import_v4_${sourceKey || `${sheetTitle}:${selectedTab}`}`;
  const columnSignature = JSON.stringify(columns);
  useEffect(() => {
    const available: SheetColumn[] = JSON.parse(columnSignature);
    let saved;
    try {
      saved = JSON.parse(localStorage.getItem(storageKey) || "null");
    } catch {
      /* No saved import. */
    }
    setSelectedKeys(
      Array.isArray(saved?.selectedKeys)
        ? saved.selectedKeys.filter((key: string) =>
            available.some((column) => column.key === key),
          )
        : available.map((column) => column.key),
    );
    setKinds(saved?.kinds || {});
    setColumnWidths(saved?.columnWidths || {});
    setRowHeights(saved?.rowHeights || {});
    setIncludeImages(saved?.includeImages ?? true);
    setKeyColumn(available[0]?.key || "");
  }, [storageKey, columnSignature]);

  useEffect(() => {
    let disposed = false;
    let checking = false;
    let pageId = "";
    let transientFailures = 0;
    setLastImport(null);
    setCheckingTable(true);
    setDesignCheckError(null);
    setPendingRowHeights({});
    setPendingColumnWidths({});
    const check = async () => {
      if (
        checking ||
        operation.current ||
        document.visibilityState === "hidden"
      )
        return;
      checking = true;
      const version = operationVersion.current;
      try {
        const state = await readLinkedTable(sourceKey || "");
        if (
          disposed ||
          operation.current ||
          version !== operationVersion.current
        )
          return;
        transientFailures = 0;
        setDesignCheckError(null);
        setLastImport(state.table);
        setLiveRowHeights(state.rowHeights || {});
        setLiveColumnWidths(state.columnWidths || {});
        if (pageId !== state.pageId || !state.table) {
          setPendingRowHeights({});
          setPendingColumnWidths({});
        }
        if (pageId !== state.pageId && state.table) {
          setSelectedKeys(
            state.table.layout.columns.map((column) => column.key),
          );
          setKinds(
            Object.fromEntries(
              state.table.layout.columns.map((column) => [
                column.key,
                column.kind,
              ]),
            ),
          );
          setColumnWidths(state.table.layout.columnWidths || {});
          setRowHeights(state.table.layout.rowHeights || {});
          setIncludeImages(state.table.includeImages);
          setKeyColumn(state.table.keyColumn);
        }
        pageId = state.pageId;
        setCheckingTable(false);
      } catch (error) {
        if (
          !disposed &&
          !operation.current &&
          version === operationVersion.current
        ) {
          if (isTransientDesignError(error) && ++transientFailures < 3) return;
          setCheckingTable(true);
          setDesignCheckError(
            isTransientDesignError(error)
              ? t.designCheckUnavailable
              : t.formatError(error, t.loadError),
          );
        }
      } finally {
        checking = false;
      }
    };
    void check();
    const timer = setInterval(() => void check(), 3000);
    return () => {
      disposed = true;
      clearInterval(timer);
    };
  }, [sourceKey]);

  const selectedColumns = selectedKeys.flatMap((key) => {
    const column = columns.find((item) => item.key === key);
    return column ? [{ ...column, kind: kinds[key] || column.kind }] : [];
  });
  const recordKey = (record: BimRoomRecord) =>
    getRecordCell(record, {
      key: lastImport?.keyColumn || keyColumn,
      title: "",
      kind: "text",
    }).value;
  const previewHeights = lastImport
    ? Object.fromEntries(
        records.map((record, index) => [
          index,
          pendingRowHeights[recordKey(record)] ??
            liveRowHeights[recordKey(record)] ??
            rowHeights[index] ??
            96,
        ]),
      )
    : rowHeights;
  const layout = {
    columns: selectedColumns,
    columnWidths: lastImport
      ? { ...columnWidths, ...liveColumnWidths, ...pendingColumnWidths }
      : columnWidths,
    rowHeights: previewHeights,
  };
  const isCurrent =
    lastImport &&
    Object.keys(pendingRowHeights).length === 0 &&
    Object.keys(pendingColumnWidths).length === 0 &&
    (hasCellColors === false ||
      !lastImport.sourceColors ||
      JSON.stringify(lastImport.sourceColors) ===
        JSON.stringify(linkedColors(records, lastImport.layout))) &&
    lastImport.layout.columns.every((column) =>
      columns.some(
        (item) => item.key === column.key && item.title === column.title,
      ),
    ) &&
    JSON.stringify(lastImport.keys) ===
      JSON.stringify(
        records.map(
          (record) =>
            getRecordCell(record, {
              key: lastImport.keyColumn,
              title: "",
              kind: "text",
            }).value,
        ),
      ) &&
    JSON.stringify(lastImport.values) ===
      JSON.stringify(linkedValues(records, lastImport.layout));
  const blocked = disabled || busy;
  const preview = selectedColumns.length
    ? buildEditableSchedule(records, layout)
    : null;
  const widths = selectedColumns.map(
    (column) =>
      layout.columnWidths[column.key] ||
      (column.kind === "image"
        ? 180
        : /spec|description/i.test(column.title)
          ? 240
          : 160),
  );
  const previewGrid = widths
    .map((width) => `${Math.max(72, Math.min(2000, width))}fr`)
    .join(" ");
  const moreRows = `+${records.length - 3} ${t.moreRows}`;
  const rowLabel = (record: BimRoomRecord, index: number) =>
    `${t.rowLabel(index + 1)}${record.revitId ? ` (${record.revitId})` : ""}`;
  const imageKind = intl.formatMessage({
    defaultMessage: "Image",
    description: "Column import type: image",
  });
  const textKind = intl.formatMessage({
    defaultMessage: "Text",
    description: "Column import type: editable text",
  });

  const moveColumn = (key: string, delta: number) => {
    setSelectedKeys((keys) => {
      const index = keys.indexOf(key);
      const target = index + delta;
      if (index < 0 || target < 0 || target >= keys.length) return keys;
      const next = [...keys];
      next.splice(index, 1);
      next.splice(target, 0, key);
      return next;
    });
  };
  const insert = async () => {
    if (operation.current || lastImport || checkingTable) return;
    if (!selectedColumns.length) {
      onError(t.selectColumnsError);
      return;
    }
    operation.current = true;
    operationVersion.current++;
    setBusy(true);
    try {
      const imported = await insertLinkedTable(records, {
        sourceKey: sourceKey || "",
        includeImages,
        layout,
        keyColumn,
        ...(hasCellColors === false ? { hasCellColors: false } : {}),
      });
      setLastImport(imported);
      try {
        localStorage.setItem(
          storageKey,
          JSON.stringify({
            selectedKeys,
            kinds,
            columnWidths,
            rowHeights,
            includeImages,
          }),
        );
      } catch {
        /* Import still succeeds when storage is unavailable. */
      }
      onSuccess(
        t.addedSuccess(
          records.length,
          includeImages
            ? selectedColumns
                .filter((column) => column.kind === "image")
                .reduce(
                  (count, column) =>
                    count +
                    records.filter(
                      (record) => getRecordCell(record, column).value,
                    ).length,
                  0,
                )
            : 0,
        ),
      );
    } catch (error) {
      onError(t.formatError(error, t.importError));
    } finally {
      operation.current = false;
      setBusy(false);
    }
  };
  const update = async () => {
    if (operation.current || !lastImport || checkingTable) return;
    const source = sourceKey;
    operation.current = true;
    operationVersion.current++;
    setBusy(true);
    try {
      const latest = await onRefresh();
      if (context.current !== source) return;
      if (!latest) throw new Error(t.loadError);
      const importedColumns = lastImport.layout.columns;
      if (
        latest.columns &&
        importedColumns.some(
          (column) =>
            !latest.columns?.some(
              (item) => item.key === column.key && item.title === column.title,
            ),
        )
      )
        throw new Error(
          intl.formatMessage({
            defaultMessage:
              "The sheet columns changed. Restore the imported columns before updating.",
            description: "Linked table schema mismatch",
          }),
        );
      const updated =
        Object.keys(pendingRowHeights).length ||
        Object.keys(pendingColumnWidths).length ||
        latest.hasCellColors === false
          ? await updateLinkedTable(source || "", latest.records, {
              ...(Object.keys(pendingRowHeights).length
                ? { rowHeights: pendingRowHeights }
                : {}),
              ...(Object.keys(pendingColumnWidths).length
                ? { columnWidths: pendingColumnWidths }
                : {}),
              ...(latest.hasCellColors === false
                ? { hasCellColors: false }
                : {}),
            })
          : await updateLinkedTable(source || "", latest.records);
      if (context.current !== source) return;
      setLastImport(updated);
      setLiveRowHeights((heights) => ({ ...heights, ...pendingRowHeights }));
      setLiveColumnWidths((widths) => ({ ...widths, ...pendingColumnWidths }));
      setPendingRowHeights({});
      setPendingColumnWidths({});
      onSuccess(t.tableUpdated);
    } catch (error) {
      onError(t.formatError(error, t.loadError));
    } finally {
      operation.current = false;
      setBusy(false);
    }
  };

  return (
    <Box padding="2u">
      <Rows spacing="2u">
        {designCheckError && <Alert tone="critical">{designCheckError}</Alert>}
        <Text size="small" tone="secondary">
          {lastImport
            ? t.tableStatus(
                records.length,
                isCurrent ? t.slideUpToDate : t.updatesAvailable,
              )
            : t.rowCount(records.length)}
        </Text>
        <details open={!lastImport}>
          <summary>{t.importOptions}</summary>
          <Rows spacing="2u">
            <FormField
              label={t.columnsToImport}
              control={(props) => (
                <Select
                  {...props}
                  type="multi"
                  searchable
                  options={columns.map((column) => ({
                    value: column.key,
                    label: column.title,
                  }))}
                  value={selectedKeys}
                  disabled={blocked || !!lastImport || checkingTable}
                  onChange={(keys) =>
                    setSelectedKeys((previous) => [
                      ...previous.filter((key) => keys.includes(key)),
                      ...keys.filter((key) => !previous.includes(key)),
                    ])
                  }
                />
              )}
            />
            <Text size="small" tone="secondary">
              {selectedColumns.map((column) => column.title).join(" → ")}
            </Text>
            <FormField
              label={t.recordKey}
              description={t.recordKeyHint}
              control={(props) => (
                <Select
                  {...props}
                  value={keyColumn}
                  options={columns.map((column) => ({
                    value: column.key,
                    label: column.title,
                  }))}
                  disabled={blocked || !!lastImport || checkingTable}
                  onChange={setKeyColumn}
                />
              )}
            />
            {!selectedColumns.length && (
              <Text size="small">{t.selectColumnsError}</Text>
            )}
            {selectedColumns.some((column) => column.kind === "image") && (
              <Checkbox
                label={t.includeMaterialImages}
                checked={includeImages}
                disabled={blocked || !!lastImport}
                onChange={(_, checked) => setIncludeImages(checked)}
              />
            )}
          </Rows>
        </details>

        {!!selectedColumns.length && (
          <details>
            <summary>{t.importSettings}</summary>
            <Rows spacing="1u">
              {!lastImport && (
                <Text size="small" tone="secondary">
                  {t.layoutHint}
                </Text>
              )}
              <details>
                <summary>{t.columnSizes}</summary>
                <Rows spacing="1u">
                  {lastImport && (
                    <Text size="small" tone="secondary">
                      {t.resizeColumnHint}
                    </Text>
                  )}
                  {selectedColumns.map((column, index) => (
                    <div
                      key={column.key}
                      style={{
                        borderBottom: "1px solid #E2E8F0",
                        padding: "8px 0",
                      }}
                    >
                      <Rows spacing="1u">
                        <Text size="small">{column.title}</Text>
                        <FormField
                          label={t.columnWidth}
                          control={(props) => (
                            <NumberInput
                              {...props}
                              value={
                                Math.round((widths[index] || 160) * 10) / 10
                              }
                              min={72}
                              max={2000}
                              step={8}
                              disabled={blocked || checkingTable}
                              onChange={(value) => {
                                if (
                                  value !== undefined &&
                                  Number.isFinite(value)
                                ) {
                                  if (lastImport)
                                    setPendingColumnWidths((sizes) => ({
                                      ...sizes,
                                      [column.key]: value,
                                    }));
                                  else
                                    setColumnWidths((sizes) => ({
                                      ...sizes,
                                      [column.key]: Math.max(
                                        72,
                                        Math.min(2000, value),
                                      ),
                                    }));
                                }
                              }}
                            />
                          )}
                        />
                        {!lastImport && (
                          <FormField
                            label={intl.formatMessage({
                              defaultMessage: "Column content",
                              description:
                                "Label for choosing text or image import",
                            })}
                            control={(props) => (
                              <Select
                                {...props}
                                value={column.kind}
                                options={[
                                  { value: "text", label: textKind },
                                  { value: "image", label: imageKind },
                                ]}
                                disabled={blocked || !!lastImport}
                                onChange={(value) =>
                                  setKinds((values) => ({
                                    ...values,
                                    [column.key]:
                                      value === "image" ? "image" : "text",
                                  }))
                                }
                              />
                            )}
                          />
                        )}
                        {!lastImport && (
                          <div style={{ display: "flex", gap: "8px" }}>
                            <Button
                              variant="tertiary"
                              disabled={blocked || !!lastImport || index === 0}
                              onClick={() => moveColumn(column.key, -1)}
                            >
                              {t.moveUp}
                            </Button>
                            <Button
                              variant="tertiary"
                              disabled={
                                blocked ||
                                !!lastImport ||
                                index === selectedColumns.length - 1
                              }
                              onClick={() => moveColumn(column.key, 1)}
                            >
                              {t.moveDown}
                            </Button>
                          </div>
                        )}
                      </Rows>
                    </div>
                  ))}
                </Rows>
              </details>
              <details>
                <summary>{t.rowSizes}</summary>
                <Rows spacing="1u">
                  <Text size="small" tone="secondary">
                    {lastImport ? t.resizeRowHint : t.rowHeightHint}
                  </Text>
                  {records.map((record, index) => (
                    <FormField
                      key={index}
                      label={rowLabel(record, index)}
                      control={(props) => (
                        <NumberInput
                          {...props}
                          value={
                            Math.round((previewHeights[index] || 96) * 10) / 10
                          }
                          min={32}
                          max={2000}
                          step={8}
                          disabled={blocked || checkingTable}
                          onChange={(value) => {
                            if (value !== undefined && Number.isFinite(value)) {
                              if (lastImport)
                                setPendingRowHeights((sizes) => ({
                                  ...sizes,
                                  [recordKey(record)]: value,
                                }));
                              else
                                setRowHeights((sizes) => ({
                                  ...sizes,
                                  [index]: value,
                                }));
                            }
                          }}
                        />
                      )}
                    />
                  ))}
                </Rows>
              </details>
            </Rows>
          </details>
        )}

        {preview && (
          <div style={{ border: "1px solid #CBD5E1", overflow: "auto" }}>
            <div
              style={{
                display: "grid",
                gridTemplateColumns: previewGrid,
                minWidth: `${selectedColumns.length * 70}px`,
                fontSize: "11px",
              }}
            >
              {selectedColumns.map((column) => (
                <div
                  key={column.key}
                  style={{
                    padding: "4px",
                    border: "1px solid #E2E8F0",
                    overflowWrap: "anywhere",
                  }}
                >
                  {column.title}
                </div>
              ))}
              {records.slice(0, 3).flatMap((record, rowIndex) =>
                selectedColumns.map((column) => {
                  const cell = getRecordCell(record, column);
                  return (
                    <div
                      key={`${rowIndex}:${column.key}`}
                      style={{
                        padding: "4px",
                        border: "1px solid #E2E8F0",
                        minHeight: `${Math.max(32, Math.min(2000, previewHeights[rowIndex] ?? 96)) / 2}px`,
                        overflowWrap: "anywhere",
                        backgroundColor: cell.backgroundColor || "transparent",
                      }}
                    >
                      {column.kind === "image"
                        ? includeImages &&
                          /^https?:\/\//i.test(cell.value.trim()) && (
                            <SheetImagePreview
                              url={cell.value}
                              label={column.title}
                              refreshKey={records}
                            />
                          )
                        : cell.value}
                    </div>
                  );
                }),
              )}
            </div>
          </div>
        )}
        {records.length > 3 && (
          <Text size="small" tone="secondary">
            {moreRows}
          </Text>
        )}
        <Button
          variant={lastImport ? "secondary" : "primary"}
          onClick={insert}
          disabled={
            blocked || checkingTable || !!lastImport || !selectedColumns.length
          }
          loading={busy && !lastImport}
          stretch
        >
          {t.addTableToSlide}
        </Button>
        <Button
          variant={lastImport ? "primary" : "secondary"}
          onClick={update}
          disabled={blocked || checkingTable || !lastImport}
          loading={busy && !!lastImport}
          stretch
        >
          {t.updateTable}
        </Button>
        {lastImport && (
          <details>
            <summary>{t.tableHelp}</summary>
            <Text size="small" tone="secondary">
              {t.linkedTableHint}
            </Text>
          </details>
        )}
      </Rows>
    </Box>
  );
};
