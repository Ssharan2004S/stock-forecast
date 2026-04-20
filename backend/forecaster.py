import numpy as np
import yfinance as yf
import warnings
from datetime import datetime, timedelta
from typing import Literal

warnings.filterwarnings("ignore")


class StockForecaster:
    def __init__(self):
        self._cache: dict = {}

    # ------------------------------------------------------------------ #
    #  Public entry point                                                  #
    # ------------------------------------------------------------------ #

    def forecast(
        self,
        ticker: str,
        model_type: Literal["lstm", "arima"],
        forecast_days: int = 30,
        period: str = "1y",
    ) -> dict:
        # Fetch price history
        raw = self._fetch(ticker, period)
        if raw is None or len(raw) < 90:
            raise ValueError(f"Not enough data for '{ticker}'. Check the ticker symbol.")

        dates = [d.strftime("%Y-%m-%d") for d in raw.index]
        prices = [round(float(p), 2) for p in raw.values]

        # Run chosen model
        if model_type == "lstm":
            fc_prices, upper, lower, metrics = self._run_lstm(prices, forecast_days)
        else:
            fc_prices, upper, lower, metrics = self._run_arima(prices, forecast_days)

        # Build forecast date range (skip weekends for realism)
        last_date = raw.index[-1]
        fc_dates = self._future_trading_dates(last_date, forecast_days)

        return {
            "ticker": ticker,
            "model": model_type,
            "historical": [{"date": d, "price": p} for d, p in zip(dates, prices)],
            "forecast": [
                {"date": fd, "price": round(fp, 2), "upper": round(u, 2), "lower": round(l, 2)}
                for fd, fp, u, l in zip(fc_dates, fc_prices, upper, lower)
            ],
            "metrics": metrics,
            "current_price": prices[-1],
            "forecast_price": round(fc_prices[-1], 2),
            "change_pct": round((fc_prices[-1] - prices[-1]) / prices[-1] * 100, 2),
        }

    # ------------------------------------------------------------------ #
    #  Data fetching                                                        #
    # ------------------------------------------------------------------ #

    def _fetch(self, ticker: str, period: str):
        cache_key = f"{ticker}_{period}"
        if cache_key in self._cache:
            cached_time, data = self._cache[cache_key]
            # Cache valid for 1 hour
            if (datetime.now() - cached_time).seconds < 3600:
                return data

        df = yf.download(ticker, period=period, progress=False, auto_adjust=True)
        if df.empty:
            return None

        close = df["Close"].dropna()
        # Flatten multi-index columns that yfinance sometimes returns
        if hasattr(close, "columns"):
            close = close.iloc[:, 0]

        self._cache[cache_key] = (datetime.now(), close)
        return close

    # ------------------------------------------------------------------ #
    #  LSTM model                                                           #
    # ------------------------------------------------------------------ #

    def _run_lstm(self, prices: list, forecast_days: int):
        try:
            from tensorflow.keras.models import Sequential
            from tensorflow.keras.layers import LSTM, Dense, Dropout
            from tensorflow.keras.callbacks import EarlyStopping
            from sklearn.preprocessing import MinMaxScaler
            from sklearn.metrics import mean_squared_error, mean_absolute_error
        except ImportError:
            # Graceful fallback if TF not installed
            return self._run_arima(prices, forecast_days)

        scaler = MinMaxScaler()
        scaled = scaler.fit_transform(np.array(prices).reshape(-1, 1))

        SEQ = 60
        X, y = [], []
        for i in range(SEQ, len(scaled)):
            X.append(scaled[i - SEQ:i, 0])
            y.append(scaled[i, 0])
        X, y = np.array(X), np.array(y)
        X = X.reshape(X.shape[0], X.shape[1], 1)

        # Train / test split (preserve time order)
        split = int(len(X) * 0.85)
        X_train, X_test = X[:split], X[split:]
        y_train, y_test = y[:split], y[split:]

        model = Sequential([
            LSTM(64, return_sequences=True, input_shape=(SEQ, 1)),
            Dropout(0.2),
            LSTM(32, return_sequences=False),
            Dropout(0.2),
            Dense(1),
        ])
        model.compile(optimizer="adam", loss="mse")
        model.fit(
            X_train, y_train,
            epochs=20,
            batch_size=32,
            validation_split=0.1,
            callbacks=[EarlyStopping(monitor="val_loss", patience=5, restore_best_weights=True)],
            verbose=0,
        )

        # Test set evaluation
        y_pred_scaled = model.predict(X_test, verbose=0)
        y_pred = scaler.inverse_transform(y_pred_scaled).flatten()
        y_true = scaler.inverse_transform(y_test.reshape(-1, 1)).flatten()
        rmse = round(float(np.sqrt(mean_squared_error(y_true, y_pred))), 3)
        mae  = round(float(mean_absolute_error(y_true, y_pred)), 3)
        mape = round(float(np.mean(np.abs((y_true - y_pred) / y_true)) * 100), 2)
        direction_acc = round(float(np.mean(
            np.sign(np.diff(y_true)) == np.sign(np.diff(y_pred))
        ) * 100), 1)

        # Recursive multi-step forecast
        last_seq = scaled[-SEQ:].reshape(1, SEQ, 1)
        fc_scaled = []
        for _ in range(forecast_days):
            pred = model.predict(last_seq, verbose=0)[0, 0]
            fc_scaled.append(pred)
            last_seq = np.append(last_seq[:, 1:, :], [[[pred]]], axis=1)

        fc_prices_arr = scaler.inverse_transform(
            np.array(fc_scaled).reshape(-1, 1)
        ).flatten()

        # Confidence band (MC dropout approximation)
        std = float(np.std(y_pred - y_true))
        upper = [p + 1.96 * std for p in fc_prices_arr]
        lower = [p - 1.96 * std for p in fc_prices_arr]

        metrics = {"rmse": rmse, "mae": mae, "mape": mape, "direction_accuracy": direction_acc}
        return fc_prices_arr.tolist(), upper, lower, metrics

    # ------------------------------------------------------------------ #
    #  ARIMA model                                                          #
    # ------------------------------------------------------------------ #

    def _run_arima(self, prices: list, forecast_days: int):
        try:
            from pmdarima import auto_arima
            from statsmodels.tsa.stattools import adfuller
            from sklearn.metrics import mean_squared_error, mean_absolute_error
        except ImportError:
            return self._naive_forecast(prices, forecast_days)

        series = np.array(prices)
        split = int(len(series) * 0.85)
        train, test = series[:split], series[split:]

        model = auto_arima(
            train,
            seasonal=False,
            stepwise=True,
            suppress_warnings=True,
            error_action="ignore",
            max_p=5, max_q=5, max_d=2,
        )

        # Evaluate on test set
        test_preds = model.predict(n_periods=len(test))
        rmse = round(float(np.sqrt(mean_squared_error(test, test_preds))), 3)
        mae  = round(float(mean_absolute_error(test, test_preds)), 3)
        mape = round(float(np.mean(np.abs((test - test_preds) / test)) * 100), 2)
        direction_acc = round(float(np.mean(
            np.sign(np.diff(test)) == np.sign(np.diff(test_preds))
        ) * 100), 1)

        # Retrain on full series and forecast
        model.update(test)
        fc, conf = model.predict(n_periods=forecast_days, return_conf_int=True)

        metrics = {"rmse": rmse, "mae": mae, "mape": mape, "direction_accuracy": direction_acc}
        return fc.tolist(), conf[:, 1].tolist(), conf[:, 0].tolist(), metrics

    # ------------------------------------------------------------------ #
    #  Fallback: naive trend extrapolation (no ML deps)                    #
    # ------------------------------------------------------------------ #

    def _naive_forecast(self, prices: list, forecast_days: int):
        last = prices[-1]
        slope = np.polyfit(range(len(prices[-30:])), prices[-30:], 1)[0]
        fc = [last + slope * (i + 1) for i in range(forecast_days)]
        std = float(np.std(np.diff(prices[-60:])))
        upper = [p + 2 * std for p in fc]
        lower = [p - 2 * std for p in fc]
        metrics = {"rmse": None, "mae": None, "mape": None, "direction_accuracy": None}
        return fc, upper, lower, metrics

    # ------------------------------------------------------------------ #
    #  Helpers                                                              #
    # ------------------------------------------------------------------ #

    @staticmethod
    def _future_trading_dates(last_date, n: int) -> list:
        dates = []
        current = last_date
        while len(dates) < n:
            current += timedelta(days=1)
            if current.weekday() < 5:  # Mon–Fri
                dates.append(current.strftime("%Y-%m-%d"))
        return dates
