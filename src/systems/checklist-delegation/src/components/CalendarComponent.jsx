import React, { useState } from "react";

const CalendarComponent = ({ date, onChange, onClose }) => {
    const [currentMonth, setCurrentMonth] = useState(date && !isNaN(new Date(date).getTime()) ? new Date(date) : new Date());

    const getDaysInMonth = (year, month) => new Date(year, month + 1, 0).getDate();
    const getFirstDayOfMonth = (year, month) => new Date(year, month, 1).getDay();

    const handleDateClick = (day) => {
        const selectedDate = new Date(currentMonth.getFullYear(), currentMonth.getMonth(), day);
        onChange(selectedDate);
        onClose();
    };

    const renderDays = () => {
        const days = [];
        const daysInMonth = getDaysInMonth(currentMonth.getFullYear(), currentMonth.getMonth());
        const firstDayOfMonth = getFirstDayOfMonth(currentMonth.getFullYear(), currentMonth.getMonth());

        for (let i = 0; i < firstDayOfMonth; i++) {
            days.push(<div key={`empty-${i}`} className="h-8 w-8"></div>);
        }

        for (let day = 1; day <= daysInMonth; day++) {
            const dateToCheck = new Date(currentMonth.getFullYear(), currentMonth.getMonth(), day);
            const isSelected = date &&
                date.getDate() === day &&
                date.getMonth() === currentMonth.getMonth() &&
                date.getFullYear() === currentMonth.getFullYear();

            const isToday = new Date().toDateString() === dateToCheck.toDateString();

            days.push(
                <button
                    key={day}
                    type="button"
                    onClick={() => handleDateClick(day)}
                    className={`h-8 w-8 rounded-full flex items-center justify-center text-sm transition-colors ${isSelected
                            ? "bg-purple-600 text-white font-bold shadow-md"
                            : isToday
                                ? "bg-purple-50 text-purple-600 border border-purple-200 font-bold"
                                : "hover:bg-purple-100 text-gray-700"
                        }`}
                >
                    {day}
                </button>
            );
        }
        return days;
    };

    return (
        <div className="p-4 bg-white border border-gray-200 rounded-xl shadow-2xl w-72 animate-in fade-in zoom-in duration-200">
            <div className="flex justify-between items-center mb-4">
                <button
                    type="button"
                    onClick={() => setCurrentMonth(new Date(currentMonth.getFullYear(), currentMonth.getMonth() - 1, 1))}
                    className="p-1.5 hover:bg-purple-50 hover:text-purple-600 rounded-full text-gray-600 transition-colors"
                >
                    &lt;
                </button>
                <div className="text-sm font-bold text-gray-800">
                    {currentMonth.toLocaleString("default", { month: "long" })} {currentMonth.getFullYear()}
                </div>
                <button
                    type="button"
                    onClick={() => setCurrentMonth(new Date(currentMonth.getFullYear(), currentMonth.getMonth() + 1, 1))}
                    className="p-1.5 hover:bg-purple-50 hover:text-purple-600 rounded-full text-gray-600 transition-colors"
                >
                    &gt;
                </button>
            </div>
            <div className="grid grid-cols-7 gap-1 mb-2">
                {["Su", "Mo", "Tu", "We", "Th", "Fr", "Sa"].map((day) => (
                    <div key={day} className="h-8 w-8 flex items-center justify-center text-xs font-bold text-gray-400 uppercase">
                        {day}
                    </div>
                ))}
            </div>
            <div className="grid grid-cols-7 gap-1">
                {renderDays()}
            </div>
            <div className="mt-4 pt-3 border-t border-gray-100 flex justify-center">
                <button
                    type="button"
                    onClick={() => {
                        onChange(new Date());
                        onClose();
                    }}
                    className="text-xs font-bold text-purple-600 hover:text-purple-700 uppercase tracking-wider"
                >
                    Go to Today
                </button>
            </div>
        </div>
    );
};

export default CalendarComponent;
