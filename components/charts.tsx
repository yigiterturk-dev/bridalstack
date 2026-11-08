"use client";

import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, LineChart, Line, PieChart, Pie, Cell } from "recharts";
import { formatPrice } from "@/config/modules";

type RevenueData = { month: string; revenue: number }[];
type AppointmentData = { day: string; count: number }[];
type StatusData = { name: string; value: number }[];

const ACCENT = "#a8875a";
const COLORS = [ACCENT, "#1c1a23", "#cdb995", "#6b6770", "#e6dccb", "#3a3640", "#b9a27c", "#d8d2c9"];
const axisTick = { fontSize: 12, fill: "#9ca3af" };
const tooltipStyle = { borderRadius: 12, border: "1px solid #ececef", boxShadow: "0 4px 16px rgba(28,26,35,0.08)", fontSize: 13 };

export function RevenueChart({ data }: { data: RevenueData }) {
  return (
    <div>
      <h3 className="text-sm font-semibold text-gray-900 mb-4">Revenue (6 months)</h3>
      <ResponsiveContainer width="100%" height={240}>
        <BarChart data={data}>
          <CartesianGrid strokeDasharray="3 3" stroke="#f3f4f6" vertical={false} />
          <XAxis dataKey="month" tick={axisTick} axisLine={false} tickLine={false} />
          <YAxis tick={axisTick} axisLine={false} tickLine={false} tickFormatter={(v) => formatPrice(Number(v))} />
          <Tooltip cursor={{ fill: "#f9fafb" }} contentStyle={tooltipStyle} formatter={(v) => [formatPrice(Number(v)), "Revenue"]} />
          <Bar dataKey="revenue" fill={ACCENT} radius={[6, 6, 0, 0]} maxBarSize={48} />
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}

export function AppointmentChart({ data }: { data: AppointmentData }) {
  return (
    <div>
      <h3 className="text-sm font-semibold text-gray-900 mb-4">Appointments this week</h3>
      <ResponsiveContainer width="100%" height={240}>
        <LineChart data={data}>
          <CartesianGrid strokeDasharray="3 3" stroke="#f3f4f6" vertical={false} />
          <XAxis dataKey="day" tick={axisTick} axisLine={false} tickLine={false} />
          <YAxis tick={axisTick} axisLine={false} tickLine={false} allowDecimals={false} />
          <Tooltip contentStyle={tooltipStyle} />
          <Line type="monotone" dataKey="count" stroke={ACCENT} strokeWidth={2.5} dot={{ fill: ACCENT, r: 3 }} activeDot={{ r: 5 }} />
        </LineChart>
      </ResponsiveContainer>
    </div>
  );
}

export function StatusPieChart({ data, title }: { data: StatusData; title: string }) {
  return (
    <div>
      <h3 className="text-sm font-semibold text-gray-900 mb-4">{title}</h3>
      <ResponsiveContainer width="100%" height={240}>
        <PieChart>
          <Pie data={data} cx="50%" cy="50%" innerRadius={52} outerRadius={82} paddingAngle={3} dataKey="value" stroke="#fff" strokeWidth={2} label={({ name, value }) => `${name}: ${value}`}>
            {data.map((_, i) => <Cell key={i} fill={COLORS[i % COLORS.length]} />)}
          </Pie>
          <Tooltip contentStyle={tooltipStyle} />
        </PieChart>
      </ResponsiveContainer>
    </div>
  );
}
