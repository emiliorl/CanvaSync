# CanvaSync: Purpose and Product Goals

Updated: 2026-11-06

## Purpose

Connect Google Sheets to Canva so a design team can import spreadsheet content,
design the resulting table in Canva, and keep its data current without rebuilding
or restyling it.

**Google Sheets is the source of content and cell background colors. Canva is where
users control typography, borders, image presentation, and layout.**

This document defines the product requirements and priorities. It takes precedence
over earlier implementation plans or workarounds when they conflict with these goals.
Requirements below describe the intended product, not a claim that every feature
is implemented today.

## Core priorities

All three requirements are essential. Import alone does not fulfill the purpose
of CanvaSync.

### 1. Import the spreadsheet faithfully

- Import the selected spreadsheet tab and columns into Canva.
- Preserve the source values, blank cells, row order, and selected column order.
- Include the pictures in their corresponding table cells.
- Preserve the background colors of the corresponding source cells on initial import.
- Do not invent colors, IDs, descriptions, or other data when the source is blank.
- Allow users to choose which columns to import rather than requiring a fixed
  three-column layout or specific architectural headers.

### 2. Let the design team work with a table in Canva

- Users can resize each individual column directly in Canva, as with a normal table.
- Users can resize each individual row directly in Canva, as with a normal table.
- Resizing a column or row keeps its cells, text, backgrounds, borders, and pictures aligned.
- Users can edit text formatting, cell colors, borders, alignment, and image presentation.
- Users can move or resize the table as a whole while retaining individual row and
  column control.

A picture of a table does not meet this requirement. A group of independent shapes
and text boxes also does not meet it if users must manually move the other cells
to resize a row or column. Size controls available only in the app before insertion
are an interim tool, not completion of this requirement.

### 3. Update the existing table with one button while preserving its design

After editing Google Sheets, the user clicks **Update data** in CanvaSync. The app
fetches the latest spreadsheet content and updates the already imported table.

- Update changed text and other imported field values in the corresponding cells.
- Replace pictures when their source changes, keeping them in their existing cells.
- Reflect changes to the source row order.
- Keep the table's position, overall layout, column widths, and user-assigned row heights.
- Keep fonts, font sizes, emphasis, text colors, alignment, and border styling.
- Always apply the latest source cell background colors, replacing Canva fill overrides.
- Keep image frame dimensions and presentation settings where compatible with the
  replacement image.
- Preserve the user's selected columns and their chosen presentation order.
- Do not create a duplicate table, require reinsertion, or reset styling to defaults.
- Report success only after updating the existing Canva content. Refreshing data
  in the side panel alone is not a successful table update.

## Content and design ownership

| Property | Initial import | Later data updates |
| --- | --- | --- |
| Cell values | Copy the source values | Update from Google Sheets |
| Pictures | Place in their corresponding cells | Update changed pictures within the existing layout |
| Row order | Match the spreadsheet | Follow source row reordering |
| Selected columns | Use the user's selection and chosen order | Preserve that selection and presentation order |
| Cell background colors | Copy source cell colors; no generated palette | Always follow Google Sheets, including replacing fills changed directly in Canva (user decision, 2026-11-06) |
| Typography, borders, alignment | Provide an editable initial presentation | Preserve Canva styling |
| Row heights and column widths | Provide usable initial sizes | Preserve sizes assigned in Canva |
| Table position | Place the imported table | Preserve its Canva position |

The design-preservation rule also applies when rows move: a row's identity, content,
and customized styling must remain associated. Styles must not accidentally attach
to a different record because its spreadsheet row number changed.

## Synchronization requirements

- Maintain a persistent connection between an imported table, its spreadsheet/tab,
  its columns, and its records.
- Identify records with a stable source key rather than their current row position
  or the text of their specification. A key can be selected by the user; it must
  not require a column specifically named `Revit_ID`.
- Detect missing or duplicate keys and explain the issue rather than updating an
  unrelated row.
- Keep the connection usable after the app is closed and reopened.
- If an update cannot fit inside a user-sized cell, preserve the size and surface
  the problem instead of silently resizing or truncating the source data.
- On failure, preserve the existing design and clearly distinguish a failed or
  partial update from a completed update.

## Acceptance scenario

1. Import a sheet containing IDs, specifications, pictures, colored cells, and an
   additional user-selected column. Verify the imported values and source colors.
