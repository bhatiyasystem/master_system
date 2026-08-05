import React, { useState, useEffect } from 'react';
import { Calendar, ChevronLeft, ChevronRight, Clock, MapPin } from 'lucide-react';
import toast from 'react-hot-toast';

const CompanyCalendar = () => {
  const [currentDate, setCurrentDate] = useState(new Date());
  const [selectedDate, setSelectedDate] = useState(null);
  const [companyEvents, setCompanyEvents] = useState([]);
  const [loading, setLoading] = useState(true);

  // Fetch calendar data from Google Sheets
  const fetchCalendarData = async () => {
    setLoading(true);
    try {
      const response = await fetch(
        'https://script.google.com/macros/s/AKfycbzF-ERpUfrb0figpapH5q5-J1KRAnBHt-OaXYrN9Cw4wzwaacKhUPwGgtCIWfxw2Ruz9g/exec?sheet=CompanyCalendar&action=fetch'
      );
      
      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }
      
      const result = await response.json();
      
      if (!result.success) {
        throw new Error(result.error || 'Failed to fetch calendar data');
      }
      
      const rawData = result.data || result;
      
      if (!Array.isArray(rawData)) {
        throw new Error('Expected array data not received');
      }

      // Skip header row and map to structured data
      const dataRows = rawData.length > 1 ? rawData.slice(1) : [];
      
      const processedData = dataRows
        .map((row, index) => {
          // Format date to YYYY-MM-DD for consistency
          let formattedDate = '';
          if (row[2]) { // Date column
            // Handle different date formats
            const date = new Date(row[2]);
            if (!isNaN(date.getTime())) {
              formattedDate = date.toISOString().split('T')[0];
            } else {
              // Try to parse other date formats
              const parts = row[2].split('/');
              if (parts.length === 3) {
                formattedDate = `${parts[2]}-${parts[1].padStart(2, '0')}-${parts[0].padStart(2, '0')}`;
              }
            }
          }

          return {
            id: index + 1,
            timestamp: row[0] || '',
            title: row[1] || '',
            date: formattedDate,
            time: row[3] || '',
            location: row[4] || '',
            type: row[5] || 'meeting',
            description: row[6] || ''
          };
        })
        .filter(event => event.date && event.title); // Filter out invalid entries

      console.log("Processed calendar data:", processedData);
      setCompanyEvents(processedData);

    } catch (error) {
      console.error('Error fetching calendar data:', error);
      toast.error(`Failed to load calendar data: ${error.message}`);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchCalendarData();
  }, []);

  const months = [
    'January', 'February', 'March', 'April', 'May', 'June',
    'July', 'August', 'September', 'October', 'November', 'December'
  ];

  const daysOfWeek = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

  const getDaysInMonth = (date) => {
    const year = date.getFullYear();
    const month = date.getMonth();
    const firstDay = new Date(year, month, 1);
    const lastDay = new Date(year, month + 1, 0);
    const daysInMonth = lastDay.getDate();
    const startingDayOfWeek = firstDay.getDay();

    const days = [];
    
    // Add empty cells for days before the first day of the month
    for (let i = 0; i < startingDayOfWeek; i++) {
      days.push(null);
    }
    
    // Add days of the month
    for (let day = 1; day <= daysInMonth; day++) {
      days.push(day);
    }
    
    return days;
  };

  const navigateMonth = (direction) => {
    const newDate = new Date(currentDate);
    newDate.setMonth(currentDate.getMonth() + direction);
    setCurrentDate(newDate);
  };

  const getEventsForDate = (day) => {
    if (!day) return [];
    const dateString = `${currentDate.getFullYear()}-${String(currentDate.getMonth() + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
    return companyEvents.filter(event => event.date === dateString);
  };

  const getEventTypeColor = (type) => {
    switch (type.toLowerCase()) {
      case 'meeting': return 'bg-blue-100 text-blue-800';
      case 'holiday': return 'bg-red-100 text-red-800';
      case 'training': return 'bg-green-100 text-green-800';
      case 'review': return 'bg-purple-100 text-purple-800';
      case 'event': return 'bg-amber-100 text-amber-800';
      default: return 'bg-gray-100 text-gray-800';
    }
  };

  const days = getDaysInMonth(currentDate);
  const today = new Date();
  const isToday = (day) => {
    return day && 
           currentDate.getFullYear() === today.getFullYear() &&
           currentDate.getMonth() === today.getMonth() &&
           day === today.getDate();
  };

  // Filter upcoming events (from today onwards)
  const upcomingEvents = companyEvents.filter(event => {
    const eventDate = new Date(event.date);
    return eventDate >= new Date(today.setHours(0, 0, 0, 0));
  }).sort((a, b) => new Date(a.date) - new Date(b.date));

  return (
    <div className="space-y-6 page-content p-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold text-gray-800">Company Calendar</h1>
        {/* <button
          onClick={fetchCalendarData}
          disabled={loading}
          className="px-4 py-2 bg-indigo-600 text-white rounded-md hover:bg-indigo-700 disabled:opacity-50"
        >
          {loading ? 'Refreshing...' : 'Refresh Calendar'}
        </button> */}
      </div>

      {loading ? (
        <div className="flex justify-center items-center h-64">
          <div className="w-8 h-8 border-4 border-indigo-500 border-dashed rounded-full animate-spin"></div>
          <span className="ml-3 text-gray-600">Loading calendar data...</span>
        </div>
      ) : (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Calendar */}
          <div className="lg:col-span-2 bg-white rounded-xl shadow-lg border p-6">
            {/* Calendar Header */}
            <div className="flex items-center justify-between mb-6">
              <h2 className="text-xl font-bold text-gray-800">
                {months[currentDate.getMonth()]} {currentDate.getFullYear()}
              </h2>
              <div className="flex space-x-2">
                <button
                  onClick={() => navigateMonth(-1)}
                  className="p-2 rounded-lg hover:bg-gray-100"
                >
                  <ChevronLeft size={20} />
                </button>
                <button
                  onClick={() => navigateMonth(1)}
                  className="p-2 rounded-lg hover:bg-gray-100"
                >
                  <ChevronRight size={20} />
                </button>
              </div>
            </div>

            {/* Days of Week Header */}
            <div className="grid grid-cols-7 gap-1 mb-2">
              {daysOfWeek.map(day => (
                <div key={day} className="p-2 text-center text-sm font-medium text-gray-500">
                  {day}
                </div>
              ))}
            </div>

            {/* Calendar Grid */}
            <div className="grid grid-cols-7 gap-1">
              {days.map((day, index) => {
                const events = getEventsForDate(day);
                return (
                  <div
                    key={index}
                    className={`min-h-[80px] p-1 border border-gray-200 cursor-pointer hover:bg-gray-50 ${
                      isToday(day) ? 'bg-indigo-50 border-indigo-200' : ''
                    }`}
                    onClick={() => setSelectedDate(day)}
                  >
                    {day && (
                      <>
                        <div className={`text-sm font-medium ${isToday(day) ? 'text-indigo-600' : 'text-gray-900'}`}>
                          {day}
                        </div>
                        <div className="space-y-1 mt-1">
                          {events.slice(0, 2).map(event => (
                            <div
                              key={event.id}
                              className={`text-xs px-1 py-0.5 rounded truncate ${getEventTypeColor(event.type)}`}
                            >
                              {event.title}
                            </div>
                          ))}
                          {events.length > 2 && (
                            <div className="text-xs text-gray-500">
                              +{events.length - 2} more
                            </div>
                          )}
                        </div>
                      </>
                    )}
                  </div>
                );
              })}
            </div>
          </div>

          {/* Events Sidebar */}
          <div className="space-y-6">
            {/* Upcoming Events */}
            <div className="bg-white rounded-xl shadow-lg border p-6">
              <h3 className="text-lg font-bold text-gray-800 mb-4 flex items-center">
                <Calendar size={20} className="mr-2" />
                Upcoming Events
              </h3>
              <div className="space-y-3">
                {upcomingEvents.length > 0 ? (
                  upcomingEvents.slice(0, 5).map(event => (
                    <div key={event.id} className="border-l-4 border-indigo-500 pl-3 py-2">
                      <h4 className="font-medium text-gray-900">{event.title}</h4>
                      <div className="flex items-center text-sm text-gray-600 mt-1">
                        <Clock size={14} className="mr-1" />
                        {new Date(event.date).toLocaleDateString()} at {event.time}
                      </div>
                      <div className="flex items-center text-sm text-gray-600">
                        <MapPin size={14} className="mr-1" />
                        {event.location}
                      </div>
                    </div>
                  ))
                ) : (
                  <p className="text-gray-500 text-sm">No upcoming events</p>
                )}
              </div>
            </div>

            {/* Event Types Legend */}
            <div className="bg-white rounded-xl shadow-lg border p-6">
              <h3 className="text-lg font-bold text-gray-800 mb-4">Event Types</h3>
              <div className="space-y-2">
                <div className="flex items-center">
                  <div className="w-4 h-4 bg-blue-100 border border-blue-200 rounded mr-2"></div>
                  <span className="text-sm text-gray-700">Meetings</span>
                </div>
                <div className="flex items-center">
                  <div className="w-4 h-4 bg-red-100 border border-red-200 rounded mr-2"></div>
                  <span className="text-sm text-gray-700">Holidays</span>
                </div>
                <div className="flex items-center">
                  <div className="w-4 h-4 bg-green-100 border border-green-200 rounded mr-2"></div>
                  <span className="text-sm text-gray-700">Training</span>
                </div>
                <div className="flex items-center">
                  <div className="w-4 h-4 bg-purple-100 border border-purple-200 rounded mr-2"></div>
                  <span className="text-sm text-gray-700">Reviews</span>
                </div>
                <div className="flex items-center">
                  <div className="w-4 h-4 bg-amber-100 border border-amber-200 rounded mr-2"></div>
                  <span className="text-sm text-gray-700">Events</span>
                </div>
              </div>
            </div>

            {/* Selected Date Events */}
            {selectedDate && (
              <div className="bg-white rounded-xl shadow-lg border p-6">
                <h3 className="text-lg font-bold text-gray-800 mb-4">
                  Events on {months[currentDate.getMonth()]} {selectedDate}
                </h3>
                <div className="space-y-3">
                  {getEventsForDate(selectedDate).length > 0 ? (
                    getEventsForDate(selectedDate).map(event => (
                      <div key={event.id} className="border rounded-lg p-3">
                        <h4 className="font-medium text-gray-900">{event.title}</h4>
                        <div className="flex items-center text-sm text-gray-600 mt-1">
                          <Clock size={14} className="mr-1" />
                          {event.time}
                        </div>
                        <div className="flex items-center text-sm text-gray-600">
                          <MapPin size={14} className="mr-1" />
                          {event.location}
                        </div>
                        <p className="text-sm text-gray-700 mt-2">{event.description}</p>
                        <span className={`inline-block px-2 py-1 text-xs rounded-full mt-2 ${getEventTypeColor(event.type)}`}>
                          {event.type}
                        </span>
                      </div>
                    ))
                  ) : (
                    <p className="text-gray-500 text-sm">No events scheduled for this date.</p>
                  )}
                </div>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
};

export default CompanyCalendar;