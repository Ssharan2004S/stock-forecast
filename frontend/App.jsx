import { useState, useEffect, useCallback } from "react";
import {
  ComposedChart, Line, Area, XAxis, YAxis, CartesianGrid,
  Tooltip, ResponsiveContainer, ReferenceLine,
} from "recharts";
import { TrendingUp, TrendingDown, RefreshCw, AlertCircle, Cpu, BarChart2 } from "lucide-react";

// ── Config ────────────────────────────────────────────────────────────── //
const API_BASE = import.meta.env.VITE_API_URL || "";

const POPULAR = [
  { symbol: "AAPL", name: "Apple" },
  { symbol: "GOOGL", name: "Alphabet" },
  { symbol: "MSFT", name: "Microsoft" },
  { symbol: "TSLA", name: "Tesla" },
  { symbol: "NVDA", name: "NVIDIA" },
  { symbol: "AMZN", name: "Amazon" },
  { symbol: "META", name: "Meta" },
  { symbol: "NFLX", name: "Netflix" },
];

// ── Helpers ───────────────────────────────────────────────────────────── //
function fmtPrice(n) {
  return n == null ? "—" : `$${Number(n).toFixed(2)}`;
}
function fmtPct(n) {
  if (n == null) return "—";
  const sign = n >= 0 ? "+" : "";
  return `${sign}${Number(n).toFixed(2)}%`;
}
function shortDate(d) {
  return new Date(d + "T00:00").toLocaleDateString("en-US", { month: "short", day: "numeric" });
}

// ── Custom tooltip ────────────────────────────────────────────────────── //
function ChartTooltip({ active, payload, label }) {
  if (!active || !payload?.length) return null;
  return (
    <div style={{
      background: "var(--surface2)", border: "1px solid var(--border2)",
      borderRadius: 8, padding: "10px 14px", fontSize: 12,
    }}>
      <p style={{ color: "var(--text2)", marginBottom: 6 }}>{label}</p>
      {payload.map((p) =>
        p.value != null && (
          <p key={p.dataKey} style={{ color: p.color, fontFamily: "DM Mono, monospace" }}>
            {p.name}: {fmtPrice(p.value)}
          </p>
        )
      )}
    </div>
  );
}

// ── Metric card ───────────────────────────────────────────────────────── //
function MetricCard({ label, value, sub, accent }) {
  return (
    <div style={{
      background: "var(--surface)", border: "1px solid var(--border)",
      borderRadius: "var(--radius)", padding: "14px 16px",
    }}>
      <p style={{ fontSize: 11, color: "var(--text3)", marginBottom: 6, textTransform: "uppercase", letterSpacing: "0.08em" }}>
        {label}
      </p>
      <p style={{ fontSize: 22, fontWeight: 600, color: accent || "var(--text)", fontFamily: "DM Mono, monospace", lineHeight: 1 }}>
        {value}
      </p>
      {sub && <p style={{ fontSize: 11, color: "var(--text2)", marginTop: 4 }}>{sub}</p>}
    </div>
  );
}

