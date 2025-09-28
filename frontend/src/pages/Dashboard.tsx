import React, { useState, useEffect } from "react";
import { useAuth } from "../hooks/useAuth";
import api from "../lib/api";
import { format, addDays, subDays, isSameDay } from "date-fns";
import { formatInTimeZone, toZonedTime } from "date-fns-tz";
import SummaryCards from "../components/SummaryCards";
import jsPDF from "jspdf";
import autoTable from "jspdf-autotable";

type Booking = {
  id: number;
  court_id: number;
  customer_name: string;
  start_time: string;
  end_time: string;
  price: number;
  paid: boolean;
  notes?: string;
  status?: string;
};

type ReportData = {
  start_date: string;
  end_date: string;
  bookings_count: number;
  total_revenue: number;
  paid_amount: number;
  unpaid_amount: number;
  per_day: Record<string, { count: number; revenue: number }>;
  per_court: Record<string, { count: number; revenue: number }>;
  bookings: Booking[];
};

const PAKISTAN_TIMEZONE = "Asia/Karachi";

// Helper function to convert UTC datetime to Pakistani time for display
const formatBookingTime = (
  utcTimeString: string,
  formatStr: string = "HH:mm"
) => {
  var pakistanTime = formatInTimeZone(
    new Date(utcTimeString + "Z"),
    PAKISTAN_TIMEZONE,
    formatStr
  );
  return pakistanTime;
};

// Helper function to get Pakistani date from UTC datetime
const getBookingDateInPakistan = (utcTimeString: string) => {
  return toZonedTime(new Date(utcTimeString + "Z"), PAKISTAN_TIMEZONE);
};

// Helper function to get current Pakistani date in YYYY-MM-DD format
const getPakistanToday = () => {
  return formatInTimeZone(new Date(), PAKISTAN_TIMEZONE, "yyyy-MM-dd");
};

// Helper function to get Pakistani time for any date
const getPakistanTime = (date: Date = new Date()) => {
  return toZonedTime(date, PAKISTAN_TIMEZONE);
};

