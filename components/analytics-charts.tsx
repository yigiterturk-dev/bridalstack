"use client";

import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
  LineChart, Line, PieChart, Pie, Cell, Legend,
} from "recharts";
import { CURRENCY_SYMBOL } from "@/config/modules";

const ACCENT = "#b4496a";
const COLORS = [ACCENT, "#1c1a23", "#6366f1", "#f59e0b", "#10b981", "#8b5cf6", "#0ea5e9", "#ec4899"];
const axisTick = { fontSize: 12, fill: "#9ca3af" };
const tooltipStyle = { borderRadius: 12, border: "1px solid #ececef", boxShadow: "0 4px 16px rgba(28,26,35,0.08)", fontSize: 13 };

const formatMoney = (v: number) => `${CURRENCY_SYMBOL}${Number(v).toLocaleString("en-US")}`;

function Empty({ label }: { label: string }) {
  return (
    <div className="h-[240px] flex flex-col items-center justify-center text-center">
      <span className="material-symbols-outlined text-3xl text-gray-300 mb-2">bar_chart</span>
      <p className="text-sm text-gray-400">{label}</p>
    </div>
  );
}

// ── Gelir (aylık) ──────────────────────────────────────────────────────────
export function RevenueBars({ data }: { data: { label: string; value: number }[] }) {
  if (!data.some((d) => d.value > 0)) return <Empty label="No revenue recorded in this range." />;
  return (
    <ResponsiveContainer width="100%" height={240}>
      <BarChart data={data}>
        <CartesianGrid strokeDasharray="3 3" stroke="#f3f4f6" vertical={false} />
        <XAxis dataKey="label" tick={axisTick} axisLine={false} tickLine={false} />
        <YAxis tick={axisTick} axisLine={false} tickLine={false} tickFormatter={(v) => `${CURRENCY_SYMBOL}${(v / 1000).toFixed(0)}k`} width={48} />
        <Tooltip cursor={{ fill: "#f9fafb" }} contentStyle={tooltipStyle} formatter={(v) => [formatMoney(Number(v)), "Revenue"]} />
        <Bar dataKey="value" fill={ACCENT} radius={[6, 6, 0, 0]} maxBarSize={48} />
      </BarChart>
    </ResponsiveContainer>
  );
}

// ── Randevu doluluk (gün bazında) ──────────────────────────────────────────
export function FillLine({ data }: { data: { label: string; booked: number; capacity: number }[] }) {
  if (!data.some((d) => d.capacity > 0 || d.booked > 0)) return <Empty label="No appointment data in this range." />;
  return (
    <ResponsiveContainer width="100%" height={240}>
      <LineChart data={data}>
        <CartesianGrid strokeDasharray="3 3" stroke="#f3f4f6" vertical={false} />
        <XAxis dataKey="label" tick={axisTick} axisLine={false} tickLine={false} />
        <YAxis tick={axisTick} axisLine={false} tickLine={false} allowDecimals={false} width={32} />
        <Tooltip contentStyle={tooltipStyle} />
        <Legend wrapperStyle={{ fontSize: 12 }} />
        <Line type="monotone" dataKey="booked" name="Booked" stroke={ACCENT} strokeWidth={2.5} dot={{ r: 3 }} activeDot={{ r: 5 }} />
        <Line type="monotone" dataKey="capacity" name="Capacity" stroke="#c7c5cc" strokeWidth={2} strokeDasharray="4 4" dot={false} />
      </LineChart>
    </ResponsiveContainer>
  );
}

// ── Personel performansı ───────────────────────────────────────────────────
export function StaffBars({ data, valueLabel = "Revenue", money = true }: { data: { label: string; value: number }[]; valueLabel?: string; money?: boolean }) {
  if (!data.some((d) => d.value > 0)) return <Empty label="No staff data in this range." />;
  return (
    <ResponsiveContainer width="100%" height={Math.max(240, data.length * 40)}>
      <BarChart data={data} layout="vertical" margin={{ left: 8 }}>
        <CartesianGrid strokeDasharray="3 3" stroke="#f3f4f6" horizontal={false} />
        <XAxis type="number" tick={axisTick} axisLine={false} tickLine={false} tickFormatter={money ? (v) => `${CURRENCY_SYMBOL}${(v / 1000).toFixed(0)}k` : undefined} />
        <YAxis type="category" dataKey="label" tick={{ fontSize: 12, fill: "#374151" }} axisLine={false} tickLine={false} width={110} />
        <Tooltip cursor={{ fill: "#f9fafb" }} contentStyle={tooltipStyle} formatter={(v) => [money ? formatMoney(Number(v)) : Number(v), valueLabel]} />
        <Bar dataKey="value" fill={ACCENT} radius={[0, 6, 6, 0]} maxBarSize={28} />
      </BarChart>
    </ResponsiveContainer>
  );
}

// ── Pasta (durum/kategori dağılımı) ────────────────────────────────────────
export function DistributionPie({ data }: { data: { name: string; value: number }[] }) {
  if (!data.some((d) => d.value > 0)) return <Empty label="Nothing to show yet." />;
  return (
    <ResponsiveContainer width="100%" height={240}>
      <PieChart>
        <Pie data={data} cx="50%" cy="50%" innerRadius={52} outerRadius={82} paddingAngle={3} dataKey="value" stroke="#fff" strokeWidth={2} label={({ name, value }) => `${name}: ${value}`}>
          {data.map((_, i) => <Cell key={i} fill={COLORS[i % COLORS.length]} />)}
        </Pie>
        <Tooltip contentStyle={tooltipStyle} />
      </PieChart>
    </ResponsiveContainer>
  );
}
