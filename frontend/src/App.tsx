import { useEffect, useMemo, useState } from 'react'
import {
  LineChart,
  Line,
  AreaChart,
  Area,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  ReferenceLine,
} from 'recharts'

const API = 'http://localhost:8000'

const C = {
  bg: '#F5F3EE',
  surface: '#FFFFFF',
  text: '#242424',
  muted: '#6B6B65',
  olive: '#68735C',
  oliveLight: '#E5E8DE',
  warning: '#B4863A',
  risk: '#A85C52',
  border: '#DDDCD5',
  borderFaint: '#ECEAE3',
}

type DashboardData = {
  product: string
  region: string
  current_inventory: number
  lead_time_days: number
  forecast: { date: string; demand: number }[]
  history: { date: string; units: number }[]
  metrics: {
    thirty_day_demand: number
    avg_daily_demand: number
    safety_stock: number
    reorder_point: number
    recommended_order: number
    coverage_days: number
    risk: string
    recommendation: string
  }
  model: {
    mae: number
    rmse: number
    train_test: string
  }
}

type InventoryRow = {
  product: string
  region: string
  stock: number
  demand: number
  reorder: number
  risk: string
  order: number
}

function RiskBadge({ level }: { level: string }) {
  const styles: Record<string, { bg: string; color: string }> = {
    Low: { bg: C.oliveLight, color: C.olive },
    Medium: { bg: '#FAF0E0', color: C.warning },
    High: { bg: '#FAF0F0', color: C.risk },
  }
  const s = styles[level] ?? styles.Low
  return (
    <span style={{
      background: s.bg, color: s.color, fontSize: 11, fontWeight: 600,
      padding: '2px 7px', borderRadius: 4, letterSpacing: '0.02em',
    }}>
      {level}
    </span>
  )
}

const ChartTooltip = ({ active, payload, label }: any) => {
  if (!active || !payload?.length) return null
  return (
    <div style={{
      fontFamily: "'Source Sans 3', sans-serif", fontSize: 12,
      background: C.surface, border: `1px solid ${C.border}`,
      borderRadius: 6, padding: '7px 12px', color: C.text,
    }}>
      <div style={{ color: C.muted, marginBottom: 2 }}>{label}</div>
      <div style={{ fontWeight: 600 }}>{payload[0].value} units</div>
    </div>
  )
}

function NavItem({ label, active, onClick }: {
  label: string
  active: boolean
  onClick: () => void
}) {
  return (
    <button
      onClick={onClick}
      style={{
        width: '100%', textAlign: 'left', padding: '7px 24px',
        fontSize: 13, fontFamily: "'Source Sans 3', sans-serif",
        color: active ? C.text : C.muted,
        fontWeight: active ? 500 : 400,
        background: 'none', border: 'none', cursor: 'pointer',
        display: 'flex', alignItems: 'center', gap: 10,
      }}
    >
      <span style={{
        width: 4, height: 4, borderRadius: '50%',
        background: active ? C.olive : 'transparent',
      }} />
      {label}
    </button>
  )
}

