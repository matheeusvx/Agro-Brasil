"use client";
import { useState } from "react";
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  Cell,
  PieChart,
  Pie,
} from "recharts";
import { ChartNoAxesColumnIncreasing } from "lucide-react";
import {
  productionDistribution,
  orderDistribution,
  type Datum,
} from "@/lib/operational";
import { number, type Production, type Order } from "@/lib/types";
const colors = [
  "#315e49",
  "#90ad79",
  "#c48c69",
  "#dfbd75",
  "#6f969f",
  "#8f8170",
];
const percentage = (value: number, total: number) =>
  new Intl.NumberFormat("pt-BR", { maximumFractionDigits: 1 }).format(
    (value / total) * 100,
  );
function ColumnShape(props: unknown) {
  const p = props as {
    x: number;
    y: number;
    width: number;
    height: number;
    fill: string;
  };
  const { x, y, width, height, fill } = p;
  if (!height) return <g />;
  return (
    <g>
      <rect x={x} y={y} width={width - 5} height={height} fill={fill} />
      <polygon
        points={`${x},${y} ${x + 5},${y - 4} ${x + width},${y - 4} ${x + width - 5},${y}`}
        fill={fill}
        opacity={0.65}
      />
      <polygon
        points={`${x + width - 5},${y} ${x + width},${y - 4} ${x + width},${y + height - 4} ${x + width - 5},${y + height}`}
        fill={fill}
        filter="brightness(.85)"
      />
    </g>
  );
}
function ChartEmpty({ message }: { message: string }) {
  return (
    <div className="chart-empty">
      <ChartNoAxesColumnIncreasing size={25} />
      <p>{message}</p>
      <small>Os dados aparecerão depois dos primeiros registros.</small>
    </div>
  );
}
function Readout({
  value,
  total,
  unit,
}: {
  value: Datum;
  total: number;
  unit: string;
}) {
  return (
    <p className="chart-readout" aria-live="polite">
      <strong>{value.name}</strong>
      <span>
        {number(value.value)} {unit}
      </span>
      <small>{percentage(value.value, total)}% do total</small>
    </p>
  );
}
export function OperationalCharts({
  productions,
  orders,
}: {
  productions: Production[];
  orders: Order[];
}) {
  const crops = productionDistribution(productions),
    situations = orderDistribution(orders);
  const [barIndex, setBarIndex] = useState(0),
    [pieIndex, setPieIndex] = useState(0);
  const total = crops.reduce((s, r) => s + r.value, 0),
    count = orders.length;
  const selectedCrop = crops[Math.min(barIndex, crops.length - 1)],
    selectedSituation = situations[Math.min(pieIndex, situations.length - 1)];
  return (
    <div className="charts-grid">
      <section
        className="panel chart-panel"
        aria-label="Distribuição da produção"
      >
        <div className="panel-heading">
          <div>
            <h2>O que você produz</h2>
            <p>Distribuição da produção registrada por cultura</p>
          </div>
          <span className="unit-tag">kg</span>
        </div>
        {!selectedCrop ? (
          <ChartEmpty message="Nenhuma produção registrada." />
        ) : (
          <>
            <Readout value={selectedCrop} total={total} unit="kg" />
            <div
              className="chart-canvas"
              role="img"
              aria-label="Barras em kg por cultura; valores e seleção disponíveis na legenda abaixo."
            >
              <ResponsiveContainer width="100%" height="100%">
                <BarChart
                  data={crops}
                  margin={{ top: 12, right: 12, left: -23, bottom: 0 }}
                  barCategoryGap="32%"
                >
                  <CartesianGrid
                    vertical={false}
                    stroke="#edf0e8"
                    strokeDasharray="3 4"
                  />
                  <XAxis
                    dataKey="name"
                    axisLine={false}
                    tickLine={false}
                    tick={{ fontSize: 11, fill: "#6b796e" }}
                    interval={0}
                    tickMargin={12}
                  />
                  <YAxis
                    axisLine={false}
                    tickLine={false}
                    tick={{ fontSize: 10, fill: "#627452" }}
                    domain={[0, "auto"]}
                  />
                  <Tooltip
                    cursor={false}
                    contentStyle={{
                      border: "1px solid #e2e7de",
                      borderRadius: 10,
                      fontSize: 12,
                      boxShadow: "0 8px 24px #173f3210",
                    }}
                    formatter={(value) => [
                      number(Number(value)) + " kg",
                      "Registrado",
                    ]}
                  />
                  <Bar
                    dataKey="value"
                    maxBarSize={39}
                    shape={<ColumnShape />}
                    onMouseEnter={(_, index) => setBarIndex(index)}
                    onClick={(_, index) => setBarIndex(index)}
                    isAnimationActive={false}
                  >
                    {crops.map((entry, index) => (
                      <Cell
                        key={entry.name}
                        fill={index === barIndex ? "#315e49" : "#c1cfb3"}
                      />
                    ))}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            </div>
            <div className="chart-legend">
              {crops.map((item, index) => (
                <button
                  key={item.name}
                  type="button"
                  aria-pressed={barIndex === index}
                  className={barIndex === index ? "selected" : ""}
                  onMouseEnter={() => setBarIndex(index)}
                  onFocus={() => setBarIndex(index)}
                  onClick={() => setBarIndex(index)}
                >
                  <span
                    className="legend-dot"
                    style={{
                      background: index === barIndex ? "#315e49" : "#c1cfb3",
                    }}
                  />
                  {item.name}
                  <strong>{number(item.value)} kg</strong>
                </button>
              ))}
            </div>
          </>
        )}
        <p className="chart-source">
          Todos os registros da propriedade · não representa estoque disponível
        </p>
      </section>
      <section
        className="panel chart-panel"
        aria-label="Distribuição dos pedidos"
      >
        <div className="panel-heading">
          <div>
            <h2>Como estão seus pedidos</h2>
            <p>Situação atual dos pedidos vinculados aos lotes</p>
          </div>
          <span className="unit-tag">{count} no total</span>
        </div>
        {!selectedSituation ? (
          <ChartEmpty message="Nenhum pedido vinculado aos lotes." />
        ) : (
          <>
            <Readout value={selectedSituation} total={count} unit="pedidos" />
            <div className="donut-layout">
              <div
                className="donut-canvas"
                role="img"
                aria-label="Rosca por contagem de pedidos; valores e percentuais disponíveis na legenda."
              >
                <div className="donut-total">
                  <strong>{count}</strong>
                  <span>pedidos</span>
                </div>
                <ResponsiveContainer width="100%" height="100%">
                  <PieChart>
                    <Pie
                      data={situations}
                      dataKey="value"
                      nameKey="name"
                      innerRadius={57}
                      outerRadius={85}
                      startAngle={90}
                      endAngle={-270}
                      stroke="#fff"
                      strokeWidth={2}
                      onMouseEnter={(_, index) => setPieIndex(index)}
                      onClick={(_, index) => setPieIndex(index)}
                      isAnimationActive={false}
                    >
                      {situations.map((row, index) => (
                        <Cell
                          key={row.name}
                          fill={colors[index % colors.length]}
                          opacity={index === pieIndex ? 1 : 0.8}
                        />
                      ))}
                    </Pie>
                    <Tooltip
                      formatter={(value) => [
                        `${value} pedidos · ${percentage(Number(value), count)}%`,
                        "Quantidade",
                      ]}
                      contentStyle={{
                        border: "1px solid #e2e7de",
                        borderRadius: 10,
                        fontSize: 12,
                      }}
                    />
                  </PieChart>
                </ResponsiveContainer>
              </div>
              <div className="donut-legend">
                {situations.map((row, index) => (
                  <button
                    key={row.name}
                    type="button"
                    aria-pressed={pieIndex === index}
                    className={pieIndex === index ? "selected" : ""}
                    onMouseEnter={() => setPieIndex(index)}
                    onFocus={() => setPieIndex(index)}
                    onClick={() => setPieIndex(index)}
                  >
                    <span
                      className="legend-dot"
                      style={{ background: colors[index % colors.length] }}
                    />
                    <span>{row.name}</span>
                    <strong>{percentage(row.value, count)}%</strong>
                    <small>{row.value} {row.value === 1 ? "pedido" : "pedidos"}</small>
                  </button>
                ))}
              </div>
            </div>
          </>
        )}
        <p className="chart-source">
          Contagem de pedidos · situações atuais, sem série histórica
        </p>
      </section>
    </div>
  );
}