// ── Main App ──────────────────────────────────────────────────────────── //
export default function App() {
  const [ticker, setTicker] = useState("AAPL");
  const [inputTicker, setInputTicker] = useState("AAPL");
  const [model, setModel] = useState("lstm");
  const [days, setDays] = useState(30);
  const [period, setPeriod] = useState("1y");
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  const fetchForecast = useCallback(async (t, m, d, p) => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch(`${API_BASE}/api/forecast?ticker=${t}&model=${m}&days=${d}&period=${p}`);
      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.detail || "Request failed");
      }
      setData(await res.json());
    } catch (e) {
      setError(e.message);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { fetchForecast(ticker, model, days, period); }, []);

  const handleSearch = () => {
    const t = inputTicker.toUpperCase().trim();
    if (!t) return;
    setTicker(t);
    fetchForecast(t, model, days, period);
  };

  const handleModelChange = (m) => {
    setModel(m);
    fetchForecast(ticker, m, days, period);
  };

  const handleDaysChange = (d) => {
    setDays(d);
    fetchForecast(ticker, model, d, period);
  };

  // Merge historical + forecast into one chart array
  const chartData = (() => {
    if (!data) return [];
    const hist = data.historical.map((h) => ({
      date: shortDate(h.date),
      price: h.price,
    }));
    // Overlap: last historical point connects to first forecast
    const fc = data.forecast.map((f, i) => ({
      date: shortDate(f.date),
      forecast: f.price,
      upper: f.upper,
      lower: f.lower,
      // connect at boundary
      ...(i === 0 ? { price: data.current_price } : {}),
    }));
    return [...hist, ...fc];
  })();

  const isUp = data ? data.change_pct >= 0 : true;
  const metrics = data?.metrics || {};

  return (
    <div style={{ minHeight: "100vh", background: "var(--bg)" }}>
      {/* ── Header ── */}
      <header style={{
        borderBottom: "1px solid var(--border)",
        padding: "16px 32px",
        display: "flex",
        alignItems: "center",
        justifyContent: "space-between",
        gap: 16,
      }}>
        <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
          <div style={{
            width: 32, height: 32, borderRadius: 8,
            background: "linear-gradient(135deg, var(--accent), var(--accent2))",
            display: "flex", alignItems: "center", justifyContent: "center",
          }}>
            <TrendingUp size={16} color="#000" />
          </div>
          <span style={{ fontSize: 18, fontWeight: 700, letterSpacing: "-0.02em" }}>StockSeer</span>
          <span style={{
            fontSize: 10, background: "var(--surface2)", color: "var(--accent)",
            border: "1px solid var(--accent)", borderRadius: 4, padding: "2px 6px",
            fontFamily: "DM Mono, monospace", letterSpacing: "0.05em",
          }}>AI</span>
        </div>

        {/* Search */}
        <div style={{ display: "flex", gap: 8, flex: 1, maxWidth: 400 }}>
          <input
            value={inputTicker}
            onChange={(e) => setInputTicker(e.target.value.toUpperCase())}
            onKeyDown={(e) => e.key === "Enter" && handleSearch()}
            placeholder="Enter ticker (e.g. AAPL)"
            style={{
              flex: 1, background: "var(--surface)", border: "1px solid var(--border2)",
              borderRadius: "var(--radius)", padding: "8px 14px", color: "var(--text)",
              fontSize: 14, outline: "none",
            }}
          />
          <button
            onClick={handleSearch}
            disabled={loading}
            style={{
              background: "var(--accent)", color: "#000", border: "none",
              borderRadius: "var(--radius)", padding: "8px 18px", fontWeight: 600,
              fontSize: 14, cursor: "pointer", opacity: loading ? 0.6 : 1,
            }}
          >
            {loading ? "…" : "Search"}
          </button>
        </div>
      </header>

      <main style={{ maxWidth: 1100, margin: "0 auto", padding: "24px 24px" }}>
        {/* ── Quick tickers ── */}
        <div style={{ display: "flex", gap: 8, flexWrap: "wrap", marginBottom: 24 }}>
          {POPULAR.map((t) => (
            <button
              key={t.symbol}
              onClick={() => { setTicker(t.symbol); setInputTicker(t.symbol); fetchForecast(t.symbol, model, days, period); }}
              style={{
                background: ticker === t.symbol ? "var(--surface2)" : "transparent",
                border: `1px solid ${ticker === t.symbol ? "var(--border2)" : "var(--border)"}`,
                borderRadius: 6, padding: "5px 12px", fontSize: 12, color: ticker === t.symbol ? "var(--text)" : "var(--text2)",
                cursor: "pointer", fontWeight: ticker === t.symbol ? 600 : 400,
              }}
            >
              {t.symbol}
            </button>
          ))}
        </div>

        {/* ── Error ── */}
        {error && (
          <div style={{
            display: "flex", alignItems: "center", gap: 10,
            background: "rgba(255,107,107,0.1)", border: "1px solid rgba(255,107,107,0.3)",
            borderRadius: "var(--radius)", padding: "12px 16px", marginBottom: 24,
          }}>
            <AlertCircle size={16} color="var(--danger)" />
            <span style={{ fontSize: 14, color: "var(--danger)" }}>{error}</span>
          </div>
        )}

        {/* ── Controls row ── */}
        <div style={{ display: "flex", gap: 12, marginBottom: 24, flexWrap: "wrap", alignItems: "center" }}>
          {/* Model toggle */}
          <div style={{
            display: "flex", background: "var(--surface)", border: "1px solid var(--border)",
            borderRadius: "var(--radius)", padding: 4, gap: 4,
          }}>
            {["lstm", "arima"].map((m) => (
              <button
                key={m}
                onClick={() => handleModelChange(m)}
                style={{
                  background: model === m ? "var(--surface2)" : "transparent",
                  border: model === m ? "1px solid var(--border2)" : "1px solid transparent",
                  borderRadius: 6, padding: "6px 16px", fontSize: 13,
                  color: model === m ? "var(--text)" : "var(--text2)",
                  cursor: "pointer", fontWeight: model === m ? 600 : 400,
                  display: "flex", alignItems: "center", gap: 6,
                }}
              >
                {m === "lstm" ? <Cpu size={13} /> : <BarChart2 size={13} />}
                {m.toUpperCase()}
              </button>
            ))}
          </div>

          {/* Forecast days */}
          <div style={{ display: "flex", gap: 6 }}>
            {[7, 14, 30, 60].map((d) => (
              <button
                key={d}
                onClick={() => handleDaysChange(d)}
                style={{
                  background: days === d ? "var(--accent)" : "var(--surface)",
                  color: days === d ? "#000" : "var(--text2)",
                  border: `1px solid ${days === d ? "var(--accent)" : "var(--border)"}`,
                  borderRadius: 6, padding: "6px 12px", fontSize: 12,
                  cursor: "pointer", fontWeight: days === d ? 600 : 400,
                }}
              >
                {d}d
              </button>
            ))}
          </div>

          {/* Period */}
          <select
            value={period}
            onChange={(e) => { setPeriod(e.target.value); fetchForecast(ticker, model, days, e.target.value); }}
            style={{
              background: "var(--surface)", border: "1px solid var(--border)", color: "var(--text2)",
              borderRadius: "var(--radius)", padding: "6px 12px", fontSize: 13, cursor: "pointer",
            }}
          >
            <option value="6mo">6 months history</option>
            <option value="1y">1 year history</option>
            <option value="2y">2 years history</option>
          </select>

          {/* Refresh */}
          <button
            onClick={() => fetchForecast(ticker, model, days, period)}
            disabled={loading}
            style={{
              marginLeft: "auto", background: "transparent",
              border: "1px solid var(--border)", borderRadius: "var(--radius)",
              padding: "6px 12px", color: "var(--text2)", cursor: "pointer",
              display: "flex", alignItems: "center", gap: 6, fontSize: 13,
            }}
          >
            <RefreshCw size={13} className={loading ? "spin" : ""} />
            Refresh
          </button>
        </div>

        {/* ── Metrics row ── */}
        {data && (
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(150px,1fr))", gap: 12, marginBottom: 24 }}>
            <MetricCard label="Current Price" value={fmtPrice(data.current_price)} />
            <MetricCard
              label={`${days}d Forecast`}
              value={fmtPrice(data.forecast_price)}
              sub={fmtPct(data.change_pct)}
              accent={isUp ? "var(--accent)" : "var(--danger)"}
            />
            <MetricCard label="RMSE" value={metrics.rmse ?? "—"} sub="Lower is better" />
            <MetricCard label="MAE" value={metrics.mae ?? "—"} sub="Mean absolute error" />
            <MetricCard label="Direction Acc." value={metrics.direction_accuracy != null ? `${metrics.direction_accuracy}%` : "—"} />
            <MetricCard label="MAPE" value={metrics.mape != null ? `${metrics.mape}%` : "—"} sub="Mean abs % error" />
          </div>
        )}

        {/* ── Chart ── */}
        <div style={{
          background: "var(--surface)", border: "1px solid var(--border)",
          borderRadius: "var(--radius-lg)", padding: "20px 16px 10px",
          position: "relative",
        }}>
          {/* Ticker label */}
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 16, paddingLeft: 8 }}>
            <div style={{ display: "flex", alignItems: "baseline", gap: 10 }}>
              <span style={{ fontSize: 20, fontWeight: 700 }}>{data?.ticker || ticker}</span>
              {data && (
                <span style={{
                  fontSize: 13, color: isUp ? "var(--accent)" : "var(--danger)",
                  display: "flex", alignItems: "center", gap: 4,
                }}>
                  {isUp ? <TrendingUp size={14} /> : <TrendingDown size={14} />}
                  {fmtPct(data.change_pct)} forecast
                </span>
              )}
            </div>
            <div style={{ display: "flex", gap: 16, fontSize: 11, color: "var(--text3)" }}>
              <span style={{ display: "flex", alignItems: "center", gap: 6 }}>
                <span style={{ width: 20, height: 2, background: "#4d9fff", display: "inline-block" }} />
                Historical
              </span>
              <span style={{ display: "flex", alignItems: "center", gap: 6 }}>
                <span style={{ width: 20, height: 2, background: "var(--accent)", display: "inline-block", borderTop: "2px dashed var(--accent)", height: 0 }} />
                Forecast
              </span>
              <span style={{ display: "flex", alignItems: "center", gap: 6 }}>
                <span style={{ width: 20, height: 10, background: "rgba(63,224,160,0.12)", display: "inline-block", borderRadius: 2 }} />
                95% CI
              </span>
            </div>
          </div>

          {loading && (
            <div style={{
              position: "absolute", inset: 0, display: "flex", flexDirection: "column",
              alignItems: "center", justifyContent: "center",
              background: "rgba(10,11,14,0.7)", borderRadius: "var(--radius-lg)", gap: 12,
            }}>
              <div style={{ width: 36, height: 36, border: "2px solid var(--border2)", borderTopColor: "var(--accent)", borderRadius: "50%", animation: "spin 0.8s linear infinite" }} />
              <span style={{ fontSize: 13, color: "var(--text2)" }}>
                {model === "lstm" ? "Training LSTM model…" : "Fitting ARIMA model…"}
              </span>
            </div>
          )}

          <ResponsiveContainer width="100%" height={360}>
            <ComposedChart data={chartData} margin={{ top: 10, right: 20, bottom: 0, left: 0 }}>
              <defs>
                <linearGradient id="fcBand" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="#3fe0a0" stopOpacity={0.15} />
                  <stop offset="95%" stopColor="#3fe0a0" stopOpacity={0.03} />
                </linearGradient>
              </defs>
              <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.04)" />
              <XAxis
                dataKey="date" tick={{ fill: "#555b6e", fontSize: 11, fontFamily: "DM Mono, monospace" }}
                tickLine={false} axisLine={false}
                interval={Math.floor(chartData.length / 8)}
              />
              <YAxis
                tick={{ fill: "#555b6e", fontSize: 11, fontFamily: "DM Mono, monospace" }}
                tickLine={false} axisLine={false}
                tickFormatter={(v) => `$${v.toFixed(0)}`}
                width={58}
              />
              <Tooltip content={<ChartTooltip />} />
              {/* Confidence band */}
              <Area dataKey="upper" stroke="none" fill="url(#fcBand)" name="Upper CI" connectNulls />
              <Area dataKey="lower" stroke="none" fill="#0a0b0e" name="Lower CI" connectNulls />
              {/* Historical line */}
              <Line dataKey="price" stroke="#4d9fff" strokeWidth={1.5} dot={false} name="Price" connectNulls activeDot={{ r: 4, fill: "#4d9fff" }} />
              {/* Forecast line */}
              <Line dataKey="forecast" stroke="var(--accent)" strokeWidth={2} strokeDasharray="6 3" dot={false} name="Forecast" connectNulls activeDot={{ r: 4, fill: "var(--accent)" }} />
              {/* Split marker */}
              {data && chartData.length > 0 && (
                <ReferenceLine
                  x={shortDate(data.historical[data.historical.length - 1].date)}
                  stroke="rgba(255,255,255,0.15)"
                  strokeDasharray="4 2"
                  label={{ value: "Today", fill: "#555b6e", fontSize: 11, position: "insideTopRight" }}
                />
              )}
            </ComposedChart>
          </ResponsiveContainer>
        </div>

        {/* ── Footer ── */}
        <p style={{ textAlign: "center", fontSize: 12, color: "var(--text3)", marginTop: 24, lineHeight: 1.6 }}>
          For educational purposes only. Not financial advice.<br />
          Model: {model.toUpperCase()} · Ticker: {ticker} · {days}-day forecast · History: {period}
        </p>
      </main>

      <style>{`
        @keyframes spin { to { transform: rotate(360deg); } }
        input:focus { outline: none; border-color: var(--accent) !important; }
        select:focus { outline: none; }
        button:hover { opacity: 0.85; }
      `}</style>
    </div>
  );
}