function Sidebar({ active, setActive }: {
  active: string
  setActive: (v: string) => void
}) {
  const nav = ['Overview', 'Demand', 'Inventory', 'Replenishment', 'Reports', 'Settings']

  return (
    <aside style={{
      position: 'fixed', top: 0, left: 0, bottom: 0, width: 200,
      background: C.surface, borderRight: `1px solid ${C.border}`,
      display: 'flex', flexDirection: 'column', zIndex: 20,
      fontFamily: "'Source Sans 3', sans-serif",
    }}>
      <div style={{
        padding: '24px 22px 20px',
        borderBottom: `1px solid ${C.borderFaint}`,
      }}>
        <div style={{
          fontSize: 18,
          fontFamily: "'DM Sans', sans-serif",
          fontWeight: 600,
          letterSpacing: '-0.3px',
          color: C.text,
        }}>
          DemandFlow
        </div>
        <div style={{
          fontSize: 11,
          color: C.muted,
          marginTop: 4,
          letterSpacing: '0.2px',
        }}>
          Supply Chain Analytics
        </div>
      </div>

      <div style={{
        padding: '20px 0',
        flex: 1,
      }}>
        <div style={{
          padding: '0 24px',
          marginBottom: 8,
          fontSize: 10,
          fontWeight: 600,
          color: C.muted,
          textTransform: 'uppercase',
          letterSpacing: '0.08em',
        }}>
          Workspace
        </div>

        {nav.map(item => (
          <NavItem
            key={item}
            label={item}
            active={active === item}
            onClick={() => setActive(item)}
          />
        ))}
      </div>

      <div style={{
        padding: '16px 22px 20px',
        borderTop: `1px solid ${C.borderFaint}`,
      }}>
        <div style={{
          fontSize: 11,
          color: C.muted,
          lineHeight: 1.5,
        }}>
          Demand planning workspace
        </div>
        <div style={{
          marginTop: 3,
          fontSize: 10,
          color: C.muted,
          opacity: 0.7,
        }}>
          v1.0
        </div>
      </div>
    </aside>
  )
}

function SectionHead({ title, sub }: { title: string; sub?: string }) {
  return (
    <div style={{ marginBottom: 20 }}>
      <div style={{
        fontSize: 15, fontFamily: "'DM Sans', sans-serif",
        fontWeight: 500, color: C.text,
      }}>{title}</div>
      {sub && <div style={{ fontSize: 12, color: C.muted, marginTop: 3 }}>{sub}</div>}
    </div>
  )
}

