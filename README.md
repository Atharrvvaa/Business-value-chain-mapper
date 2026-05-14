# CapMap — Business Capability ↔ IT Landscape Mapper (Phase 2)

> AI-driven semantic mapping of enterprise applications to business capabilities using Qwen2.5 via Ollama.

---

## What This Does

Phase 2 maps **Enterprise Applications from your CMDB** → **Level 2 Business Capabilities** using:

- **Semantic similarity** (50% weight) — sentence-transformers/all-MiniLM-L6-v2
- **Contextual matching** (35% weight) — business workflow and domain terminology overlap
- **Fuzzy name matching** (15% weight) — application names and aliases

The system **does NOT rely primarily on app names**. It understands the business function of each application through description embeddings and contextual reasoning.

---

## Architecture

```
User Uploads:
  CapabilityModel.xlsx  → Level 1 Value Chains + Level 2 Capabilities
  ClientCMDB.xlsx       → Enterprise applications from CMDB

Internal (auto-loaded):
  backend/data/synthetic_app_reference.xlsx  → 41 enterprise app reference records

Pipeline:
  CMDB App → Text Cleaning → Semantic Embedding → Context Matching
          → Fuzzy Name → Score Fusion → AI Mapping (Qwen2.5) → Results
```

### Scoring Formula
```
final_score = 0.15 × fuzzy_name + 0.50 × semantic + 0.35 × context
```

| Score Range | Match Tier |
|-------------|------------|
| ≥ 0.80 | Strong Match |
| 0.60–0.80 | Medium Match |
| < 0.60 | Weak Match |

---

## Tech Stack

| Layer | Technology |
|-------|-----------|
| Frontend | React 18, Vite, TailwindCSS, Framer Motion, Recharts |
| Backend | FastAPI, Python 3.11+ |
| Embeddings | sentence-transformers/all-MiniLM-L6-v2 |
| AI Mapping | Qwen2.5 via Ollama |
| Matching | RapidFuzz + cosine similarity |
| Data | Pandas DataFrames (no database) |

---

## Prerequisites

