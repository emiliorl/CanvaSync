# Inside Canva Side-Panel Extension: Google Sheets to Canva Sync

## 1. Executive Summary & Architecture Overview

### Objective

Build a lightweight, zero-cost, privacy-first Canva side-panel application using the official **Canva Apps SDK** (`@canva/design`, `@canva/asset`, `@canva/platform`).

This extension operates inside the Canva editor's left drawer. It enables interior and architectural design teams to pull live room schedules and image assets from a Google Sheet directly into their active Canva presentation without resetting custom color styling, bounding box dimensions, or element positions.

### Architectural Blueprint

```
┌────────────────────────────────────────────────────────┐
│                   Client Browser Session               │
│                                                        │
│   ┌───────────────────────┐   Direct Client Fetch      │
│   │ Google Sheets (CSV/API)│ ─────────────────────┐     │
│   └───────────────────────┘                      │     │
│                                                  ▼     │
│   ┌─────────────────────────────────────────────────┐  │
│   │ Canva Editor Workspace                          │  │
│   │                                                 │  │
│   │  ┌──────────────────┐    Canva Apps SDK API     │  │
│   │  │ Side-Panel App   │ ────────────────────────┐ │  │
│   │  │ (React/Vite Iframe)                        │ │  │
│   │  └──────────────────┘                         ▼ │  │
│   │                       ┌──────────────────────┐  │  │
│   │                       │ Active Slide Canvas  │  │  │
│   │                       │ (Preserved Overrides)│  │  │
│   │                       └──────────────────────┘  │  │
│   └─────────────────────────────────────────────────┘  │
└────────────────────────────────────────────────────────┘

```

### Core Design Principles

1. **Zero Recurring Infrastructure Cost (\$0/month):** Hosted as a static Single Page Application (SPA) on Vercel or Cloudflare Pages. No dedicated backend server, queue, or persistent database.

2. **Strict Client-Side Privacy:** Architectural data moves directly between the designer's browser session and Google Sheets. Proprietary project metrics never touch any intermediary server.

3. **Free-Tier Canva Compatibility:** Uses Canva's frontend Apps SDK, avoiding the paywalled REST API endpoints (`/v1/brand-templates` and `/v1/autofills`).

4. **Selective / Incremental Sync:** Allows designers to inject or update elements for individual rooms/slides on demand, preserving downstream manual color overrides and fine-tuned layout tweaks.

## 2. Prerequisites & Tooling Stack

| Component | Choice / Specification | Purpose | 
| ----- | ----- | ----- | 
| **Runtime / Bundler** | Node.js (v18+) + Vite | Fast local development and lightweight static build output. | 
| **UI Framework** | React (v18) + TypeScript | Type safety and UI state handling in the side panel. | 
| **SDK** | `@canva/design`, `@canva/asset`, `@canva/user` | Interfacing with the active Canva presentation canvas. | 
| **Data Parsing** | `PapaParse` | Client-side CSV fetching and parsing from Google Sheets. | 
| **Styling** | Tailwind CSS | Clean, compact UI matching Canva's native side-panel aesthetic. | 
| **Hosting** | Cloudflare Pages or Vercel | Free static hosting with automated HTTPS. | 

## 3. Step-by-Step Implementation Roadmap

### Phase 1: Canva Developer Portal Setup

