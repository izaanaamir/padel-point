import React from "react";

export default function SummaryCards({ daily, weekly, role }: any) {
  const todayCount = daily?.bookings_count ?? 0;
  const todayRevenue = (daily?.paid_amount ?? 0).toFixed(2);
  const weekCount = weekly?.bookings_count ?? 0;
  const weekRevenue = (weekly?.paid_amount ?? 0).toFixed(2);

  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
      <div className="p-4 bg-white rounded shadow">
        <div className="text-sm text-slate-500">Bookings Today</div>
        <div className="text-2xl font-semibold">{todayCount}</div>
      </div>

      {role === "admin" && (
        <div className="p-4 bg-white rounded shadow">
          <div className="text-sm text-slate-500">Revenue Today</div>
          <div className="text-2xl font-semibold">Rs {todayRevenue}</div>
        </div>
      )}
       {role === "admin" &&
      (<div className="p-4 bg-white rounded shadow">
        <div className="text-sm text-slate-500">Bookings This Week</div>
        <div className="text-2xl font-semibold">{weekCount}</div>
      </div>)}

      {role === "admin" && (
        <div className="p-4 bg-white rounded shadow">
          <div className="text-sm text-slate-500">Revenue This Week</div>
          <div className="text-2xl font-semibold">Rs {weekRevenue}</div>
        </div>
      )}
    </div>
  );
}
