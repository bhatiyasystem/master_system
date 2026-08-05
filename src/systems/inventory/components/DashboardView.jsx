// src/systems/inventory/components/DashboardView.jsx
import React, { useMemo } from "react";
import { useSelector } from "react-redux";
import {
  ResponsiveContainer,
  PieChart,
  Pie,
  Cell,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
  Legend,
} from "recharts";
import {
  Boxes,
  TrendingDown,
  AlertTriangle,
  FileText,
  Layers,
  ArrowUpRight,
  TrendingUp,
} from "lucide-react";

const COLORS = [
  "#6366f1",
  "#a855f7",
  "#0d9488",
  "#d97706",
  "#0ea5e9",
  "#e11d48",
  "#a21caf",
];
const BAND_COLORS = {
  "Excess Stock": "#a855f7",
  "Normal Stock": "#22c55e",
  "66.33% Stock": "#eab308",
  "Below 33%": "#ef4444",
};

export default function DashboardView({ activeUser, onTabChange }) {
  const { materials, transactions, indents } = useSelector(
    (state) => state.inventory,
  );

  // Helper calculations
  const calculatedData = useMemo(() => {
    // 1. Calculate closing stock for each material
    const matClosing = {};
    materials.forEach((m) => {
      matClosing[m.sku] = Number(m.opening) || 0;
    });

    transactions.forEach((t) => {
      if (matClosing[t.sku] !== undefined) {
        if (t.type === "IN") {
          matClosing[t.sku] += Number(t.qty) || 0;
        } else {
          matClosing[t.sku] -= Number(t.qty) || 0;
        }
      }
    });

    const fullMaterials = materials.map((m) => {
      const closingStock = matClosing[m.sku] || 0;
      const safetyStock = (Number(m.adc) || 0) * (Number(m.safetyFactor) || 0);
      const reorderLevel =
        (Number(m.adc) || 0) * (Number(m.leadTime) || 0) + safetyStock;
      const maxLevel = reorderLevel + (Number(m.moq) || 0);

      // Stock band (only meaningful once ADC/consumption data exists —
      // otherwise maxLevel collapses to just the MOQ and any stock reads as "Excess")
      let band = "Normal Stock";
      if (maxLevel > 0 && (Number(m.adc) || 0) > 0) {
        const pct = (closingStock / maxLevel) * 100;
        if (pct > 100) band = "Excess Stock";
        else if (pct >= 66.33) band = "Normal Stock";
        else if (pct >= 33) band = "66.33% Stock";
        else band = "Below 33%";
      }

      return {
        ...m,
        closingStock,
        safetyStock,
        reorderLevel,
        maxLevel,
        band,
      };
    });

    // 2. Visible materials based on location filter
    const visibleMats = activeUser.location
      ? fullMaterials.filter((m) => m.location === activeUser.location)
      : fullMaterials;

    const visibleSkus = new Set(visibleMats.map((m) => m.sku));
    const visibleTxns = transactions.filter((t) => visibleSkus.has(t.sku));

    // 3. KPIs
    const totalSKUs = visibleMats.length;
    const totalQty = visibleMats.reduce((sum, m) => sum + m.closingStock, 0);
    const excessCount = visibleMats.filter(
      (m) => m.band === "Excess Stock",
    ).length;
    const lowCount = visibleMats.filter(
      (m) => m.band === "66.33% Stock",
    ).length;
    const criticalCount = visibleMats.filter(
      (m) => m.band === "Below 33%",
    ).length;
    const pendingIndents = indents.filter(
      (i) => i.status === "Pending" && visibleSkus.has(i.sku),
    ).length;

    // 4. Charts - Category wise closing stock
    const catMap = {};
    visibleMats.forEach((m) => {
      catMap[m.category] = (catMap[m.category] || 0) + m.closingStock;
    });
    const categoryData = Object.entries(catMap).map(([name, value]) => ({
      name,
      value,
    }));

    // 5. Charts - Inward vs Outward by month (last 6 months)
    const monthMap = {};
    visibleTxns.forEach((t) => {
      const month = t.date.slice(0, 7); // YYYY-MM
      if (!monthMap[month]) monthMap[month] = { month, Inward: 0, Outward: 0 };
      if (t.type === "IN") {
        monthMap[month].Inward = parseFloat(
          (monthMap[month].Inward + (Number(t.qty) || 0)).toFixed(2),
        );
      } else {
        monthMap[month].Outward = parseFloat(
          (monthMap[month].Outward + (Number(t.qty) || 0)).toFixed(2),
        );
      }
    });
    const inOutData = Object.values(monthMap)
      .sort((a, b) => a.month.localeCompare(b.month))
      .slice(-6);

    // 6. Charts - Top 5 Consumption (Outward Qty)
    const consMap = {};
    visibleTxns
      .filter((t) => t.type === "OUT")
      .forEach((t) => {
        consMap[t.name] = (consMap[t.name] || 0) + Number(t.qty);
      });
    const consumptionData = Object.entries(consMap)
      .map(([name, qty]) => ({ name, qty }))
      .sort((a, b) => b.qty - a.qty)
      .slice(0, 5);

    // 7. Charts - Stock Band Distribution
    const bandMap = {
      "Excess Stock": 0,
      "Normal Stock": 0,
      "66.33% Stock": 0,
      "Below 33%": 0,
    };
    visibleMats.forEach((m) => {
      bandMap[m.band] = (bandMap[m.band] || 0) + 1;
    });
    const bandData = Object.entries(bandMap).map(([name, count]) => ({
      name,
      count,
      fill: BAND_COLORS[name],
    }));

    return {
      kpis: {
        totalSKUs,
        totalQty,
        excessCount,
        lowCount,
        criticalCount,
        pendingIndents,
      },
      categoryData,
      inOutData,
      consumptionData,
      bandData,
    };
  }, [materials, transactions, indents, activeUser]);

  const { kpis, categoryData, inOutData, consumptionData, bandData } =
    calculatedData;

  const kpiCards = [
    {
      title: "Total SKU",
      value: kpis.totalSKUs,
      sub: `${materials.filter((m) => m.status === "Active").length} active SKUs`,
      icon: Layers,
      color: "from-blue-500 to-indigo-600",
      textColor: "text-indigo-600",
    },
    {
      title: "Total Inventory Qty",
      value: kpis.totalQty.toLocaleString(undefined, {
        maximumFractionDigits: 2,
      }),
      sub: "Items in all storage areas",
      icon: Boxes,
      color: "from-sky-400 to-blue-500",
      textColor: "text-sky-500",
    },
    {
      title: "Excess Stock Items",
      value: kpis.excessCount,
      sub: "Holding above Max levels",
      icon: ArrowUpRight,
      color: "from-blue-500 to-pink-600",
      textColor: "text-blue-600",
    },
    {
      title: "Low Stock (66.33%)",
      value: kpis.lowCount,
      sub: "Approaching reorder level",
      icon: TrendingDown,
      color: "from-amber-400 to-orange-500",
      textColor: "text-amber-600",
    },
    {
      title: "Critical (Below 33%)",
      value: kpis.criticalCount,
      sub: "Immediate reorder needed",
      icon: AlertTriangle,
      color: "from-rose-500 to-red-600",
      textColor: "text-rose-600",
    },
    {
      title: "Pending Indents",
      value: kpis.pendingIndents,
      sub: "Awaiting completion",
      icon: FileText,
      color: "from-emerald-500 to-teal-600",
      textColor: "text-emerald-600",
    },
  ];

  return (
    <div className="space-y-6">
      {/* KPI Summary Grid */}
      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-4">
        {kpiCards.map((c, i) => (
          <div
            key={i}
            className="relative overflow-hidden bg-white border border-gray-200 rounded-2xl p-4 shadow-sm hover:shadow-md transition-all duration-300"
          >
            <div className="flex items-center justify-between mb-2">
              <span className="text-xs font-bold text-gray-500 uppercase tracking-wider">
                {c.title}
              </span>
              <div
                className={`p-1.5 rounded-lg bg-gray-50 ${c.textColor}`}
              >
                <c.icon size={16} />
              </div>
            </div>
            <div className="text-2xl font-black text-gray-900 mb-1">
              {c.value}
            </div>
            <div className="text-xs text-gray-400 truncate">
              {c.sub}
            </div>
            <div
              className={`absolute bottom-0 left-0 right-0 h-1 bg-gradient-to-r ${c.color}`}
            />
          </div>
        ))}
      </div>

      {/* Main Charts Row */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        {/* Category distribution */}
        <div className="lg:col-span-5 bg-white border border-gray-200 rounded-3xl p-5 shadow-sm">
          <h3 className="text-sm font-bold text-gray-900 uppercase tracking-wider mb-4 flex items-center gap-2">
            <span className="h-2.5 w-2.5 rounded-full bg-indigo-500" />
            Category-wise Stock Volume
          </h3>
          <div className="h-64 flex items-center justify-center">
            {categoryData.length === 0 ? (
              <div className="text-gray-400 text-xs">
                No stock data available
              </div>
            ) : (
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie
                    data={categoryData}
                    cx="50%"
                    cy="50%"
                    innerRadius={60}
                    outerRadius={85}
                    paddingAngle={3}
                    dataKey="value"
                  >
                    {categoryData.map((entry, index) => (
                      <Cell
                        key={`cell-${index}`}
                        fill={COLORS[index % COLORS.length]}
                      />
                    ))}
                  </Pie>
                  <Tooltip
                    contentStyle={{
                      backgroundColor: "rgba(15, 23, 42, 0.9)",
                      border: "none",
                      borderRadius: "8px",
                      color: "#fff",
                      fontSize: "12px",
                    }}
                  />
                  <Legend
                    layout="horizontal"
                    verticalAlign="bottom"
                    align="center"
                    iconSize={8}
                    wrapperStyle={{ fontSize: "10px" }}
                  />
                </PieChart>
              </ResponsiveContainer>
            )}
          </div>
        </div>

        {/* Inward vs Outward */}
        <div className="lg:col-span-7 bg-white border border-gray-200 rounded-3xl p-5 shadow-sm">
          <h3 className="text-sm font-bold text-gray-900 uppercase tracking-wider mb-4 flex items-center gap-2">
            <span className="h-2.5 w-2.5 rounded-full bg-teal-500" />
            Stock Movements (Inward vs Outward)
          </h3>
          <div className="h-64">
            {inOutData.length === 0 ? (
              <div className="h-full flex items-center justify-center text-gray-400 text-xs">
                No transactions recorded
              </div>
            ) : (
              <ResponsiveContainer width="100%" height="100%">
                <BarChart
                  data={inOutData}
                  margin={{ top: 10, right: 10, left: -10, bottom: 0 }}
                >
                  <XAxis
                    dataKey="month"
                    tickLine={false}
                    axisLine={false}
                    style={{ fontSize: "10px" }}
                  />
                  <YAxis
                    tickLine={false}
                    axisLine={false}
                    style={{ fontSize: "10px" }}
                  />
                  <Tooltip
                    contentStyle={{
                      backgroundColor: "rgba(15, 23, 42, 0.9)",
                      border: "none",
                      borderRadius: "8px",
                      color: "#fff",
                      fontSize: "12px",
                    }}
                    formatter={(value) => [
                      parseFloat(value).toFixed(2),
                      undefined,
                    ]}
                  />
                  <Legend
                    verticalAlign="bottom"
                    height={36}
                    iconSize={8}
                    wrapperStyle={{ fontSize: "10px" }}
                  />
                  <Bar dataKey="Inward" fill="#0d9488" radius={[4, 4, 0, 0]} />
                  <Bar dataKey="Outward" fill="#e11d48" radius={[4, 4, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            )}
          </div>
        </div>
      </div>

      {/* Secondary Charts Row */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Top 5 Consumption */}
        <div className="bg-white border border-gray-200 rounded-3xl p-5 shadow-sm">
          <h3 className="text-sm font-bold text-gray-900 uppercase tracking-wider mb-4 flex items-center gap-2">
            <TrendingUp size={16} className="text-indigo-500" />
            Monthly Consumption (Top 5 Materials)
          </h3>
          <div className="h-64">
            {consumptionData.length === 0 ? (
              <div className="h-full flex items-center justify-center text-gray-400 text-xs">
                No consumption recorded (OUT transactions)
              </div>
            ) : (
              <ResponsiveContainer width="100%" height="100%">
                <BarChart
                  data={consumptionData}
                  layout="vertical"
                  margin={{ top: 10, right: 10, left: 20, bottom: 0 }}
                >
                  <XAxis
                    type="number"
                    tickLine={false}
                    axisLine={false}
                    style={{ fontSize: "10px" }}
                  />
                  <YAxis
                    dataKey="name"
                    type="category"
                    tickLine={false}
                    axisLine={false}
                    style={{ fontSize: "9px", fontWeight: "bold" }}
                    width={90}
                  />
                  <Tooltip
                    contentStyle={{
                      backgroundColor: "rgba(15, 23, 42, 0.9)",
                      border: "none",
                      borderRadius: "8px",
                      color: "#fff",
                      fontSize: "12px",
                    }}
                  />
                  <Bar
                    dataKey="qty"
                    fill="#6366f1"
                    radius={[0, 4, 4, 0]}
                    barSize={16}
                  />
                </BarChart>
              </ResponsiveContainer>
            )}
          </div>
        </div>

        {/* Stock band distribution */}
        <div className="bg-white border border-gray-200 rounded-3xl p-5 shadow-sm">
          <h3 className="text-sm font-bold text-gray-900 uppercase tracking-wider mb-4 flex items-center gap-2">
            <span className="h-2.5 w-2.5 rounded-full bg-blue-500" />
            Stock Band Distribution (SKU Counts)
          </h3>
          <div className="h-64">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart
                data={bandData}
                margin={{ top: 10, right: 10, left: -25, bottom: 0 }}
              >
                <XAxis
                  dataKey="name"
                  tickLine={false}
                  axisLine={false}
                  style={{ fontSize: "10px" }}
                />
                <YAxis
                  tickLine={false}
                  axisLine={false}
                  allowDecimals={false}
                  style={{ fontSize: "10px" }}
                />
                <Tooltip
                  contentStyle={{
                    backgroundColor: "rgba(15, 23, 42, 0.9)",
                    border: "none",
                    borderRadius: "8px",
                    color: "#fff",
                    fontSize: "12px",
                  }}
                />
                <Bar dataKey="count" radius={[4, 4, 0, 0]} barSize={40}>
                  {bandData.map((entry, index) => (
                    <Cell key={`cell-${index}`} fill={entry.fill} />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>
      </div>
    </div>
  );
}