export default function App() {
  const [activeNav, setActiveNav] = useState('Overview')
  const [products, setProducts] = useState<string[]>([])
  const [regions, setRegions] = useState<string[]>([])
  const [product, setProduct] = useState('Wireless Headphones')
  const [region, setRegion] = useState('Florida')
  const [inventory, setInventory] = useState(500)
  const [leadTime, setLeadTime] = useState(14)
  const [histDays, setHistDays] = useState(90)
  const [data, setData] = useState<DashboardData | null>(null)
  const [tableRows, setTableRows] = useState<InventoryRow[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')

  async function loadDashboard() {
    setLoading(true)
    setError('')
    try {
      const params = new URLSearchParams({
        product,
        region,
        current_inventory: String(inventory),
        lead_time_days: String(leadTime),
      })

      const [dashboardResponse, tableResponse] = await Promise.all([
        fetch(`${API}/api/dashboard?${params}`),
        fetch(`${API}/api/inventory-status`),
      ])

      if (!dashboardResponse.ok) throw new Error('Could not load dashboard data.')
      if (!tableResponse.ok) throw new Error('Could not load inventory status.')

      setData(await dashboardResponse.json())
      setTableRows(await tableResponse.json())
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Something went wrong.')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    fetch(`${API}/api/options`)
      .then(r => r.json())
      .then(options => {
        setProducts(options.products)
        setRegions(options.regions)
      })
      .catch(() => setError('Start the FastAPI backend on port 8000.'))
  }, [])

  useEffect(() => {
  if (products.length && regions.length) {
    loadDashboard()
  }
}, [product, region, inventory, leadTime, products.length, regions.length])

  const histSlice = useMemo(
    () => data?.history.slice(-histDays) ?? [],
    [data, histDays]
  )

  const avgDaily = useMemo(() => {
    if (!histSlice.length) return 0
    return (histSlice.reduce((s, d) => s + d.units, 0) / histSlice.length).toFixed(1)
  }, [histSlice])

  const MAX = Math.max(
    data?.metrics.reorder_point ?? 0,
    inventory,
    data?.metrics.safety_stock ?? 0,
    1
  ) * 1.15

  const pctCurrent = Math.min(100, (inventory / MAX) * 100)
  const pctReorder = Math.min(100, ((data?.metrics.reorder_point ?? 0) / MAX) * 100)
  const pctSafety = Math.min(100, ((data?.metrics.safety_stock ?? 0) / MAX) * 100)

  return (
    <div style={{
      display: 'flex', minHeight: '100vh', background: C.bg,
      fontFamily: "'Source Sans 3', sans-serif",
    }}>
      <Sidebar active={activeNav} setActive={setActiveNav} />

      <main style={{ marginLeft: 200, flex: 1, minWidth: 0 }}>
        <div style={{ maxWidth: 1180, margin: '0 auto', padding: '36px 48px' }}>

          <div style={{
            display: 'flex', alignItems: 'flex-start',
            justifyContent: 'space-between', marginBottom: 28,
          }}>
            <div>
              <h1 style={{
                margin: 0, fontSize: 22, fontFamily: "'DM Sans', sans-serif",
                fontWeight: 500, color: C.text,
              }}>
                Inventory Overview
              </h1>
              <p style={{ margin: '5px 0 0', fontSize: 13, color: C.muted }}>
                Demand and replenishment planning for selected products and regions.
              </p>
            </div>

            <div style={{ display: 'flex', alignItems: 'center', gap: 14 }}>
              <div style={{ textAlign: 'right' }}>
                <div style={{
                  fontSize: 10, color: C.muted, textTransform: 'uppercase',
                  letterSpacing: '0.07em', marginBottom: 2,
                }}>Model Status</div>
                <div style={{ fontSize: 13, color: C.text, fontWeight: 500 }}>
                  {loading ? 'Updating...' : 'Live local model'}
                </div>
              </div>
              <button
                onClick={loadDashboard}
                style={{
                  fontSize: 12, color: C.muted, border: `1px solid ${C.border}`,
                  background: C.surface, borderRadius: 6, padding: '5px 12px',
                  cursor: 'pointer',
                }}
              >
                Refresh
              </button>
            </div>
          </div>

          {error && (
            <div style={{
              background: '#FAF0F0', border: `1px solid #E7CACA`,
              color: C.risk, padding: '12px 16px', borderRadius: 6,
              marginBottom: 18, fontSize: 13,
            }}>
              {error}
            </div>
          )}

          <div style={{
            background: C.surface, border: `1px solid ${C.border}`,
            borderRadius: 8, padding: '12px 20px',
            display: 'flex', alignItems: 'center', gap: 18, marginBottom: 24,
          }}>
            <label style={{ fontSize: 10, color: C.muted, textTransform: 'uppercase', letterSpacing: '0.07em' }}>
              Product
              <select value={product} onChange={e => setProduct(e.target.value)} style={selectStyle}>
                {products.map(p => <option key={p}>{p}</option>)}
              </select>
            </label>

            <label style={{ fontSize: 10, color: C.muted, textTransform: 'uppercase', letterSpacing: '0.07em' }}>
              Region
              <select value={region} onChange={e => setRegion(e.target.value)} style={selectStyle}>
                {regions.map(r => <option key={r}>{r}</option>)}
              </select>
            </label>

            <label style={{ fontSize: 10, color: C.muted, textTransform: 'uppercase', letterSpacing: '0.07em' }}>
              Inventory
              <input
                type="number"
                min="0"
                value={inventory}
                onChange={e => setInventory(Number(e.target.value))}
                style={inputStyle}
              />
            </label>

            <label style={{ fontSize: 10, color: C.muted, textTransform: 'uppercase', letterSpacing: '0.07em' }}>
              Lead Time
              <input
                type="number"
                min="1"
                max="90"
                value={leadTime}
                onChange={e => setLeadTime(Number(e.target.value))}
                style={inputStyle}
              />
              <span style={{ fontSize: 12, color: C.muted, marginLeft: 5 }}>days</span>
            </label>

            <button onClick={loadDashboard} style={applyButton}>
              Apply
            </button>
          </div>

          {loading || !data ? (
            <div style={{
              background: C.surface, border: `1px solid ${C.border}`,
              borderRadius: 8, padding: 40, color: C.muted, fontSize: 14,
            }}>
              Loading forecast and inventory model...
            </div>
          ) : (
            <>
              <div style={{
                display: 'grid',
                gridTemplateColumns: 'repeat(4, 1fr)',
                gap: 12,
                marginBottom: 16,
              }}>
                {[
                  ['30 Day Demand', `${data.metrics.thirty_day_demand.toLocaleString()} units`],
                  ['Current Stock', `${inventory.toLocaleString()} units`],
                  ['Reorder Point', `${data.metrics.reorder_point.toLocaleString()} units`],
                  ['Status', data.metrics.risk],
                ].map(([label, value], i) => (
                  <div key={label} style={{
                    background: C.surface, border: `1px solid ${C.border}`,
                    borderRadius: 8, padding: '18px 20px',
                  }}>
                    <div style={{
                      fontSize: 10, color: C.muted, textTransform: 'uppercase',
                      letterSpacing: '0.07em', marginBottom: 8,
                    }}>{label}</div>
                    <div style={{
                      fontSize: 20, fontFamily: "'DM Sans', sans-serif",
                      fontWeight: 500, color: i === 3 && data.metrics.risk === 'High' ? C.risk : C.text,
                    }}>{value}</div>
                  </div>
                ))}
              </div>

              <div style={{
                display: 'grid', gridTemplateColumns: '1.65fr 1fr',
                gap: 16, marginBottom: 16,
              }}>
              <div style={cardStyle}>
  <SectionHead
    title="Demand Forecast"
    sub={`${data.product} · ${data.region} · Historical demand and next 30 days`}
  />

  <ResponsiveContainer width="100%" height={260}>
    <LineChart
      data={[
        ...data.history.slice(-30).map(item => ({
          date: item.date,
          historical: item.units,
          forecast: null,
          forecastArea: null,
        })),
        ...data.forecast.map(item => ({
          date: item.date,
          historical: null,
          forecast: item.demand,
          forecastArea: item.demand,
        })),
      ]}
      margin={{
        top: 28,
        right: 10,
        left: -20,
        bottom: 0,
      }}
    >
      <CartesianGrid
        stroke={C.borderFaint}
        vertical={false}
      />

      <XAxis
        dataKey="date"
        tick={{
          fontSize: 10,
          fill: C.muted,
        }}
        tickLine={false}
        axisLine={false}
        interval={4}
      />

      <YAxis
        tick={{
          fontSize: 10,
          fill: C.muted,
        }}
        tickLine={false}
        axisLine={false}
      />

      <Tooltip
        content={({ active, payload, label }: any) => {
          if (!active || !payload?.length) return null

          const historical = payload.find(
            (item: any) => item.dataKey === 'historical'
          )?.value

          const forecast = payload.find(
            (item: any) => item.dataKey === 'forecast'
          )?.value

          return (
            <div
              style={{
                fontFamily: "'Source Sans 3', sans-serif",
                fontSize: 12,
                background: C.surface,
                border: `1px solid ${C.border}`,
                borderRadius: 6,
                padding: '8px 12px',
                color: C.text,
                boxShadow: '0 4px 12px rgba(0,0,0,0.06)',
              }}
            >
              <div
                style={{
                  color: C.muted,
                  marginBottom: 5,
                }}
              >
                {label}
              </div>

              {historical != null && (
                <div>
                  Historical:{' '}
                  <strong>{historical} units</strong>
                </div>
              )}

              {forecast != null && (
                <div>
                  Forecast:{' '}
                  <strong>{forecast} units</strong>
                </div>
              )}
            </div>
          )
        }}
        cursor={{
          stroke: C.border,
        }}
      />

      {/* Historical demand */}
      <Line
        type="monotone"
        dataKey="historical"
        stroke="#69706A"
        strokeWidth={2}
        dot={false}
        connectNulls={false}
      />

      {/* Forecast demand */}
      <Line
        type="monotone"
        dataKey="forecast"
        stroke="#506B45"
        strokeWidth={2.5}
        dot={false}
        connectNulls={false}
      />

      {/* Forecast starting point */}
      <ReferenceLine
        x={data.forecast[0]?.date}
        stroke="#8A9A83"
        strokeDasharray="5 5"
        strokeWidth={1.5}
        label={{
          value: 'Forecast starts',
          position: 'top',
          fill: '#506B45',
          fontSize: 11,
          fontWeight: 600,
        }}
      />
    </LineChart>
  </ResponsiveContainer>

  {/* Chart legend */}
  <div
    style={{
      display: 'flex',
      gap: 20,
      marginTop: 4,
      fontSize: 11,
      color: C.muted,
    }}
  >
    <span
      style={{
        display: 'flex',
        alignItems: 'center',
        gap: 6,
      }}
    >
      <span
        style={{
          width: 18,
          height: 2,
          background: '#69706A',
          display: 'inline-block',
        }}
      />
      Historical
    </span>

    <span
      style={{
        display: 'flex',
        alignItems: 'center',
        gap: 6,
      }}
    >
      <span
        style={{
          width: 18,
          height: 2.5,
          background: '#506B45',
          display: 'inline-block',
        }}
      />
      Forecast
    </span>
  </div>
</div>

                <div style={cardStyle}>
                  <SectionHead title="Inventory Position" sub="Planning thresholds based on forecasted demand and lead time." />

                  <div style={{ margin: '22px 0 10px', position: 'relative' }}>
                    <div style={{
                      height: 8, background: C.borderFaint, borderRadius: 5,
                      position: 'relative',
                    }}>
                      <div style={{
                        width: `${pctSafety}%`, height: '100%',
                        background: C.oliveLight, borderRadius: 5,
                      }} />
                      <div style={{
                        position: 'absolute', left: `${pctSafety}%`, top: -3,
                        bottom: -3, width: 2, background: C.olive,
                      }} />
                      <div style={{
                        position: 'absolute', left: `${pctReorder}%`, top: -3,
                        bottom: -3, width: 2, background: C.warning,
                      }} />
                      <div style={{
                        position: 'absolute', left: `${pctCurrent}%`, top: -3,
                        bottom: -3, width: 2, background: C.text,
                      }} />
                    </div>
                    <div style={{
                      display: 'flex', justifyContent: 'space-between',
                      fontSize: 10, color: C.muted, marginTop: 8,
                    }}>
                      <span>Safety · {data.metrics.safety_stock}</span>
                      <span>Reorder · {data.metrics.reorder_point}</span>
                      <span>Current · {inventory}</span>
                    </div>
                  </div>

                  <div style={{
                    borderTop: `1px solid ${C.borderFaint}`,
                    paddingTop: 16, marginTop: 20,
                  }}>
                    <div style={{
                      fontSize: 11, fontWeight: 600,
                      color: data.metrics.risk === 'High' ? C.risk : data.metrics.risk === 'Medium' ? C.warning : C.olive,
                      textTransform: 'uppercase', letterSpacing: '0.07em',
                    }}>
                      {data.metrics.risk} Risk
                    </div>
                    <div style={{
                      fontSize: 12, color: C.muted,
                      lineHeight: 1.6, margin: '5px 0 12px',
                    }}>
                      {data.metrics.recommendation}
                    </div>
                    <div style={{
                      fontSize: 12, color: C.text,
                      padding: '9px 10px', background: C.bg,
                      borderRadius: 5,
                    }}>
                      Recommended order: <strong>{data.metrics.recommended_order.toLocaleString()} units</strong>
                    </div>
                  </div>
                </div>
              </div>

              <div style={cardStyle}>
                <div style={{
                  display: 'flex', alignItems: 'flex-start',
                  justifyContent: 'space-between', marginBottom: 20,
                }}>
                  <SectionHead
                    title="Historical Demand"
                    sub={`Daily units sold over the previous ${histDays} days · Avg ${avgDaily} units/day`}
                  />
                  <select value={histDays} onChange={e => setHistDays(Number(e.target.value))} style={smallSelect}>
                    <option value={30}>30 days</option>
                    <option value={60}>60 days</option>
                    <option value={90}>90 days</option>
                  </select>
                </div>

                <ResponsiveContainer width="100%" height={170}>
                  <AreaChart data={histSlice} margin={{ top: 4, right: 6, left: -20, bottom: 0 }}>
                    <defs>
                      <linearGradient id="histFill" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="0%" stopColor={C.olive} stopOpacity={0.1} />
                        <stop offset="100%" stopColor={C.olive} stopOpacity={0} />
                      </linearGradient>
                    </defs>
                    <CartesianGrid stroke={C.borderFaint} vertical={false} />
                    <XAxis dataKey="date" tick={{ fontSize: 10, fill: C.muted }} tickLine={false} axisLine={false} interval={Math.max(1, Math.floor(histSlice.length / 7))} />
                    <YAxis tick={{ fontSize: 10, fill: C.muted }} tickLine={false} axisLine={false} />
                    <Tooltip content={<ChartTooltip />} cursor={{ stroke: C.border }} />
                    <Area type="monotone" dataKey="units" stroke={C.olive} strokeWidth={1.5} fill="url(#histFill)" dot={false} />
                  </AreaChart>
                </ResponsiveContainer>
              </div>

              <div style={{
                display: 'grid', gridTemplateColumns: '1fr 360px',
                gap: 16, margin: '16px 0',
              }}>
                <div style={cardStyle}>
                  <div style={{
                    fontSize: 15, fontFamily: "'DM Sans', sans-serif",
                    fontWeight: 500, color: C.text, marginBottom: 14,
                  }}>Planning Note</div>
                  <p style={{
                    fontSize: 14, color: '#4A4A44',
                    lineHeight: 1.75, margin: 0,
                  }}>
                    {data.metrics.recommendation}
                  </p>
                  <div style={{
                    marginTop: 20, paddingTop: 16,
                    borderTop: `1px solid ${C.borderFaint}`,
                    fontSize: 11, color: C.muted,
                    textTransform: 'uppercase', letterSpacing: '0.07em',
                  }}>
                    Forecast based recommendation
                  </div>
                </div>

                <div style={cardStyle}>
                  <div style={{
                    fontSize: 15, fontFamily: "'DM Sans', sans-serif",
                    fontWeight: 500, color: C.text, marginBottom: 5,
                  }}>Forecast Model</div>
                  <div style={{
                    fontSize: 12, color: C.muted, marginBottom: 20,
                  }}>
                    Chronological train/test evaluation.
                  </div>
                  <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
                    <tbody>
                      {[
                        ['MAE', `${data.model.mae} units`],
                        ['RMSE', `${data.model.rmse} units`],
                        ['Train / Test', data.model.train_test],
                      ].map(([m, v]) => (
                        <tr key={m} style={{ borderTop: `1px solid ${C.borderFaint}` }}>
                          <td style={{ padding: '10px 0', color: C.text }}>{m}</td>
                          <td style={{
                            padding: '10px 0', textAlign: 'right',
                            color: C.text, fontWeight: 500,
                          }}>{v}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>

              <div style={{
                background: C.surface, border: `1px solid ${C.border}`,
                borderRadius: 8, padding: '24px 0 0', marginBottom: 16,
              }}>
                <div style={{ padding: '0 24px', marginBottom: 16 }}>
                  <SectionHead title="Product Inventory Status" sub="Current planning positions across products and regions." />
                </div>
                <div style={{ overflowX: 'auto' }}>
                  <table style={{
                    width: '100%', borderCollapse: 'collapse',
                    fontSize: 13, fontFamily: "'Source Sans 3', sans-serif",
                  }}>
                    <thead>
                      <tr style={{ borderTop: `1px solid ${C.border}`, borderBottom: `1px solid ${C.border}` }}>
                        {['Product', 'Region', 'Current Stock', '30-Day Demand', 'Reorder Point', 'Risk', 'Rec. Order'].map(h => (
                          <th key={h} style={{
                            textAlign: h === 'Product' || h === 'Region' ? 'left' : 'right',
                            fontSize: 10, color: C.muted,
                            textTransform: 'uppercase', letterSpacing: '0.07em',
                            fontWeight: 500, padding: '9px 16px', background: C.bg,
                          }}>{h}</th>
                        ))}
                      </tr>
                    </thead>
                    <tbody>
                      {tableRows.map((row, i) => (
                        <tr key={i} style={{ borderBottom: `1px solid ${C.borderFaint}` }}>
                          <td style={{ padding: '11px 16px', color: C.text, fontWeight: 500 }}>{row.product}</td>
                          <td style={{ padding: '11px 16px', color: C.muted }}>{row.region}</td>
                          <td style={{ padding: '11px 16px', textAlign: 'right', color: C.text }}>{row.stock.toLocaleString()}</td>
                          <td style={{ padding: '11px 16px', textAlign: 'right', color: C.text }}>{row.demand.toLocaleString()}</td>
                          <td style={{ padding: '11px 16px', textAlign: 'right', color: C.muted }}>{row.reorder.toLocaleString()}</td>
                          <td style={{ padding: '11px 16px', textAlign: 'right' }}><RiskBadge level={row.risk} /></td>
                          <td style={{ padding: '11px 16px', textAlign: 'right', color: row.order === 0 ? C.muted : C.text }}>
                            {row.order === 0 ? '—' : row.order.toLocaleString()}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            </>
          )}

          <div style={{
            display: 'flex', justifyContent: 'space-between',
            padding: '16px 0 8px', fontSize: 11, color: '#B0AFA9',
            borderTop: `1px solid ${C.borderFaint}`,
          }}>
            <span style={{ fontFamily: "'DM Sans', sans-serif", letterSpacing: '0.04em' }}>
              DEMANDFLOW
            </span>
            <span>React · TypeScript · FastAPI · Python · Pandas · Scikit-learn</span>
          </div>
        </div>
      </main>
    </div>
  )
}

const cardStyle = {
  background: C.surface,
  border: `1px solid ${C.border}`,
  borderRadius: 8,
  padding: '24px',
}

const selectStyle = {
  display: 'block',
  marginTop: 4,
  fontSize: 13,
  color: C.text,
  border: `1px solid ${C.border}`,
  borderRadius: 5,
  padding: '5px 8px',
  background: C.surface,
  fontFamily: "'Source Sans 3', sans-serif",
}

const smallSelect = {
  fontSize: 12,
  color: C.muted,
  border: `1px solid ${C.border}`,
  borderRadius: 5,
  padding: '4px 10px',
  background: C.surface,
  fontFamily: "'Source Sans 3', sans-serif",
}

const inputStyle = {
  width: 90,
  display: 'inline-block',
  marginTop: 4,
  fontSize: 13,
  color: C.text,
  border: `1px solid ${C.border}`,
  borderRadius: 5,
  padding: '5px 8px',
  background: C.surface,
  fontFamily: "'Source Sans 3', sans-serif",
}

const applyButton = {
  marginLeft: 'auto',
  alignSelf: 'flex-end',
  fontSize: 12,
  color: C.surface,
  border: `1px solid ${C.olive}`,
  background: C.olive,
  borderRadius: 6,
  padding: '7px 14px',
  cursor: 'pointer',
  fontFamily: "'Source Sans 3', sans-serif",
}
