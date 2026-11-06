# CanvaSync: BIM Data Bridge (Inside Canva Extension)

A lightweight, zero-cost, privacy-first Canva side-panel application built using the official **Canva Apps SDK** (`@canva/design`, `@canva/asset`, `@canva/platform`, `@canva/app-ui-kit`).

This extension allows interior design and architectural teams to pull live room schedules and 3D image assets from Google Sheets directly into active Canva slides without overriding custom color codes, bounding box dimensions, or element positions.

---

## 🛠️ Key Capabilities

- **100% Private Google Sheets Support:** Uses official Google OAuth 2.0 (Google Identity Services) and Google Sheets API v4. No need to make client spreadsheets public.
- **Cross-Workspace Compatible:** Works across different Google domains, personal accounts, and corporate workspaces.
- **In-Place Sync (`editContent`):** Update room areas, finishes, and specs without shifting element coordinates, resizing boxes, or wiping out manual designer adjustments.
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
