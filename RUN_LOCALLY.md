# Run this project in VS Code

Open the `DemandFlow` folder in VS Code.

## Terminal 1 — Python backend

```bash
cd backend
python3 -m venv .venv
source .venv/bin/activate
pip install -r requirements.txt
uvicorn main:app --reload
```

Leave this terminal running.

## Terminal 2 — React frontend

Open a second terminal:

```bash
cd frontend
npm install
npm run dev
```

Open the localhost URL printed by Vite.

## Test the backend first

In a browser, open:

```text
http://localhost:8000/api/health
```

You should see:

```json
{"status":"ok"}
```

Then open:

```text
http://localhost:8000/docs
```

This gives you the FastAPI interactive API documentation.