2. In Canva, resize one column and one row independently. Verify the surrounding
   cells and pictures stay aligned without manual repositioning.
3. Change the font, borders, a cell's fill, image presentation, and table position.
4. In Google Sheets, change a specification, replace a picture, and reorder records.
5. Click **Update data** once.
6. Verify the existing table shows the new content, source cell colors, and source
   row order, with no duplicate table. Verify customized typography, borders, and
   dimensions remain associated with the same records, including the reordered row.
   Source colors replace Canva cell-fill overrides.
7. Close and reopen CanvaSync, make another source change, and repeat the update.

The core workflow is complete only when this scenario passes in the live Canva editor.

## Supporting requirements

- Use Canva's localization system and language setting rather than a separate language toggle.
- Native Spanish support targets `es-ES` and `es-419`. Canva must provision the
  translated catalogs through app review before Spanish is visible in the live app;
  see [localization setup](canva-bim-sync/LOCALIZATION.md).
- Column widths and row heights have separate collapsible groups under Table dimensions.
- Use clear spreadsheet terminology, such as “Choose the spreadsheet tab to import.”
- Keep column selection and import options flexible for tables beyond architectural finishes.
- Make the distinction between initial import and updating a linked table clear in the UI.

## Current implementation gaps

At the time this document was written:

- Import uses editable shapes, text boxes, and pictures in a group.
- Independent row and column dimensions can be changed in CanvaSync before and
  after insertion. Existing column widths and row heights are read from the design;
  edits in Table dimensions are applied with Update table. Column changes resize
  headers, text boxes, backgrounds, and image slots together and reposition adjacent
  columns. Native table row/column dragging directly in Canva is not implemented.
- Source checks now run every 30 seconds while the panel is visible and on return,
  with a launch icon next to the spreadsheet selector and a manual reload icon next
  to the sheet-tab selector. A separate Update table action fetches
  fresh data and edits an existing linked group, including text and image slots.
- New imports retain their source connection in an invisible marker inside the
  group. Insert is disabled while that source's linked group exists on the current
  page. Earlier imports without a marker are not automatically linked.
- Google Drive file/viewer links are downloaded through the signed-in Google
  account and uploaded to Canva as image bytes, including the preview thumbnail.
  Files need not be public if that account has access. Supported Drive formats are
  PNG, JPEG, WebP, and SVG, limited to roughly 7.5 MB for Canva's data-URL upload path.
  Failed downloads leave the existing table unchanged; replacing bytes under an
  unchanged link is not automatically detected yet.
- Updates require a user-selected unique, nonempty key column. Updates follow those
  keys through row reordering, moving the existing cells and their styling together.
  Updates temporarily ungroup the linked cells, edit page elements, and regroup them
  before syncing; Canva rejects moving or resizing grouped child elements, including
  text edits that change a text box's height. Row-height requests are keyed by record,
  and update checks read current cell dimensions from the design.
  Added/deleted keys and renamed/removed imported columns are rejected before saving;
  row addition/deletion is not implemented. Keep linked tables grouped.
- Existing geometry is retained. Cell fills now follow Google Sheets on every update,
  including on older linked tables. If a fetch returns values without color metadata,
  preserve existing fills rather than treating unavailable colors as white.
  Changed text uses its cell's first
  text region formatting; mixed formatting within a changed cell is not fully
  preserved. Text overflow is estimated and rejected when it may exceed the cell.
  Resized cell rectangles retain exposed fills, image references/flips, opacity, and
  borders; unsupported group effects and image crop settings are not fully preserved.
  Reordering/resizing rotated tables is rejected; content-only updates remain available.
  The complete design-preservation scenario still needs live Canva validation.
- The current approach is a prototype and does not yet meet core priorities 2 and 3.

Technical feasibility must be validated against the full acceptance scenario,
including pictures, table resizing, persistent record identity, and in-place updates.
If a platform constraint prevents a requirement, document the constraint and
evaluate alternatives against these goals. Do not silently redefine a workaround
as completion of the requirement.

## Decisions still to resolve

- How users choose or supply a stable record key when the sheet has none.
- How newly added and deleted source rows should inherit styling or affect the Canva table.
- How to handle renamed, added, or deleted source columns without losing the user's layout.
- Whether manual edits to imported cell values in Canva should be overwritten on
  update or shown as conflicts. Styling must remain protected in either case.

These decisions refine synchronization behavior; they do not reduce the three core priorities.
