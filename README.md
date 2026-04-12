# 3D City Dashboard — Calgary Urban Design with LLM Querying

A full-stack web application that visualizes downtown Calgary buildings in 3D, supports natural language queries to filter buildings, and persists user projects.

---

## Features

1. **3D Building Visualization** — Fetches real building footprints, heights, and zoning data from OpenStreetMap (Overpass API) for downtown Calgary and renders them as extruded 3D shapes using Three.js.
2. **Building Click Popups** — Click any building to see its name, address, height (m + ft), building type, zoning code, and assessed property value.
3. **LLM Query Integration** — Type natural language queries like *"highlight buildings over 100 feet"* or *"show commercial buildings"*. Powered by HuggingFace Inference Providers API (Qwen2.5-7B-Instruct). A HuggingFace API token with Inference Providers access is required.
4. **Project Persistence** — Log in with a username, save the current filter as a named project, and reload it later. All data is stored in SQLite.
5. **Color-coded Legend** — Buildings are color-coded by type (commercial, residential, industrial, etc.).

---

## Architecture

| Layer | Technology |
|-------|-----------|
| Backend | Python 3.8+, Flask, SQLAlchemy |
| Database | SQLite (auto-created on first run) |
| Data Source | OpenStreetMap Overpass API |
| LLM | HuggingFace Inference Providers API (Qwen2.5-7B-Instruct) |
| Frontend | React 18, Vite, Three.js |

---

## Prerequisites

- Python 3.8 or later
- Node.js 18 or later

---

## Setup Instructions

### 1. Clone the repository

```bash
git clone https://github.com/Sparemeh/3D-City-with-LLM-Query.git
cd 3D-City-with-LLM-Query
```

### 2. Start the backend

```bash
cd backend
pip install -r requirements.txt
python app.py
```

The backend starts on `http://localhost:5000`. On first run, it fetches building data from OSM and caches it to `buildings_cache.json`.

### 3. Start the frontend

Open a **new terminal**:

```bash
cd frontend
npm install
npm run dev
```

Open `http://localhost:5173` in your browser.

---

## Getting a HuggingFace API Key (Required)

A HuggingFace token is required to use the LLM query feature.

1. Go to [https://huggingface.co](https://huggingface.co) and create a free account.
2. Navigate to **Profile → Settings → Access Tokens → New token**.
3. Choose **Fine-grained** token type.
4. Under **User permissions**, enable **Inference → Make calls to Inference Providers**.
5. Copy the token (starts with `hf_`).
6. In the app, click the 🔑 key icon in the Query panel and paste your token.

---

## Usage

### Querying buildings
Type a query in the **LLM Query** panel and click **Search**, or click one of the example chips:

| Query | Effect |
|-------|--------|
| `buildings over 50 meters` | Highlights tall buildings |
| `buildings over 100 feet` | Feet are automatically converted |
| `commercial buildings` | Highlights commercial/retail/office |
| `zoning CC-X` | Filters by exact zoning code |
| `residential buildings` | Highlights residential/apartments |
| `buildings under 20 meters` | Highlights low-rise buildings |

### Saving projects
1. Enter a username and click **Login**.
2. Run a query to set an active filter.
3. In the **Projects** panel, enter a project name and click **Save**.
4. Click **Load** next to any saved project to re-apply its filter.

---

## API Endpoints

| Method | Path | Description |
|--------|------|-------------|
| `GET` | `/api/buildings` | Returns all buildings with properties |
| `POST` | `/api/query` | Parses NL query, returns matching building IDs |
| `POST` | `/api/users` | Creates or retrieves a user by username |
| `GET` | `/api/projects/:username` | Returns all saved projects for a user |
| `POST` | `/api/projects` | Saves a new project |
| `DELETE` | `/api/projects/:id` | Deletes a project |

### `POST /api/query` request body
```json
{
  "query": "buildings over 50 meters",
  "hf_api_key": "hf_..."
}
```

### `POST /api/query` response
```json
{
  "filter_spec": { "attribute": "height", "operator": ">", "value": 50 },
  "matching_ids": ["123456", "789012"],
  "description": "Buildings with height greater than 50m"
}
```

---

## Project Structure

```
3D-City-with-LLM-Query/
├── backend/
│   ├── app.py              # Flask API server
│   ├── models.py           # SQLAlchemy User + Project models
│   ├── data_fetcher.py     # OSM Overpass API client + caching
│   ├── llm_service.py      # HuggingFace LLM + rule-based fallback
│   └── requirements.txt
├── frontend/
│   ├── src/
│   │   ├── App.jsx         # Main app component + state
│   │   ├── App.css         # Dark theme styles
│   │   ├── main.jsx        # React entry point
│   │   ├── components/
│   │   │   ├── CityView.jsx       # Three.js 3D scene
│   │   │   ├── BuildingPopup.jsx  # Building info card
│   │   │   ├── QueryPanel.jsx     # NL query input
│   │   │   ├── ProjectPanel.jsx   # Save/load projects
│   │   │   └── UserPanel.jsx      # Username login
│   │   └── services/
│   │       └── api.js      # Fetch wrappers for backend API
│   ├── index.html
│   ├── package.json
│   └── vite.config.js
├── uml/
│   └── uml_diagram.md      # Mermaid class + sequence diagrams
├── MASIV_InternTest_2025.pdf
└── README.md
```

---

## Notes

- Building data is cached after first fetch. Delete `backend/buildings_cache.json` to force a re-fetch.
- Assessed values are simulated from building height × footprint area × a zoning-based multiplier.
- The database file `backend/instance/city_dashboard.db` is created automatically.