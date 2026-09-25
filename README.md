# Construction Expenses Tracker

A full-stack construction expense tracking project with a Python FastAPI backend and a React + TypeScript frontend built with Vite.

## Project structure

- `backend/`
  - `main.py` — Backend entry point that runs the FastAPI app with Uvicorn.
  - `app/app.py` — FastAPI application, endpoints, file upload parsing, and expense creation logic.
  - `app/db.py` — SQLite async database engine and session management.
  - `app/models.py` — SQLAlchemy `Expense` model.
  - `app/schemas.py` — Pydantic request/response schema for expenses.
  - `pyproject.toml` — Backend dependency metadata.
- `frontend/`
  - `src/App.tsx` — Root React component.
  - `src/pages/Home.tsx` — Main UI page with forms, charts, uploads, and expense list.
  - `src/pages/Home.css` — Styles for the homepage.
  - `package.json` — Frontend dependencies and npm scripts.
  - `vite.config.ts` — Vite configuration with React plugin and Babel.
- `Construction Expenses.csv` — Root-level CSV file included in the repository.

## What this app does

- Tracks construction expenses.
- Allows manual expense creation.
- Imports expenses from CSV or Excel files.
- Stores expense data in a local SQLite database (`backend/test.db`).
- Displays summary charts and expense analytics in the frontend.

## Backend details

- Framework: `FastAPI`
- Database: `SQLite` via `SQLAlchemy` and `aiosqlite`
- Endpoints:
  - `GET /expenses` — Returns all stored expenses.
  - `POST /expenses` — Creates a single expense using form data.
  - `GET /loan/sanctioned-amounts` — Returns the sanctioned amount history.
  - `POST /loan/sanctioned-amounts` — Adds a sanctioned amount increment.
  - `POST /upload` — Uploads a CSV or Excel file and inserts expenses in bulk.
- Upload rules:
  - Supported file types: `.csv`, `.xls`, `.xlsx`
  - Header alias normalization supports common names like `amount`, `amt`, `description`, `desc`, `type`, `category`, `name`, `payee`, `vendor`, and date variations.
  - Upload replaces existing expense rows in the database.
- CORS configured for `http://localhost:5173` and `http://127.0.0.1:5173`.

## Frontend details

- Framework: `React` with `TypeScript`
- Bundler: `Vite`
- UI features:
  - Fetch and render live expense data.
  - Add expenses via a form.
  - Upload CSV/Excel expense files.
  - View and add sanctioned loan amounts from the 78 lakh loan summary modal.
  - Display totals, average, category breakdowns, vendor totals, and timeline charts.
- Uses `recharts` for charts and `lucide-react` for icons.
- Default API base URL: `http://localhost:8000` (set in `frontend/src/pages/Home.tsx`).

## Local setup

### Backend

1. Open a terminal in `backend/`
2. Install dependencies:

```powershell
python -m pip install --upgrade pip
python -m pip install .
```

3. Run the backend:

```powershell
python main.py
```

This starts the API on `http://localhost:8000`.

### Frontend

1. Open a terminal in `frontend/`
2. Install dependencies:

```powershell
npm install
```

3. Start the frontend development server:

```powershell
npm run dev
```

This starts the UI on `http://localhost:5173`.

## Useful commands

### Backend

- `python main.py` — Start the FastAPI server.

### Frontend

- `npm run dev` — Start Vite development server.
- `npm run build` — Compile the production build.
- `npm run preview` — Preview the build locally.
- `npm run lint` — Run ESLint across frontend files.

## Notes

- The backend database file is created automatically when the server starts.
- If you change backend or frontend ports, update `API_BASE_URL` in `frontend/src/pages/Home.tsx`.
- The project currently uses `sqlite+aiosqlite:///./test.db` for local persistence.

## Recommended improvements

- Add a root-level `requirements.txt` if you prefer explicit backend dependency installation.
- Add more frontend pages or routing if the app grows beyond a single dashboard.
- Add validation and error handling on the frontend for file uploads and form fields.