- Node.js 18+
- Python 3.10+
- [Ollama](https://ollama.ai/) (optional but recommended)

---

## Quick Start

### 1. Clone / Extract

```bash
cd biz-cap-mapper
```

### 2. Install Ollama + Qwen2.5 (Recommended)

```bash
# Install Ollama: https://ollama.ai/download
# Then pull the model:
ollama pull qwen2.5

# Start Ollama (it runs as a background service automatically)
```

> **Without Ollama**: The system will fall back to heuristic keyword-based mapping. Results will be less accurate but the app will still work.

### 3. Backend Setup

```bash
cd backend
python -m venv venv
source venv/bin/activate        # Windows: venv\Scripts\activate
pip install -r requirements.txt
uvicorn main:app --reload --port 8000
```

The backend will:
- Load `data/synthetic_app_reference.xlsx` (41 enterprise apps)
- Download the sentence-transformer model (~90MB) on first run
- Compute and cache embeddings (saved to `cache/reference_embeddings.pkl`)

### 4. Frontend Setup

```bash
cd frontend
npm install
npm run dev
```

Open: http://localhost:5173

---

## Usage

### Step 1 — Upload Data
Navigate to **Upload Data** and drop:
- `CapabilityModel.xlsx` (columns: `level_1_value_chain`, `level_2_capability`)
- `ClientCMDB.xlsx` (columns: `application_name`, `vendor`, `description`)

Sample files are included in `backend/data/`:
- `sample_CapabilityModel.xlsx`
- `sample_ClientCMDB.xlsx`

### Step 2 — Run Mapping
Navigate to **Run Mapping** and click **Run Mapping**. Progress updates in real time.

### Step 3 — Explore Results
- **Capability Tree**: Hierarchical view of value chains → capabilities → apps
- **Analytics**: Heatmaps, confidence distribution, top capabilities, unmapped apps

### Step 4 — Export
Download results as Excel, CSV, or JSON from the mapping results page.

---

## API Documentation

Base URL: `http://localhost:8000`

| Endpoint | Method | Description |
|----------|--------|-------------|
| `/upload/capabilities` | POST | Upload CapabilityModel.xlsx |
| `/upload/cmdb` | POST | Upload ClientCMDB.xlsx |
| `/upload/status` | GET | Check upload status |
| `/mapping/run` | POST | Start mapping pipeline (async) |
| `/mapping/status` | GET | Poll mapping progress |
| `/mapping/results` | GET | Get all results |
| `/mapping/results/by-capability` | GET | Tree-structured results |
| `/analytics/summary` | GET | KPI summary |
| `/analytics/heatmap` | GET | Capability coverage heatmap |
| `/analytics/unmapped` | GET | Unmapped applications list |
| `/analytics/confidence-distribution` | GET | Confidence histogram |
| `/export/excel` | GET | Download Excel |
| `/export/csv` | GET | Download CSV |
| `/export/json` | GET | Download JSON |

Interactive API docs: `http://localhost:8000/docs`

---

## Input File Specifications

### CapabilityModel.xlsx

| Column | Description | Example |
|--------|-------------|---------|
| `level_1_value_chain` | Top-level business domain | `Financial Management` |
| `level_2_capability` | Specific capability | `Financial Accounting` |

### ClientCMDB.xlsx

| Column | Description | Example |
|--------|-------------|---------|
| `application_name` | Application name | `SAP ECC` |
| `vendor` | Software vendor | `SAP` |
| `description` | Business description | `Core ERP for finance and procurement` |
| `business_owner` | Business owner (optional) | `CFO Office` |
| `product_name` | Product name (optional) | `SAP ERP` |

### Synthetic Reference (auto-loaded)

Located at `backend/data/synthetic_app_reference.xlsx`. Contains 41 enterprise applications with rich business context used as the semantic matching corpus.

---

## Docker

```bash
docker-compose up --build
# Frontend: http://localhost:3000
# Backend:  http://localhost:8000
```

---

## Project Structure

```
biz-cap-mapper/
├── backend/
│   ├── api/
│   │   ├── upload.py          # File upload endpoints
│   │   ├── mapping.py         # Mapping trigger + results
│   │   ├── analytics.py       # Analytics endpoints
│   │   └── export.py          # Excel/CSV/JSON export
│   ├── services/
│   │   ├── enrichment/
│   │   │   ├── reference_loader.py     # Loads synthetic reference
│   │   │   └── enrichment_service.py  # Enriches CMDB apps
│   │   ├── mapping/
│   │   │   ├── ai_mapper.py            # Qwen2.5 AI mapping
│   │   │   └── mapping_orchestrator.py # Full pipeline
│   │   └── analytics/
│   │       └── analytics_service.py   # Stats and heatmap
│   ├── prompts/
│   │   └── mapping_prompt.py          # AI prompt templates
│   ├── utils/
│   │   ├── state.py           # In-memory state store
│   │   ├── text_utils.py      # Text cleaning utilities
│   │   └── logger.py          # Structured logging
│   ├── data/
│   │   ├── synthetic_app_reference.xlsx  # Internal reference DB
│   │   ├── sample_CapabilityModel.xlsx   # Sample input
│   │   └── sample_ClientCMDB.xlsx        # Sample input
│   ├── cache/                 # Embedding cache (auto-created)
│   ├── main.py                # FastAPI entry point
│   ├── requirements.txt
│   └── Dockerfile
├── frontend/
│   ├── src/
│   │   ├── pages/
│   │   │   ├── UploadPage.jsx
│   │   │   ├── MappingPage.jsx
│   │   │   ├── CapabilityTreePage.jsx
│   │   │   └── AnalyticsPage.jsx
│   │   ├── components/
│   │   │   ├── Sidebar.jsx
│   │   │   └── FileDropzone.jsx
│   │   ├── services/
│   │   │   └── api.js
│   │   ├── App.jsx
│   │   ├── main.jsx
│   │   └── index.css
│   ├── package.json
│   ├── vite.config.js
│   ├── tailwind.config.js
│   └── Dockerfile
├── docker-compose.yml
└── README.md
```

---

## Extending the System

### Add More Reference Applications
Edit `backend/data/synthetic_app_reference.xlsx` and add rows. Delete `backend/cache/reference_embeddings.pkl` to force re-embedding.

### Switch to a Different LLM
In `backend/services/mapping/ai_mapper.py`, change `OLLAMA_MODEL = "qwen2.5"` to any Ollama model (e.g., `llama3`, `mistral`).

### Future: Neo4j Integration
`backend/utils/state.py` is designed as a drop-in replacement. Replace the in-memory DataFrames with Neo4j graph queries while keeping the same interface.

### RAG-Ready Architecture
The `ReferenceLoader` pre-computes and caches embeddings — it's ready to be wrapped in a vector store (ChromaDB, Pinecone, Weaviate) for retrieval-augmented generation.
