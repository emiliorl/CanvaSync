# CanvaSync: BIM Data Bridge (Inside Canva Extension)

Product requirements and priorities are defined in [PROJECT_GOALS.md](PROJECT_GOALS.md).
The intended workflow is faithful spreadsheet import, independent row/column resizing
directly in Canva, and one-click updates to the existing table that preserve its design.
The current prototype supports in-place updates for existing rows in newly linked
imports, including row reordering by stable keys. Native table resizing and adding
or deleting rows remain incomplete; see
the implementation gaps and acceptance scenario in that document.

A lightweight, zero-cost, privacy-first Canva side-panel application built using the official **Canva Apps SDK** (`@canva/design`, `@canva/asset`, `@canva/platform`, `@canva/app-ui-kit`).

This extension imports spreadsheet data and images into Canva. Its goal is to keep
that content synchronized while preserving the design team's styling and dimensions.

---

## 🛠️ Key Capabilities

- **100% Private Google Sheets Support:** Uses official Google OAuth 2.0 (Google Identity Services) and Google Sheets API v4. No need to make client spreadsheets public.
- **Cross-Workspace Compatible:** Works across different Google domains, personal accounts, and corporate workspaces.
- **Target: style-preserving updates:** Update the existing linked table's data, images, and source row order without losing manual designer adjustments. This remains an implementation priority, not a completed capability.
- **Selective 3D Render Upload:** Uploads external 3D renderings into Canva's active session media store with exact sizing.

---

## 📁 Project Structure

```
CanvaSync/
├── inside_canva_extension_architecture_plan.md   # Architectural blueprint & specification
├── canva-bim-sync/                              # Canva extension source code
│   ├── canva-app.json                           # App manifest & permissions
│   ├── src/
│   │   ├── intents/
│   │   │   └── design_editor/                   # Side-panel editor entrypoint
│   │   │       ├── app.tsx                      # Primary view coordinator
│   │   │       └── index.tsx                    # React root with Canva UI/i18n providers
│   │   ├── components/
│   │   │   ├── SheetConnector.tsx               # Google Sheets URL input & Google OAuth button
│   │   │   ├── RoomSelector.tsx                 # Room dropdown, badge preview & specs
│   │   │   └── ElementInjector.tsx              # In-place sync & slide placement controls
│   │   ├── services/
│   │   │   ├── googleAuthService.ts             # Google Identity Services (GIS) OAuth manager
│   │   │   ├── googleSheetsService.ts           # Google Sheets API v4 & CSV fallback parser
│   │   │   └── canvaCanvasService.ts            # Canva canvas injection & in-place editContent()
│   │   └── types/
│   │       └── bim.ts                           # Architectural space data models
│   └── package.json
└── README.md
```

---

## 🚀 Getting Started

### 1. Start Local Development Server

```bash
cd canva-bim-sync
npm start
```
This runs the local development server on `http://localhost:8080`.

### 2. Preview in Canva Editor

```bash
cd canva-bim-sync
npm run start:preview
```

### 3. Verification Commands

```bash
cd canva-bim-sync
npm run lint:types   # Verify TypeScript types
npm test             # Run Jest unit tests
npm run build        # Build production bundle
```