const Dashboard: React.FC = () => {
  const { role } = useAuth();
  const [selectedDate, setSelectedDate] = useState(() => getPakistanTime());
  const [selectedDateBookings, setSelectedDateBookings] = useState<Booking[]>(
    []
  );
  const [allBookings, setAllBookings] = useState<Booking[]>([]);
  const [report, setReport] = useState<ReportData | null>(null);
  const [showReportDialog, setShowReportDialog] = useState(false);
  const [showDetailedReport, setShowDetailedReport] = useState(false); // New state for detailed report
  const [reportRange, setReportRange] = useState({
    start_date: getPakistanToday(),
    end_date: getPakistanToday(),
  });

  const [dailyReport, setDailyReport] = useState<ReportData | null>(null);
  const [weeklyReport, setWeeklyReport] = useState<ReportData | null>(null);
  const [viewMode, setViewMode] = useState<"list" | "calendar">("list");
  const [selectedBooking, setSelectedBooking] = useState<Booking | null>(null);
  const [showEditModal, setShowEditModal] = useState(false);
  const [editForm, setEditForm] = useState({
    price: 0,
    paid: false,
    notes: "",
  });

  // 📦 Load bookings & summary data
  useEffect(() => {
    fetchSelectedDateBookings();
    fetchAllBookings();
    fetchDashboardStats();
  }, [selectedDate]);

  const fetchSelectedDateBookings = async () => {
    const dateStr = format(selectedDate, "yyyy-MM-dd");
    const resp = await api.get(`/bookings?date=${dateStr}`);

    // Also get bookings from the previous day that might extend into the selected date
    const prevDayStr = format(subDays(selectedDate, 1), "yyyy-MM-dd");
    const prevDayResp = await api.get(`/bookings?date=${prevDayStr}`);

    // Filter previous day bookings to only include those that extend into the selected date
    const crossDayBookings = prevDayResp.data.filter((booking: Booking) => {
      const bookingEndDate = getBookingDateInPakistan(booking.end_time);
      return isSameDay(bookingEndDate, selectedDate);
    });

    // Combine current day bookings with cross-day bookings, but avoid duplicates
    const allRelevantBookings = [...resp.data];
    crossDayBookings.forEach((crossBooking: Booking) => {
      if (!allRelevantBookings.find((b) => b.id === crossBooking.id)) {
        allRelevantBookings.push(crossBooking);
      }
    });

    // For the list view, only show bookings that START on the selected date
    const listViewBookings = resp.data.filter(
      (booking: Booking) => booking.status !== "deleted"
    );

    setSelectedDateBookings(listViewBookings);
  };

  const fetchAllBookings = async () => {
    const resp = await api.get("/bookings");
    const activeBookings = resp.data.filter(
      (booking: Booking) => booking.status !== "deleted"
    );
    setAllBookings(activeBookings);
  };

  // 📆 Daily summary
  const fetchDashboardStats = async () => {
    try {
      const resp = await api.get("/reports/stats");
      console.log("Dashboard stats:", resp.data);

      // Set dailyReport
      setDailyReport({
        start_date: getPakistanToday(),
        end_date: getPakistanToday(),
        bookings_count: resp.data.daily_bookings,
        total_revenue: resp.data.daily_revenue,
        paid_amount: resp.data.daily_revenue,
        unpaid_amount: 0,
        per_day: {},
        per_court: {},
        bookings: [],
      });

      // Set weeklyReport
      const pakistanNow = getPakistanTime();
      const weekStart = format(addDays(pakistanNow, -6), "yyyy-MM-dd");
      const weekEnd = getPakistanToday();

      setWeeklyReport({
        start_date: weekStart,
        end_date: weekEnd,
        bookings_count: resp.data.weekly_bookings,
        total_revenue: resp.data.weekly_revenue,
        paid_amount: resp.data.weekly_revenue,
        unpaid_amount: 0,
        per_day: {},
        per_court: {},
        bookings: [],
      });
    } catch (error) {
      console.error("Error fetching dashboard stats:", error);
    }
  };

  // 📊 Fetch report for custom range
  const generateReport = async (formatType: "json" | "pdf") => {
    const params = new URLSearchParams({
      start_date: reportRange.start_date,
      end_date: reportRange.end_date,
    });

    const resp = await api.get(`reports/report?${params.toString()}`);
    // Ensure only paid bookings are counted in revenue
    const paidBookings =
      resp.data.bookings?.filter((b: Booking) => b.paid) || [];
    const paidRevenue = paidBookings.reduce(
      (sum: number, b: Booking) => sum + b.price,
      0
    );
    const processedReport = {
      ...resp.data,
      total_revenue: paidRevenue,
      paid_amount: paidRevenue,
      unpaid_amount: 0,
    };
    setReport(processedReport);
    setShowReportDialog(false);

    if (formatType === "json") {
      setShowDetailedReport(true);
    } else {
      generatePDF(processedReport);
    }
  };

  // 📄 Generate PDF function
const generatePDF = (reportData: ReportData) => {
  const doc = new jsPDF();

  // Calculate booking statistics
  const totalBookings = reportData.bookings.length;
  const completedBookings = reportData.bookings.filter(b => b.status === "active").length;
  const deletedBookings = reportData.bookings.filter(b => b.status === "deleted").length;
  const totalRevenue = reportData.bookings.filter(b => b.paid).reduce((sum, b) => sum + b.price, 0);

  doc.setFontSize(20);
  doc.text("Padel Point - Court Booking Report", 20, 20);

  doc.setFontSize(12);
  doc.text(
    `Period: ${format(
      new Date(reportData.start_date),
      "MMM d, yyyy"
    )} - ${format(new Date(reportData.end_date), "MMM d, yyyy")}`,
    20,
    35
  );

  // Summary statistics
  doc.text(`Total Bookings: ${totalBookings}`, 20, 50);
  doc.text(`Completed Bookings: ${completedBookings}`, 20, 60);
  doc.text(`Deleted Bookings: ${deletedBookings}`, 20, 70);
  doc.text(`Total Revenue (Paid): Rs ${totalRevenue.toFixed(2)}`, 20, 80);

  // Daily breakdown table with enhanced columns
  const dailyData = Object.entries(reportData.per_day).map(([date, stats]) => {
    const dayBookings = reportData.bookings.filter(b => 
      format(new Date(b.start_time + 'Z'), "yyyy-MM-dd") === date
    );
    const dayTotal = dayBookings.length;
    const dayCompleted = dayBookings.filter(b => b.status === "active").length;
    const dayDeleted = dayBookings.filter(b => b.status === "deleted").length;
    const dayRevenue = dayBookings.filter(b => b.paid).reduce((sum, b) => sum + b.price, 0);
    
    return [
      format(new Date(date), "MMM d, yyyy"),
      dayTotal.toString(),
      dayCompleted.toString(),
      dayDeleted.toString(),
      `Rs ${dayRevenue.toFixed(2)}`
    ];
  });

  autoTable(doc, {
    head: [["Date", "Total", "Completed Bookings", "Deleted Bookings", "Revenue"]],
    body: dailyData,
    startY: 95,
    theme: "grid",
  });

  // Individual bookings table with separate payment and booking status
  const bookingsData = reportData.bookings.map((booking) => [
    format(new Date(booking.start_time + "Z"), "MMM d, yyyy"),
    formatBookingTime(booking.start_time) +
      " - " +
      formatBookingTime(booking.end_time),
    `Rs ${booking.price.toFixed(2)}`,
    booking.paid ? "Paid" : "Unpaid",
    booking.status === "deleted" ? "Deleted" : "Active"
  ]);

  autoTable(doc, {
    head: [["Date", "Time", "Price", "Payment Status", "Booking Status"]],
    body: bookingsData,
    startY: (doc.lastAutoTable?.finalY ?? 95) + 15,
    theme: "grid",
  });

  doc.save(
    `court-report-${reportData.start_date}-to-${reportData.end_date}.pdf`
  );
};

  const printReceipt = (booking: Booking) => {
    const start = formatBookingTime(booking.start_time, "HH:mm");
    const end = formatBookingTime(booking.end_time, "HH:mm");
    const date = format(getBookingDateInPakistan(booking.start_time), "PPP");

    const receiptContent = `
    <html>
      <head>
        <title>Receipt</title>
        <style>
          body { font-family: monospace; padding: 20px; }
          .receipt { width: 250px; }
          .line { border-bottom: 1px dashed #000; margin: 5px 0; }
          .header { text-align: center; font-weight: bold; margin-bottom: 10px; }
        </style>
      </head>
      <body>
        <div class="receipt">
          <div class="header">Padel Point</div>
          <div class="line"></div>
          <div>Customer: ${booking.customer_name}</div>
          <div>Date: ${date}</div>
          <div>Time: ${start} - ${end}</div>
          <div>Court: ${booking.court_id}</div>
          <div>Payment: Rs ${booking.price.toFixed(2)}</div>
          <div class="line"></div>
          <div style="text-align:center; margin-top:10px;">Thank you!</div>
        </div>
      </body>
    </html>
  `;

    const printWindow = window.open("", "", "width=300,height=400");
    if (printWindow) {
      printWindow.document.write(receiptContent);
      printWindow.document.close();
      printWindow.focus();
      printWindow.print();
      printWindow.close();
    }
  };

  // Date navigation functions
  const goToPreviousDay = () => {
    setSelectedDate(subDays(selectedDate, 1));
  };

  const goToNextDay = () => {
    setSelectedDate(addDays(selectedDate, 1));
  };

  const goToToday = () => {
    setSelectedDate(getPakistanTime());
  };

  // Edit/Delete functions
  const handleEditClick = (booking: Booking) => {
    setSelectedBooking(booking);
    setEditForm({
      price: booking.price,
      paid: booking.paid,
      notes: booking.notes || "",
    });
    setShowEditModal(true);
  };

  const handleUpdateBooking = async () => {
    if (!selectedBooking) return;

    try {
      await api.patch(`/bookings/${selectedBooking.id}`, editForm);
      setShowEditModal(false);
      setSelectedBooking(null);
      fetchSelectedDateBookings();
      fetchAllBookings();
      fetchDashboardStats();
    } catch (error) {
      console.error("Error updating booking:", error);
    }
  };

  const handleDeleteBooking = async (bookingId: number) => {
    if (!confirm("Are you sure you want to delete this booking?")) return;

    try {
      await api.delete(`/bookings/${bookingId}`);
      fetchSelectedDateBookings();
      fetchAllBookings();
      fetchDashboardStats();
    } catch (error) {
      console.error("Error deleting booking:", error);
    }
  };

  // Get bookings for a specific hour (including cross-day bookings)
  const getBookingsForHour = (hour: number) => {
    return allBookings.filter((booking) => {
      const bookingStartDate = getBookingDateInPakistan(booking.start_time);
      const bookingEndDate = getBookingDateInPakistan(booking.end_time);
      const startHour = parseInt(formatBookingTime(booking.start_time, "HH"));
      const endHour = parseInt(formatBookingTime(booking.end_time, "HH"));

      // Check if booking starts on the selected date and covers this hour
      const startsOnSelectedDate = isSameDay(bookingStartDate, selectedDate);
      const endsOnSelectedDate = isSameDay(bookingEndDate, selectedDate);

      // For bookings that start on selected date
      if (startsOnSelectedDate) {
        // If it ends on the same day
        if (endsOnSelectedDate) {
          return hour >= startHour && hour < endHour;
        } else {
          // Cross-day booking: show from start hour until midnight
          return hour >= startHour;
        }
      }

      // For bookings that end on selected date (started previous day)
      if (endsOnSelectedDate && !startsOnSelectedDate) {
        // Show from midnight until end hour
        return hour < endHour;
      }

      return false;
    });
  };

  // Generate hours for daily view (24 hours: 0-23)
  const generateHours = () => {
    const hours = [];
    for (let i = 0; i <= 23; i++) {
      hours.push(i);
    }
    return hours;
  };

  const renderCalendarView = () => {
    const hours = generateHours();
    const dayStart = new Date(selectedDate);
    dayStart.setHours(0, 0, 0, 0);

    const dayEnd = new Date(selectedDate);
    dayEnd.setHours(23, 59, 59, 999);

    // 🔧 Filter all bookings that overlap the selected day (even cross-day)
    const bookingsForDay = allBookings.filter((booking) => {
      const start = getBookingDateInPakistan(booking.start_time);
      const end = getBookingDateInPakistan(booking.end_time);
      return end >= dayStart && start <= dayEnd;
    });

    return (
      <div className="bg-white rounded-xl shadow p-6">
        <div className="flex justify-between items-center mb-6">
          <h2 className="text-xl font-semibold">
            Daily Schedule - {format(selectedDate, "EEEE, MMMM d, yyyy")}
          </h2>
          <div className="flex gap-2">
            <button
              onClick={goToPreviousDay}
              className="px-3 py-2 bg-gray-200 rounded hover:bg-gray-300"
            >
              ← Previous
            </button>
            <button
              onClick={goToToday}
              className="px-3 py-2 bg-blue-600 text-white rounded hover:bg-blue-700"
            >
              Today
            </button>
            <button
              onClick={goToNextDay}
              className="px-3 py-2 bg-gray-200 rounded hover:bg-gray-300"
            >
              Next →
            </button>
            <input
              type="date"
              value={format(selectedDate, "yyyy-MM-dd")}
              onChange={(e) => setSelectedDate(new Date(e.target.value))}
              className="px-3 py-2 border rounded hover:border-gray-400"
            />
          </div>
        </div>

        <div className="relative max-h-[800px] overflow-y-auto border rounded-lg">
          {/* Timeline */}
          <div className="grid grid-rows-24 border-r">
            {hours.map((hour) => (
              <div
                key={hour}
                className="h-20 border-t relative text-sm text-gray-600 pl-2"
              >
                {hour === 0
                  ? "12:00 AM"
                  : hour < 12
                  ? `${hour}:00 AM`
                  : hour === 12
                  ? "12:00 PM"
                  : `${hour - 12}:00 PM`}
              </div>
            ))}
          </div>

          {/* Bookings as absolute blocks */}
          {/* Bookings as absolute blocks */}
          <div className="absolute top-0 left-24 right-0">
            {bookingsForDay.map((booking) => {
              const start = getBookingDateInPakistan(booking.start_time);
              const end = getBookingDateInPakistan(booking.end_time);

              const displayStart = start < dayStart ? dayStart : start;
              const displayEnd = end > dayEnd ? dayEnd : end;

              const startMinutes =
                displayStart.getHours() * 60 + displayStart.getMinutes();
              const endMinutes =
                displayEnd.getHours() * 60 + displayEnd.getMinutes();
              const durationMinutes = endMinutes - startMinutes;

              const minuteHeight = 80 / 60; // 80px per hour
              const top = startMinutes * minuteHeight;
              const height = durationMinutes * minuteHeight;

              // Calculate overlap
              const overlappingBookings = bookingsForDay.filter((b) => {
                const bStart = getBookingDateInPakistan(b.start_time);
                const bEnd = getBookingDateInPakistan(b.end_time);
                return !(bEnd <= displayStart || bStart >= displayEnd);
              });

              const widthPercent = 100 / overlappingBookings.length;
              const index = overlappingBookings.findIndex(
                (b) => b.id === booking.id
              );

              return (
                <div
                  key={booking.id}
                  style={{
                    position: "absolute",
                    top: `${top}px`,
                    height: `${height}px`,
                    left: `${widthPercent * index}%`,
                    width: `${widthPercent}%`,
                  }}
                  className={`p-3 rounded-lg border-l-4 ${
                    booking.court_id === 1
                      ? "bg-blue-50 border-blue-400"
                      : "bg-green-50 border-green-400"
                  } hover:shadow-md transition-shadow cursor-pointer`}
                >
                  <div className="font-semibold text-gray-800">
                    {booking.customer_name}
                  </div>
                  <div className="text-sm text-gray-600">
                    Court {booking.court_id} •{" "}
                    {formatBookingTime(booking.start_time)} -{" "}
                    {formatBookingTime(booking.end_time)}
                  </div>
                  <div className="text-sm font-medium text-gray-700">
                    Rs {booking.price.toFixed(2)} •
                    <span
                      className={`ml-1 ${
                        booking.paid ? "text-green-600" : "text-red-600"
                      }`}
                    >
                      {booking.paid ? "Paid" : "Unpaid"}
                    </span>
                  </div>
                  <div className="mt-2 flex gap-2">
                    <button
                      onClick={() => handleEditClick(booking)}
                      className="px-2 py-1 text-xs bg-blue-600 text-white rounded hover:bg-blue-700"
                    >
                      Edit
                    </button>
                    <button
                      onClick={() => handleDeleteBooking(booking.id)}
                      className="px-2 py-1 text-xs bg-red-600 text-white rounded hover:bg-red-700"
                    >
                      Delete
                    </button>
                    <button
                      onClick={() => printReceipt(booking)}
                      className="px-3 py-1 text-xs bg-gray-600 text-white rounded hover:bg-gray-700 transition-colors"
                    >
                      Receipt
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </div>
    );
  };

  return (
    <div className="p-8 space-y-8">
      <h1 className="text-3xl font-bold">Padel Point - Dashboard</h1>

      {/* 📊 Summary Cards */}
      <SummaryCards daily={dailyReport} weekly={weeklyReport} role={role} />

      {/* 📋 View Toggle */}
      <div className="flex justify-center">
        <div className="bg-gray-200 rounded-lg p-1">
          <button
            onClick={() => setViewMode("list")}
            className={`px-4 py-2 rounded transition-colors ${
              viewMode === "list"
                ? "bg-white shadow text-blue-600"
                : "text-gray-600 hover:text-gray-800"
            }`}
          >
            List View
          </button>
          <button
            onClick={() => setViewMode("calendar")}
            className={`px-4 py-2 rounded transition-colors ${
              viewMode === "calendar"
                ? "bg-white shadow text-blue-600"
                : "text-gray-600 hover:text-gray-800"
            }`}
          >
            Calendar View
          </button>
        </div>
      </div>

      {/* 📅 Calendar View */}
      {viewMode === "calendar" && renderCalendarView()}

      {/* 📋 Bookings List */}
      {viewMode === "list" && (
        <div className="bg-white rounded-xl shadow p-6">
          <div className="flex justify-between items-center mb-4">
            <h2 className="text-xl font-semibold">
              Bookings for {format(selectedDate, "EEEE, MMMM d, yyyy")}
            </h2>
            <div className="flex gap-2">
              <button
                onClick={goToPreviousDay}
                className="px-3 py-2 bg-gray-200 rounded hover:bg-gray-300 transition-colors"
              >
                ← Previous
              </button>
              <button
                onClick={goToToday}
                className="px-3 py-2 bg-blue-600 text-white rounded hover:bg-blue-700 transition-colors"
              >
                Today
              </button>
              <button
                onClick={goToNextDay}
                className="px-3 py-2 bg-gray-200 rounded hover:bg-gray-300 transition-colors"
              >
                Next →
              </button>
              <input
                type="date"
                value={format(selectedDate, "yyyy-MM-dd")}
                onChange={(e) => setSelectedDate(new Date(e.target.value))}
                className="px-3 py-2 border rounded hover:border-gray-400 transition-colors"
              />
            </div>
          </div>

          {selectedDateBookings.length === 0 ? (
            <p className="text-gray-500 text-center py-8">
              No bookings for this date
            </p>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full border-collapse">
                <thead>
                  <tr className="bg-gray-100 text-left">
                    <th className="p-3">Customer</th>
                    <th className="p-3">Court</th>
                    <th className="p-3">Start</th>
                    <th className="p-3">End</th>
                    <th className="p-3">Price</th>
                    <th className="p-3">Paid</th>
                    <th className="p-3">Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {selectedDateBookings.map((booking) => (
                    <tr
                      key={booking.id}
                      className="border-b hover:bg-gray-50 transition-colors"
                    >
                      <td className="p-3 font-medium">
                        {booking.customer_name}
                      </td>
                      <td className="p-3">
                        <span
                          className={`px-2 py-1 rounded-full text-xs font-medium ${
                            booking.court_id === 1
                              ? "bg-blue-100 text-blue-800"
                              : "bg-green-100 text-green-800"
                          }`}
                        >
                          Court {booking.court_id}
                        </span>
                      </td>
                      <td className="p-3">
                        {formatBookingTime(booking.start_time)}
                      </td>
                      <td className="p-3">
                        {formatBookingTime(booking.end_time)}
                      </td>
                      <td className="p-3 font-medium">
                        Rs {booking.price.toFixed(2)}
                      </td>
                      <td className="p-3">
                        <span
                          className={`px-2 py-1 rounded-full text-xs font-medium ${
                            booking.paid
                              ? "bg-green-100 text-green-800"
                              : "bg-red-100 text-red-800"
                          }`}
                        >
                          {booking.paid ? "Paid" : "Unpaid"}
                        </span>
                      </td>
                      <td className="p-3">
                        <div className="flex gap-2">
                          <button
                            onClick={() => handleEditClick(booking)}
                            className="px-3 py-1 text-xs bg-blue-600 text-white rounded hover:bg-blue-700 transition-colors"
                          >
                            Edit
                          </button>
                          <button
                            onClick={() => handleDeleteBooking(booking.id)}
                            className="px-3 py-1 text-xs bg-red-600 text-white rounded hover:bg-red-700 transition-colors"
                          >
                            Delete
                          </button>
                          <button
                            onClick={() => printReceipt(booking)}
                            className="px-3 py-1 text-xs bg-gray-600 text-white rounded hover:bg-gray-700 transition-colors"
                          >
                            Receipt
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}

      {/* 📝 Edit Booking Modal */}
      {showEditModal && selectedBooking && (
        <div className="fixed inset-0 bg-black bg-opacity-40 flex items-center justify-center z-50">
          <div className="bg-white p-6 rounded-lg w-96 shadow-lg">
            <h2 className="text-lg font-semibold mb-4">Edit Booking</h2>

            <div className="mb-4">
              <p className="text-sm text-gray-600 mb-2">
                <strong>Customer:</strong> {selectedBooking.customer_name}
              </p>
              <p className="text-sm text-gray-600 mb-2">
                <strong>Court:</strong> {selectedBooking.court_id}
              </p>
              <p className="text-sm text-gray-600 mb-4">
                <strong>Time:</strong>{" "}
                {formatBookingTime(selectedBooking.start_time)} -{" "}
                {formatBookingTime(selectedBooking.end_time)}
              </p>
            </div>

            <div className="mb-4">
              <label className="block text-sm font-medium mb-1">
                Price (Rs)
              </label>
              <input
                type="number"
                step="0.01"
                className="w-full border rounded px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500"
                value={editForm.price}
                onChange={(e) =>
                  setEditForm({
                    ...editForm,
                    price: parseFloat(e.target.value) || 0,
                  })
                }
              />
            </div>

            <div className="mb-4">
              <label className="flex items-center">
                <input
                  type="checkbox"
                  className="mr-2"
                  checked={editForm.paid}
                  onChange={(e) =>
                    setEditForm({ ...editForm, paid: e.target.checked })
                  }
                />
                <span className="text-sm font-medium">Paid</span>
              </label>
            </div>

            <div className="mb-6">
              <label className="block text-sm font-medium mb-1">Notes</label>
              <textarea
                className="w-full border rounded px-3 py-2 h-20 focus:outline-none focus:ring-2 focus:ring-blue-500"
                value={editForm.notes}
                onChange={(e) =>
                  setEditForm({ ...editForm, notes: e.target.value })
                }
                placeholder="Add any notes..."
              />
            </div>

            <div className="flex justify-between">
              <button
                onClick={() => setShowEditModal(false)}
                className="bg-gray-300 text-gray-700 px-4 py-2 rounded hover:bg-gray-400 transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={handleUpdateBooking}
                className="bg-green-600 text-white px-4 py-2 rounded hover:bg-green-700 transition-colors"
              >
                Save Changes
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Admin Report Button */}
      {role === "admin" && (
        <div className="flex justify-center">
          <button
            onClick={() => setShowReportDialog(true)}
            className="bg-green-600 text-white px-6 py-3 rounded-lg hover:bg-green-700 transition-colors font-medium"
          >
            Generate Summary Report
          </button>
        </div>
      )}

      {/* 📊 Admin Only - Detailed Revenue & Reports */}
      {role === "admin" && (
        <>
          {/* 📅 Report Dialog */}
          {showReportDialog && (
            <div className="fixed inset-0 bg-black bg-opacity-40 flex items-center justify-center z-50">
              <div className="bg-white p-6 rounded-lg w-96 shadow-lg">
                <h2 className="text-lg font-semibold mb-4">
                  Select Date Range
                </h2>
                <label className="block mb-2">Start Date</label>
                <input
                  type="date"
                  className="border p-2 w-full mb-4 rounded focus:outline-none focus:ring-2 focus:ring-blue-500"
                  value={reportRange.start_date}
                  onChange={(e) =>
                    setReportRange({
                      ...reportRange,
                      start_date: e.target.value,
                    })
                  }
                />
                <label className="block mb-2">End Date</label>
                <input
                  type="date"
                  className="border p-2 w-full mb-6 rounded focus:outline-none focus:ring-2 focus:ring-blue-500"
                  value={reportRange.end_date}
                  onChange={(e) =>
                    setReportRange({ ...reportRange, end_date: e.target.value })
                  }
                />
                <div className="flex justify-between gap-2">
                  <button
                    onClick={() => generateReport("json")}
                    className="bg-blue-600 text-white px-4 py-2 rounded hover:bg-blue-700 transition-colors"
                  >
                    Generate Report
                  </button>
                  <button
                    onClick={() => setShowReportDialog(false)}
                    className="bg-gray-300 text-gray-700 px-4 py-2 rounded hover:bg-gray-400 transition-colors"
                  >
                    Cancel
                  </button>
                </div>
              </div>
            </div>
          )}

          {/* 📊 Detailed Report Dialog */}
          {showDetailedReport && report && (
            <div className="fixed inset-0 bg-black bg-opacity-40 flex items-center justify-center z-50">
              <div className="bg-white p-6 rounded-lg w-4/5 max-w-4xl max-h-[90vh] overflow-y-auto shadow-lg">
                <div className="flex justify-between items-center mb-4">
                  <h2 className="text-xl font-semibold">Detailed Report</h2>
                  <button
                    onClick={() => setShowDetailedReport(false)}
                    className="text-gray-500 hover:text-gray-700 text-xl"
                  >
                    ×
                  </button>
                </div>

                <div className="mb-6">
                  <h3 className="text-lg font-medium mb-2">Summary</h3>
                  <div className="grid grid-cols-4 gap-4 mb-4">
                    <div className="bg-blue-50 p-4 rounded">
                      <p className="text-sm text-gray-600">Total Bookings</p>
                      <p className="text-2xl font-bold text-blue-600">
                        {report.bookings.length}
                      </p>
                    </div>
                    <div className="bg-green-50 p-4 rounded">
                      <p className="text-sm text-gray-600">Completed Bookings</p>
                      <p className="text-2xl font-bold text-green-600">
                        {report.bookings.filter((b) => b.status === "active").length}
                      </p>
                    </div>
                    <div className="bg-red-50 p-4 rounded">
                      <p className="text-sm text-gray-600">Deleted Bookings</p>
                      <p className="text-2xl font-bold text-red-600">
                        {report.bookings.filter((b) => b.status === "deleted").length}
                      </p>
                    </div>
                    <div className="bg-green-50 p-4 rounded">
                      <p className="text-sm text-gray-600">
                        Total Revenue (Paid Only)
                      </p>
                      <p className="text-2xl font-bold text-green-600">
                        Rs{" "}
                        {report.bookings
                          .filter((b) => b.paid)
                          .reduce((sum, b) => sum + b.price, 0)
                          .toFixed(2)}
                      </p>
                    </div>
                    <div className="bg-gray-50 p-4 rounded">
                      <p className="text-sm text-gray-600">Date Range</p>
                      <p className="text-sm font-medium">
                        {format(new Date(report.start_date), "MMM d")} -{" "}
                        {format(new Date(report.end_date), "MMM d, yyyy")}
                      </p>
                    </div>
                  </div>
                </div>

                <div className="mb-6">
                  <h3 className="text-lg font-medium mb-2">
                    Daily Breakdown (Active Bookings Only)
                  </h3>
                  <div className="overflow-x-auto">
                    <table className="w-full border-collapse border border-gray-300">
                      <thead>
                        <tr className="bg-gray-100">
                          <th className="border border-gray-300 p-2 text-left">
                            Date
                          </th>
                          <th className="border border-gray-300 p-2 text-left">
                            Active Bookings
                          </th>
                          <th className="border border-gray-300 p-2 text-left">
                            Deleted Bookings
                          </th>
                          <th className="border border-gray-300 p-2 text-left">
                            Revenue (Paid)
                          </th>
                        </tr>
                      </thead>
                      <tbody>
                        {Object.entries(report.per_day).map(([date, stats]) => {
                          const dayBookings = report.bookings.filter(
                            (b) =>
                              format(
                                new Date(b.start_time + "Z"),
                                "yyyy-MM-dd"
                              ) === date
                          );
                          const activeCount = dayBookings.filter(
                            (b) => b.status === "active"
                          ).length;
                          const deletedCount = dayBookings.filter(
                            (b) => b.status === "deleted"
                          ).length;
                          const paidRevenue = dayBookings
                            .filter((b) => b.status === "active" && b.paid)
                            .reduce((sum, b) => sum + b.price, 0);

                          return (
                            <tr key={date}>
                              <td className="border border-gray-300 p-2">
                                {format(new Date(date), "MMM d, yyyy")}
                              </td>
                              <td className="border border-gray-300 p-2">
                                {activeCount}
                              </td>
                              <td className="border border-gray-300 p-2">
                                {deletedCount}
                              </td>
                              <td className="border border-gray-300 p-2">
                                Rs {paidRevenue.toFixed(2)}
                              </td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  </div>
                </div>

                <div className="mb-6">
                  <h3 className="text-lg font-medium mb-2">All Bookings</h3>
                  <div className="overflow-x-auto">
                    <table className="w-full border-collapse border border-gray-300">
                      <thead>
                        <tr className="bg-gray-100">
                          <th className="border border-gray-300 p-2 text-left">
                            Date
                          </th>
                          <th className="border border-gray-300 p-2 text-left">
                            Time
                          </th>
                          <th className="border border-gray-300 p-2 text-left">
                            Price
                          </th>
                          <th className="border border-gray-300 p-2 text-left">
                            Payment Status
                          </th>
                          <th className="border border-gray-300 p-2 text-left">
                            Booking Status
                          </th>
                        </tr>
                      </thead>
                      <tbody>
                        {report.bookings.map((booking) => (
                          <tr
                            key={booking.id}
                            className={
                              booking.status === "deleted" ? "bg-red-50" : ""
                            }
                          >
                            <td className="border border-gray-300 p-2">
                              {format(
                                new Date(booking.start_time + "Z"),
                                "MMM d, yyyy"
                              )}
                            </td>
                            <td className="border border-gray-300 p-2">
                              {formatBookingTime(booking.start_time)} -{" "}
                              {formatBookingTime(booking.end_time)}
                            </td>
                            <td className="border border-gray-300 p-2">
                              Rs {booking.price.toFixed(2)}
                            </td>
                            <td className="border border-gray-300 p-2">
                              <span
                                className={`px-2 py-1 rounded-full text-xs ${
                                  booking.paid
                                    ? "bg-green-100 text-green-800"
                                    : "bg-yellow-100 text-yellow-800"
                                }`}
                              >
                                {booking.paid ? "Paid" : "Unpaid"}
                              </span>
                            </td>
                            <td className="border border-gray-300 p-2">
                              <span
                                className={`px-2 py-1 rounded-full text-xs ${
                                  booking.status === "deleted"
                                    ? "bg-red-100 text-red-800"
                                    : "bg-blue-100 text-blue-800"
                                }`}
                              >
                                {booking.status === "deleted"
                                  ? "Deleted"
                                  : "Active"}
                              </span>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>

                <div className="flex justify-end gap-2">
                  <button
                    onClick={() => generatePDF(report)}
                    className="bg-red-600 text-white px-4 py-2 rounded hover:bg-red-700"
                  >
                    Download PDF
                  </button>
                  <button
                    onClick={() => setShowDetailedReport(false)}
                    className="bg-gray-300 text-gray-700 px-4 py-2 rounded hover:bg-gray-400"
                  >
                    Close
                  </button>
                </div>
              </div>
            </div>
          )}
        </>
      )}
    </div>
  );
};

export default Dashboard;
