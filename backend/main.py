from fastapi import FastAPI, HTTPException, Query
from fastapi.middleware.cors import CORSMiddleware
from contextlib import asynccontextmanager
import uvicorn
from forecaster import StockForecaster

forecaster = StockForecaster()

@asynccontextmanager
async def lifespan(app: FastAPI):
    print("Stock Forecast API starting up...")
    yield
    print("Shutting down...")

app = FastAPI(
    title="Stock Price Forecasting API",
    description="LSTM & ARIMA based stock price forecasting",
    version="1.0.0",
    lifespan=lifespan,
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


@app.get("/")
async def root():
    return {"message": "Stock Forecast API is running", "version": "1.0.0"}


@app.get("/api/forecast")
async def get_forecast(
    ticker: str = Query(default="AAPL", description="Stock ticker symbol"),
    model: str = Query(default="lstm", description="Model type: lstm or arima"),
    days: int = Query(default=30, ge=7, le=90, description="Days to forecast"),
    period: str = Query(default="1y", description="Historical data period: 6mo, 1y, 2y"),
):
    if model not in ["lstm", "arima"]:
        raise HTTPException(status_code=400, detail="Model must be 'lstm' or 'arima'")

    ticker = ticker.upper().strip()

    try:
        result = forecaster.forecast(
            ticker=ticker,
            model_type=model,
            forecast_days=days,
            period=period,
        )
        return result
    except ValueError as e:
        raise HTTPException(status_code=404, detail=str(e))
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Forecasting failed: {str(e)}")


@app.get("/api/tickers")
async def get_popular_tickers():
    return {
        "tickers": [
            {"symbol": "AAPL", "name": "Apple Inc."},
            {"symbol": "GOOGL", "name": "Alphabet Inc."},
            {"symbol": "MSFT", "name": "Microsoft Corp."},
            {"symbol": "TSLA", "name": "Tesla Inc."},
            {"symbol": "AMZN", "name": "Amazon.com Inc."},
            {"symbol": "NVDA", "name": "NVIDIA Corp."},
            {"symbol": "META", "name": "Meta Platforms"},
            {"symbol": "NFLX", "name": "Netflix Inc."},
        ]
    }


if __name__ == "__main__":
    uvicorn.run("main:app", host="0.0.0.0", port=8000, reload=True)
