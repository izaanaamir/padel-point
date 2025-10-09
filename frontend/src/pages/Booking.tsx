import React, { useEffect, useState } from 'react'
import api from '../lib/api'
import { useAuth } from '../hooks/useAuth'
import { formatInTimeZone } from 'date-fns-tz'
import { format, addMinutes, setHours, setMinutes } from 'date-fns'

type Court = { id: number; name: string }
type BookingPayload = {
  court_id: number
  customer_name: string
  start_time: string
  end_time: string
  price: number
  paid?: boolean
  notes?: string
}

const PAKISTAN_TIMEZONE = "Asia/Karachi"

export default function BookingPage() {
  const { user } = useAuth()
  const [courts, setCourts] = useState<Court[]>([])
  const [customerName, setCustomerName] = useState('')
  const [courtId, setCourtId] = useState<number | null>(null)
  const [selectedDate, setSelectedDate] = useState('')
  const [startTimeSlot, setStartTimeSlot] = useState('')
  const [endTimeSlot, setEndTimeSlot] = useState('')
  const [price, setPrice] = useState<number>(4800)
  const [paid, setPaid] = useState(false)
  const [notes, setNotes] = useState('')
  const [msg, setMsg] = useState<{ text: string; type: 'success' | 'error' } | null>(null)
  const [loading, setLoading] = useState(false)

  // Generate time slots in 30-minute increments
  const generateTimeSlots = () => {
    const slots = []
    for (let hour = 0; hour <= 23; hour++) {
      for (let minute = 0; minute < 60; minute += 30) {
        const time = setMinutes(setHours(new Date(), hour), minute)
        const timeString = format(time, 'HH:mm')
        slots.push(timeString)
      }
    }
    return slots
  }

  // Generate end time slots (includes next day options)
  const generateEndTimeSlots = () => {
    const slots = []
    // Current day slots (from selected start time onwards)
    for (let hour = 0; hour <= 23; hour++) {
      for (let minute = 0; minute < 60; minute += 30) {
        const time = setMinutes(setHours(new Date(), hour), minute)
        const timeString = format(time, 'HH:mm')
        slots.push({ time: timeString, nextDay: false, display: timeString })
      }
    }
    // Next day slots (midnight to 6 AM)
    for (let hour = 0; hour < 6; hour++) {
      for (let minute = 0; minute < 60; minute += 30) {
        const time = setMinutes(setHours(new Date(), hour), minute)
        const timeString = format(time, 'HH:mm')
        slots.push({ 
          time: timeString, 
          nextDay: true, 
          display: `${timeString} (+1 day)` 
        })
      }
    }
    return slots
  }

  const timeSlots = generateTimeSlots()
  const endTimeSlots = generateEndTimeSlots()

  useEffect(() => {
    // Set default date to today in Pakistan timezone
    const today = formatInTimeZone(new Date(), PAKISTAN_TIMEZONE, 'yyyy-MM-dd')
    setSelectedDate(today)
    
    // Fetch courts
    ;(async () => {
      try {
        const resp = await api.get('/courts/')
        setCourts(resp.data)
        if (resp.data.length) setCourtId(resp.data[0].id)
      } catch (err) {
        console.error(err)
      }
    })()
  }, [])

  // Auto-calculate end time when start time changes
  useEffect(() => {
    if (startTimeSlot && !endTimeSlot) {
      const [hours, minutes] = startTimeSlot.split(':').map(Number)
      let endHour = hours + 1 // Default 1 hour duration
      let nextDay = false
      
      // Handle midnight crossover
      if (endHour >= 24) {
        endHour = endHour - 24
        nextDay = true
      }
      
      const endTimeString = format(setMinutes(setHours(new Date(), endHour), minutes), 'HH:mm')
      setEndTimeSlot(nextDay ? `${endTimeString}_next` : endTimeString)
    }
  }, [startTimeSlot])

  const createBooking = async (e: React.FormEvent) => {
    e.preventDefault()
    setMsg(null)
    
    // Validation
    if (!courtId) { 
      setMsg({ text: 'Please select a court', type: 'error' })
      return 
    }
    if (!customerName.trim()) { 
      setMsg({ text: 'Customer name is required', type: 'error' })
      return 
    }
    if (!selectedDate) { 
      setMsg({ text: 'Please select a date', type: 'error' })
      return 
    }
    if (!startTimeSlot || !endTimeSlot) { 
      setMsg({ text: 'Please select start and end time', type: 'error' })
      return 
    }
    
    // Check if end time is after start time
    const [startHour, startMin] = startTimeSlot.split(':').map(Number)
    const isEndNextDay = endTimeSlot.includes('_next')
    const cleanEndTime = endTimeSlot.replace('_next', '')
    const [endHour, endMin] = cleanEndTime.split(':').map(Number)
    
    const startMinutes = startHour * 60 + startMin
    const endMinutes = endHour * 60 + endMin + (isEndNextDay ? 24 * 60 : 0)
    
    if (endMinutes <= startMinutes) {
      setMsg({ text: 'End time must be after start time', type: 'error' })
      return
    }

    // Create datetime strings in Pakistani timezone
    const startDateTimeStr = `${selectedDate} ${startTimeSlot}:00`
    const endDateTimeStr = isEndNextDay 
      ? `${format(addMinutes(new Date(`${selectedDate}T00:00:00`), 24 * 60), 'yyyy-MM-dd')} ${cleanEndTime}:00`
      : `${selectedDate} ${cleanEndTime}:00`
    
    // Parse dates in Pakistani timezone and convert to UTC ISO strings
    const startDateTime = new Date(startDateTimeStr + ' GMT+0500') // Pakistani timezone is GMT+5
    const endDateTime = new Date(endDateTimeStr + ' GMT+0500')

    const payload: BookingPayload = {
      court_id: courtId,
      customer_name: customerName.trim(),
      start_time: startDateTime.toISOString(),
      end_time: endDateTime.toISOString(),
      price: price,
      paid: paid,
      notes: notes.trim()
    }

    setLoading(true)
    try {
      const resp = await api.post('/bookings/', payload)
      setMsg({ 
        text: `Booking created successfully!`, 
        type: 'success' 
      })
      // Reset form
      setCustomerName('')
      setNotes('')
      setStartTimeSlot('')
      setEndTimeSlot('')
    } catch (err: any) {
      setMsg({ 
        text: err?.response?.data?.detail || 'Error creating booking. Please try again.', 
        type: 'error' 
      })
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="p-8">
      <div className="mb-8">
        <h1 className="text-3xl font-bold text-gray-900 mb-2">Create New Booking</h1>
        <p className="text-gray-600">Schedule a court booking for your customer</p>
      </div>

      <div className="max-w-2xl">
        <div className="bg-white rounded-xl shadow-lg p-8">
          <form onSubmit={createBooking} className="space-y-6">
            
            {/* Customer Name */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Customer Name *
              </label>
              <input 
                type="text"
                value={customerName} 
                onChange={e => setCustomerName(e.target.value)} 
                className="w-full border border-gray-300 rounded-lg px-4 py-3 focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-colors"
                placeholder="Enter customer name"
              />
            </div>

            {/* Court and Price */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Court *
                </label>
                <select 
                  value={courtId ?? ''} 
                  onChange={e => setCourtId(Number(e.target.value))} 
                  className="w-full border border-gray-300 rounded-lg px-4 py-3 focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-colors"
                >
                  <option value="">Select a court</option>
                  {courts.map(c => (
                    <option key={c.id} value={c.id}>
                      {c.name}
                    </option>
                  ))}
                </select>
              </div>
              
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Price (Rs) *
                </label>
                <input 
                  type="number" 
                  min="0"
                  step="50"
                  value={price} 
                  onChange={e => setPrice(Number(e.target.value))} 
                  className="w-full border border-gray-300 rounded-lg px-4 py-3 focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-colors"
                />
              </div>
            </div>

            {/* Date */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Date *
              </label>
              <input 
                type="date" 
                value={selectedDate} 
                onChange={e => setSelectedDate(e.target.value)} 
                min={formatInTimeZone(new Date(), PAKISTAN_TIMEZONE, 'yyyy-MM-dd')}
                className="w-full border border-gray-300 rounded-lg px-4 py-3 focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-colors"
              />
            </div>

            {/* Time Slots */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Start Time *
                </label>
                <select 
                  value={startTimeSlot} 
                  onChange={e => setStartTimeSlot(e.target.value)} 
                  className="w-full border border-gray-300 rounded-lg px-4 py-3 focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-colors"
                >
                  <option value="">Select start time</option>
                  {timeSlots.map(slot => (
                    <option key={slot} value={slot}>
                      {slot}
                    </option>
                  ))}
                </select>
              </div>
              
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  End Time *
                </label>
                <select 
                  value={endTimeSlot} 
                  onChange={e => setEndTimeSlot(e.target.value)} 
                  className="w-full border border-gray-300 rounded-lg px-4 py-3 focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-colors"
                  disabled={!startTimeSlot}
                >
                  <option value="">Select end time</option>
                  {endTimeSlots
                    .filter(slot => {
                      if (!startTimeSlot) return false
                      const [startHour, startMin] = startTimeSlot.split(':').map(Number)
                      const [slotHour, slotMin] = slot.time.split(':').map(Number)
                      const startMinutes = startHour * 60 + startMin
                      const slotMinutes = slotHour * 60 + slotMin + (slot.nextDay ? 24 * 60 : 0)
                      return slotMinutes > startMinutes
                    })
                    .map(slot => (
                      <option 
                        key={`${slot.time}_${slot.nextDay}`} 
                        value={slot.nextDay ? `${slot.time}_next` : slot.time}
                      >
                        {slot.display}
                      </option>
                    ))}
                </select>
              </div>
            </div>

            {/* Payment Status */}
            <div className="bg-gray-50 rounded-lg p-4">
              <label className="flex items-center cursor-pointer">
                <input 
                  type="checkbox" 
                  checked={paid} 
                  onChange={e => setPaid(e.target.checked)} 
                  className="w-4 h-4 text-blue-600 bg-gray-100 border-gray-300 rounded focus:ring-blue-500 focus:ring-2"
                />
                <span className="ml-3 text-sm font-medium text-gray-700">
                  Mark as paid
                </span>
                <span className={`ml-2 px-2 py-1 text-xs rounded-full ${
                  paid ? 'bg-green-100 text-green-800' : 'bg-yellow-100 text-yellow-800'
                }`}>
                  {paid ? 'Paid' : 'Unpaid'}
                </span>
              </label>
            </div>

            {/* Notes */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Notes (Optional)
              </label>
              <textarea 
                value={notes} 
                onChange={e => setNotes(e.target.value)} 
                rows={3}
                className="w-full border border-gray-300 rounded-lg px-4 py-3 focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-colors resize-none"
                placeholder="Add any special notes or requirements..."
              />
            </div>

            {/* Message */}
            {msg && (
              <div className={`p-4 rounded-lg ${
                msg.type === 'success' 
                  ? 'bg-green-50 text-green-800 border border-green-200' 
                  : 'bg-red-50 text-red-800 border border-red-200'
              }`}>
                <div className="flex">
                  <span className={`flex-shrink-0 w-5 h-5 mr-3 mt-0.5 ${
                    msg.type === 'success' ? 'text-green-400' : 'text-red-400'
                  }`}>
                    {msg.type === 'success' ? '✓' : '⚠'}
                  </span>
                  <span className="text-sm font-medium">{msg.text}</span>
                </div>
              </div>
            )}

            {/* Submit Button */}
            <div className="pt-4">
              <button 
                type="submit" 
                disabled={loading}
                className={`w-full py-3 px-6 rounded-lg font-medium transition-all ${
                  loading 
                    ? 'bg-gray-400 cursor-not-allowed' 
                    : 'bg-blue-600 hover:bg-blue-700 transform hover:scale-[1.02]'
                } text-white shadow-lg`}
              >
                {loading ? (
                  <span className="flex items-center justify-center">
                    <svg className="animate-spin -ml-1 mr-3 h-5 w-5 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                    </svg>
                    Creating Booking...
                  </span>
                ) : (
                  'Create Booking'
                )}
              </button>
            </div>
          </form>
        </div>
      </div>
    </div>
  )
}