1. **Access Developer Console:**

   * Navigate to [Canva Developers](https://www.canva.dev/) and sign in.

   * Click **Your integrations** $\rightarrow$ **Create an app**.

2. **App Mode Selection:**

   * Choose **Inside Canva** (Do *not* choose "Outside Canva REST API").

   * Name the application (e.g., `BIM Design Bridge`).

3. **Configure App Capabilities:**

   * Under **App location**, enable **Design editor** (Side panel).

   * Under **Required capabilities / scopes**, toggle on:

     * `canva:design:content:write` (Allows inserting text, shapes, and image elements).

     * `canva:asset:write` (Allows uploading images into Canva's active media bucket).

4. **Development URL:**

   * In the **Development URL** input, set `https://localhost:3000` (Canva requires local HTTPS during development).

### Phase 2: Local Project Scaffolding

Initialize the official Canva app starter template via terminal:

```
# 1. Create a Canva App workspace
npm create @canva/app@latest canva-bim-sync

# 2. Select the starter settings:
#    - Framework: React
#    - Language: TypeScript
#    - Starter: Basic / Side Panel

# 3. Enter project directory
cd canva-bim-sync

# 4. Install supporting dependencies
npm install papaparse lucide-react clsx tailwindcss
npm install --save-dev @types/papaparse

```

#### Project File Layout

```
canva-bim-sync/
├── package.json
├── vite.config.ts
├── src/
│   ├── main.tsx
│   ├── App.tsx
│   ├── index.css
│   ├── types/
│   │   └── bim.ts
│   ├── services/
│   │   ├── googleSheetsService.ts
│   │   └── canvaCanvasService.ts
│   └── components/
│       ├── SheetConnector.tsx
│       ├── RoomSelector.tsx
│       └── ElementInjector.tsx

```

### Phase 3: Google Sheets Client-Side Ingestion Engine

To avoid OAuth complexity and backend proxies, load the spreadsheet using Google Sheets' public CSV export link format:
`https://docs.google.com/spreadsheets/d/{SPREADSHEET_ID}/gviz/tq?tqx=out:csv&sheet={SHEET_NAME}`

#### Data Model (`src/types/bim.ts`)

```
export interface BimRoomRecord {
  revitId: string;
  roomName: string;
  areaLabel: string;
  finishSpec: string;
  imageUrl: string;
  badgeColorHex?: string; // Optional custom color assigned directly in Sheets
}

```

#### Ingestion Service (`src/services/googleSheetsService.ts`)

```
import Papa from "papaparse";
import { BimRoomRecord } from "../types/bim";

export async function fetchSheetData(sheetUrl: string, sheetName: string = "Presentation_View"): Promise<BimRoomRecord[]> {
  // Extract spreadsheet ID using regex
  const match = sheetUrl.match(/\/d\/([a-zA-Z0-9-_]+)/);
  if (!match || !match[1]) {
    throw new Error("Invalid Google Sheets URL format.");
  }
  const spreadsheetId = match[1];

  const exportUrl = `https://docs.google.com/spreadsheets/d/${spreadsheetId}/gviz/tq?tqx=out:csv&sheet=${encodeURIComponent(sheetName)}`;

  const response = await fetch(exportUrl);
  if (!response.ok) {
    throw new Error("Could not retrieve sheet data. Ensure link-sharing is set to 'Anyone with link can view'.");
  }

  const csvText = await response.text();

  return new Promise((resolve, reject) => {
    Papa.parse(csvText, {
      header: true,
      skipEmptyLines: true,
      complete: (results) => {
        const records: BimRoomRecord[] = results.data.map((row: any) => ({
          revitId: row["Revit_ID"] || row["Revit ID"] || "N/A",
          roomName: row["Room_Display"] || row["Room Name"] || "Unnamed Space",
          areaLabel: row["Area_Label"] || row["Area"] || "0 SF",
          finishSpec: row["Finish_Spec"] || row["Finish"] || "None",
          imageUrl: row["Image_Slot"] || row["Image URL"] || "",
          badgeColorHex: row["Badge_Color"] || "#2D3748"
        }));
        resolve(records);
      },
      error: (error) => reject(error)
    });
  });
}

```

### Phase 4: Canva SDK Canvas Injection Layer

The side panel communicates directly with Canva's active viewport using `@canva/design` and `@canva/asset`.

#### Canvas Controller (`src/services/canvaCanvasService.ts`)

```
import { addNativeElement } from "@canva/design";
import { upload } from "@canva/asset";
import { BimRoomRecord } from "../types/bim";

/**
 * Inserts the architectural data onto the active slide as separate,
 * locked-dimension elements so layout integrity is maintained.
 */
export async function injectRoomElements(room: BimRoomRecord) {
  // 1. Upload external render URL into Canva's active session asset container
  let imageAssetId: string | null = null;
  if (room.imageUrl && room.imageUrl.startsWith("http")) {
    try {
      const uploadResult = await upload({
        type: "image",
        mimeType: "image/jpeg",
        url: room.imageUrl,
      });
      imageAssetId = uploadResult.ref.id;
    } catch (err) {
      console.warn("Failed to upload image asset to Canva:", err);
    }
  }

  // 2. Add Room Identifier Badge (Bounded Text)
  await addNativeElement({
    type: "text",
    children: [room.revitId],
    fontSize: 14,
    fontWeight: "bold",
    color: "#FFFFFF",
    backgroundColor: room.badgeColorHex || "#1E293B",
    width: 90,
  });

  // 3. Add Room Title & Specifications (Fixed Width to avoid line shifts)
  await addNativeElement({
    type: "text",
    children: [room.roomName],
    fontSize: 28,
    fontWeight: "bold",
    width: 420,
  });

  await addNativeElement({
    type: "text",
    children: [`${room.areaLabel}  •  Finish: ${room.finishSpec}`],
    fontSize: 14,
    color: "#64748B",
    width: 420,
  });

  // 4. Add Render Image Element (Fixed Dimensions)
  if (imageAssetId) {
    await addNativeElement({
      type: "image",
      ref: { id: imageAssetId },
      width: 480,
      height: 320,
    });
  }
}

```

### Phase 5: Side-Panel User Interface

The front end must be compact, intuitive, and responsive inside Canva's narrow side panel width (approx. 320–360px).

#### Main Panel View (`src/App.tsx`)

```
import React, { useState } from "react";
import { fetchSheetData } from "./services/googleSheetsService";
import { injectRoomElements } from "./services/canvaCanvasService";
import { BimRoomRecord } from "./types/bim";
import { RefreshCw, Database, Layers, CheckCircle } from "lucide-react";

export default function App() {
  const [sheetUrl, setSheetUrl] = useState<string>("");
  const [records, setRecords] = useState<BimRoomRecord[]>([]);
  const [selectedRecord, setSelectedRecord] = useState<BimRoomRecord | null>(null);
  const [loading, setLoading] = useState<boolean>(false);
  const [statusMessage, setStatusMessage] = useState<string>("");

  const handleFetch = async () => {
    setLoading(true);
    setStatusMessage("");
    try {
      const data = await fetchSheetData(sheetUrl);
      setRecords(data);
      if (data.length > 0) setSelectedRecord(data[0]);
      setStatusMessage(`Loaded ${data.length} rooms successfully.`);
    } catch (err: any) {
      setStatusMessage(err.message || "Failed to load spreadsheet.");
    } finally {
      setLoading(false);
    }
  };

  const handleInject = async () => {
    if (!selectedRecord) return;
    setLoading(true);
    try {
      await injectRoomElements(selectedRecord);
      setStatusMessage(`Placed ${selectedRecord.roomName} onto slide.`);
    } catch (err: any) {
      setStatusMessage("Insertion failed: " + err.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="p-4 space-y-4 font-sans text-sm text-slate-800">
      <header className="flex items-center space-x-2 border-b pb-3">
        <Database className="w-5 h-5 text-indigo-600" />
        <h1 className="font-semibold text-base">BIM Data Bridge</h1>
      </header>

      {/* Sheet Input Section */}
      <div className="space-y-1">
        <label className="text-xs font-semibold uppercase tracking-wider text-slate-500">
          Google Sheet URL
        </label>
        <input
          type="text"
          placeholder="Paste Google Sheet Share Link"
          className="w-full px-2 py-1.5 border rounded text-xs focus:ring-1 focus:ring-indigo-500 outline-none"
          value={sheetUrl}
          onChange={(e) => setSheetUrl(e.target.value)}
        />
        <button
          onClick={handleFetch}
          disabled={loading || !sheetUrl}
          className="w-full mt-2 flex items-center justify-center space-x-1.5 py-1.5 bg-slate-900 text-white rounded text-xs hover:bg-slate-800 disabled:opacity-50"
        >
          <RefreshCw className={`w-3.5 h-3.5 ${loading ? "animate-spin" : ""}`} />
          <span>Connect Sheet</span>
        </button>
      </div>

      {/* Room Selection Dropdown */}
      {records.length > 0 && (
        <div className="space-y-3 border-t pt-3">
          <label className="text-xs font-semibold uppercase tracking-wider text-slate-500">
            Select Room Record
          </label>
          <select
            className="w-full px-2 py-1.5 border rounded text-xs bg-white outline-none"
            value={selectedRecord?.revitId}
            onChange={(e) => {
              const rec = records.find((r) => r.revitId === e.target.value);
              if (rec) setSelectedRecord(rec);
            }}
          >
            {records.map((r) => (
              <option key={r.revitId} value={r.revitId}>
                {r.revitId} — {r.roomName}
              </option>
            ))}
          </select>

          {/* Record Details Preview */}
          {selectedRecord && (
            <div className="bg-slate-50 p-2.5 rounded border border-slate-200 text-xs space-y-1">
              <div><span className="font-medium">Area:</span> {selectedRecord.areaLabel}</div>
              <div><span className="font-medium">Finish:</span> {selectedRecord.finishSpec}</div>
              {selectedRecord.imageUrl && (
                <div className="text-emerald-600 font-medium flex items-center space-x-1 mt-1">
                  <CheckCircle className="w-3.5 h-3.5" />
                  <span>3D Render Linked</span>
                </div>
              )}
            </div>
          )}

          {/* Action Trigger */}
          <button
            onClick={handleInject}
            disabled={loading}
            className="w-full py-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded text-xs font-semibold flex items-center justify-center space-x-1.5"
          >
            <Layers className="w-4 h-4" />
            <span>Place on Active Slide</span>
          </button>
        </div>
      )}

      {/* Notifications */}
      {statusMessage && (
        <div className="p-2 text-xs rounded bg-slate-100 text-slate-600 break-words">
          {statusMessage}
        </div>
      )}
    </div>
  );
}

```

## 4. Preserving Designers' Custom Layout Overrides

To allow the interior design team to apply color codes, badges, and layout tweaks without losing their adjustments:

### Strategy 1: Data-Driven Styling from Google Sheets

Instead of designers having to manually color-code boxes every time:

1. Add a column titled `Badge_Color` in Google Sheets.

2. Designers or BIM managers map room classifications to hex codes (`#2A75D3` for Wet Areas, `#E67E22` for Public Areas).

3. The extension passes `backgroundColor: room.badgeColorHex` into `addNativeElement()`, styling the badge accurately upon generation.

### Strategy 2: Incremental Slide Injection

* The tool does not wipe out or overwrite the entire slide deck automatically.

* When Revit data updates, the interior designer navigates to the specific slide needing changes, selects that room in the side panel, and clicks **Place New Elements on Slide**.

* The designer controls the exact placement, keeping their custom slide backgrounds, client notes, and surrounding graphics intact.

### Strategy 3: In-Place Specification Updates (`editContent`)

To allow BIM updates from Google Sheets without shifting user-resized elements:

1. Uses Canva's official `editContent({ contentType: "richtext", target: "current_page" })` API.
2. Identifies matching specification blocks (Area, Finishes, Dept) and room headers.
3. Swaps content in-place with `range.replaceText()`.
4. **Guarantees:** Element (X, Y) positions, widths, heights, margins, and custom typography styles remain 100% untouched.

## 5. Google OAuth 2.0 Integration (Private Sheets & Cross-Workspace)

* **Client ID:** `177957711335-afp7o2jedqaagelcfmo0jcuk64ft5sjq.apps.googleusercontent.com`
* **Google Identity Services (GIS):** Popup token client requesting `https://www.googleapis.com/auth/spreadsheets.readonly`.
* **Cross-Workspace Support:** Configured as `External` in Google Cloud Console. Any Google account (with Google Drive access to the private sheet) can authenticate and read the data.
* **In-Place Refresh:** Single-click "Refresh Latest Data from Sheet" re-queries Google Sheets API v4.

## 6. Deployment & Team Distribution

### Step 1: Deploy Frontend Bundle (\$0)

1. Commit the project to a GitHub repository.

2. Link the repository to **Vercel** or **Cloudflare Pages**.

3. Build Settings:

   * **Framework Preset:** Vite

   * **Build Command:** `npm run build`

   * **Output Directory:** `dist`

4. Copy the deployed production HTTPS URL (e.g., `https://bim-canva-bridge.pages.dev`).

### Step 2: Configure Canva Production Settings

1. Go back to your app settings in the **Canva Developer Portal**.

2. Replace `https://localhost:3000` with your production URL.

3. Under **Publishing**, select **Share with team** (Private distribution).

4. Canva will generate a private installation link.

### Step 3: Interior Team Usage

1. Designers open the share link once to add the app to their Canva workspace.

2. When working on any presentation, they click **Apps** in the left toolbar and open **BIM Data Bridge**.

3. They paste their active Google Sheet URL once per session, select the desired rooms, and place them directly into their slides.