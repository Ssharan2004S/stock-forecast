# StockSeer — AI Stock Price Forecasting

A full-stack stock price forecasting app using LSTM neural networks and ARIMA models.
Built with **FastAPI** (backend) + **React/Vite** (frontend).

---

## Project Structure

```
stock-forecast/
├── backend/
│   ├── main.py          # FastAPI app & routes
│   ├── forecaster.py    # LSTM + ARIMA models
│   ├── requirements.txt
│   └── Dockerfile
└── frontend/
    ├── src/
    │   ├── App.jsx      # Main dashboard
    │   └── index.css    # Global styles
    ├── index.html
    ├── package.json
    └── vite.config.js
```

---

## Running Locally

### 1. Backend

```bash
cd backend
python -m venv venv
source venv/bin/activate        # Windows: venv\Scripts\activate
pip install -r requirements.txt
uvicorn main:app --reload
```

API is now at: http://localhost:8000
Swagger docs: http://localhost:8000/docs

### 2. Frontend

```bash
cd frontend
npm install
npm run dev
```

App is now at: http://localhost:5173

The Vite dev server proxies `/api` → `localhost:8000` automatically.

---

## Deploying the Backend to Render (Free Tier)

1. Push your project to a GitHub repository.

2. Go to https://render.com and sign up (free).

3. Click **New → Web Service**.

4. Connect your GitHub repo.

5. Set these settings:
   - **Root directory:** `backend`
   - **Runtime:** Python 3
   - **Build command:** `pip install -r requirements.txt`
   - **Start command:** `uvicorn main:app --host 0.0.0.0 --port $PORT`

6. Click **Create Web Service**. Render will build and deploy your backend.

7. Copy the URL it gives you (e.g. `https://stockseer-api.onrender.com`).

> Note: The free tier spins down after 15 minutes of inactivity.
> The first request after sleep takes ~30 seconds (cold start).

---

## Deploying the Frontend to Vercel (Free Tier)

1. Make sure your backend is deployed and you have its URL.

2. In the `frontend` folder, create a `.env.production` file:
   ```
   VITE_API_URL=https://stockseer-api.onrender.com
   ```
   (Replace with your actual Render URL)

3. Push the updated code to GitHub.

4. Go to https://vercel.com and sign up (free).

5. Click **New Project** → Import your GitHub repo.

6. Set:
   - **Root directory:** `frontend`
   - **Framework preset:** Vite
   - **Build command:** `npm run build`
   - **Output directory:** `dist`

7. Add environment variable in Vercel dashboard:
   - `VITE_API_URL` = `https://your-backend.onrender.com`

8. Click **Deploy**. Done!

Your app will be live at `https://your-project.vercel.app`.

---

## Alternative: Deploy Backend with Docker

If you prefer Docker (e.g. Railway, Fly.io, or a VPS):

```bash
cd backend
docker build -t stockseer-api .
docker run -p 8000:8000 stockseer-api
```

### Deploy to Railway

1. Install Railway CLI: `npm install -g @railway/cli`
2. `railway login`
3. `cd backend && railway init`
4. `railway up`

### Deploy to Fly.io

```bash
cd backend
fly auth login
fly launch          # follow prompts
fly deploy
```

---

## API Reference

### GET /api/forecast

Fetch historical prices and AI forecast.

| Parameter | Type | Default | Description |
|-----------|------|---------|-------------|
| ticker | string | AAPL | Stock ticker symbol |
| model | string | lstm | `lstm` or `arima` |
| days | int | 30 | Days to forecast (7–90) |
| period | string | 1y | History: `6mo`, `1y`, `2y` |

**Example:**
```
GET /api/forecast?ticker=AAPL&model=lstm&days=30&period=1y
```

**Response:**
```json
{
  "ticker": "AAPL",
  "model": "lstm",
  "current_price": 182.40,
  "forecast_price": 194.12,
  "change_pct": 6.48,
  "historical": [{"date": "2024-01-02", "price": 185.20}, ...],
  "forecast": [{"date": "2024-11-01", "price": 186.10, "upper": 190.5, "lower": 181.7}, ...],
  "metrics": {
    "rmse": 3.47,
    "mae": 2.81,
    "mape": 1.54,
    "direction_accuracy": 78.4
  }
}
```

---

## Tech Stack

| Layer | Technology |
|-------|-----------|
| Backend framework | FastAPI |
| ML models | TensorFlow/Keras (LSTM), pmdarima (ARIMA) |
| Data | yfinance |
| Frontend | React 18, Vite |
| Charts | Recharts |
| Backend hosting | Render / Railway / Fly.io |
| Frontend hosting | Vercel / Netlify |

---

## Extending the Project

- Add more technical indicators (RSI, MACD) as LSTM features in `forecaster.py`
- Implement walk-forward validation for more honest backtesting
- Add a database (PostgreSQL) to cache model weights and predictions
- Add user authentication to save watchlists
- Integrate real-time websocket price updates

---

## Disclaimer

This project is for educational purposes only. It is not financial advice. 
Stock price prediction is inherently uncertain. Do not use model outputs for actual trading decisions.
