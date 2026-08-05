import React, { useMemo } from 'react';

const DepartmentScoreChart = ({ labels, pendingData, notDoneData, notDoneOnTimeData }) => {
    // 1. Calculate Dynamic Y-Axis scale including Negative range
    const { yAxisTicks, totalRange, zeroPos, yMax, yMin } = useMemo(() => {
        const maxPos = Math.max(...pendingData, 250);
        // Treat percentages as negative magnitudes for visualization
        // The user's image shows values like -70, -75, and an axis going to -250.
        const minNeg = -250; // We'll keep a fixed minimum for percentages to ensure visibility

        const roundedMax = Math.ceil((maxPos + 50) / 250) * 250;

        const ticks = [];
        // Generate ticks from roundedMax down to -250
        for (let i = roundedMax; i >= -250; i -= 250) {
            ticks.push(i);
        }

        const range = roundedMax - minNeg;
        // Zero position as percentage from TOP
        const zeroPercentTop = (roundedMax / range) * 100;

        return {
            yAxisTicks: ticks,
            totalRange: range,
            zeroPos: zeroPercentTop,
            yMax: roundedMax,
            yMin: minNeg
        };
    }, [pendingData]);

    return (
        <div className="w-full h-full flex flex-col bg-white rounded-xl shadow-sm border border-gray-100">
            {/* Legend */}
            <div className="flex flex-wrap justify-center gap-4 mb-6 text-[10px] md:text-xs pt-4">
                <div className="flex items-center gap-2">
                    <div className="w-3 h-3 bg-amber-500 rounded-sm" />
                    <span className="text-gray-600 font-medium">Total Pending Works</span>
                </div>
                <div className="flex items-center gap-2">
                    <div className="w-3 h-3 bg-red-500 rounded-sm" />
                    <span className="text-gray-600 font-medium">Not Done On Time %</span>
                </div>
                <div className="flex items-center gap-2">
                    <div className="w-3 h-3 bg-blue-500 rounded-sm" />
                    <span className="text-gray-600 font-medium">Work Not Done %</span>
                </div>
            </div>

            {/* Scrollable Container */}
            <div className="flex-1 flex overflow-x-auto overflow-y-hidden custom-scrollbar pb-16 relative min-h-[400px]">

                {/* Fixed Y-Axis (Sticky) */}
                <div className="sticky left-0 z-40 bg-white/95 backdrop-blur-sm flex flex-col justify-between pr-2 border-r border-gray-200 text-[10px] text-gray-500 w-12 shrink-0 h-full">
                    {yAxisTicks.map((tick, i) => (
                        <div
                            key={tick}
                            className="flex justify-end items-center relative"
                            style={{ height: `${100 / (yAxisTicks.length - 1)}%` }}
                        >
                            <span className="absolute right-2 font-bold">{tick}</span>
                            <div className="w-1.5 h-px bg-gray-400" />
                        </div>
                    ))}
                </div>

                {/* Chart Content */}
                <div
                    className="flex-1 flex items-stretch justify-around relative min-w-max px-4"
                    style={{ minWidth: Math.max(labels.length * 100, 600) + 'px' }}
                >
                    {/* Grid Lines */}
                    <div className="absolute inset-0 flex flex-col justify-between pointer-events-none">
                        {yAxisTicks.map(tick => (
                            <div key={tick} className="w-full h-px bg-gray-100" />
                        ))}
                    </div>

                    {/* Zero Line */}
                    <div
                        className="absolute left-0 right-0 h-0.5 bg-gray-700 z-10"
                        style={{ top: `${zeroPos}%` }}
                    />

                    {/* Bars */}
                    {labels.map((label, idx) => {
                        const pendingVal = pendingData[idx] || 0;
                        // For display, we show them as negative if the user wants "bottom of graph"
                        const notDoneVal = notDoneData[idx] || 0;
                        const notDoneOnTimeVal = notDoneOnTimeData[idx] || 0;

                        // Height calculations relative to 0
                        const pendingH = (pendingVal / totalRange) * 100;
                        const notDoneH = (notDoneVal / totalRange) * 100;
                        const notDoneOnTimeH = (notDoneOnTimeVal / totalRange) * 100;

                        return (
                            <div key={idx} className="flex flex-col items-center w-[80px] md:w-[120px] shrink-0 relative h-full group">

                                {/* Pending Bar (Upwards) */}
                                {pendingVal !== 0 && (
                                    <div
                                        className="absolute w-8 md:w-12 bg-amber-500 shadow-lg transition-all duration-700 hover:brightness-110 flex flex-col items-center justify-end rounded-t-sm z-20"
                                        style={{
                                            height: `${Math.abs(pendingH)}%`,
                                            bottom: `${100 - zeroPos}%`
                                        }}
                                    >
                                        <span className="absolute -top-7 text-[10px] font-extrabold text-amber-700 bg-amber-50/90 px-1.5 py-0.5 rounded border border-amber-200">
                                            {pendingVal}
                                        </span>
                                    </div>
                                )}

                                {/* Percentage Bars (Downwards / Bottom) */}
                                <div
                                    className="absolute w-10 md:w-14 flex flex-col z-30"
                                    style={{ top: `${zeroPos}%` }}
                                >
                                    {/* Blue Bar */}
                                    {notDoneVal !== 0 && (
                                        <div
                                            className="w-full bg-blue-500 shadow-md relative transition-all duration-700 hover:brightness-110 mb-1 border-t border-blue-600/30"
                                            style={{ height: `${Math.abs(notDoneH)}%` }}
                                        >
                                            <span className="absolute -left-1 top-0 text-[10px] font-bold text-blue-600 -translate-x-full pr-1 bg-white/40 rounded">
                                                -{notDoneVal.toFixed(1)}
                                            </span>
                                        </div>
                                    )}
                                    {/* Red Bar */}
                                    {notDoneOnTimeVal !== 0 && (
                                        <div
                                            className="w-full bg-red-500 shadow-md relative transition-all duration-700 hover:brightness-110 border-t border-red-600/30"
                                            style={{ height: `${Math.abs(notDoneOnTimeH)}%` }}
                                        >
                                            <span className="absolute -left-1 bottom-0 text-[10px] font-bold text-red-600 -translate-x-full pr-1 bg-white/40 rounded">
                                                -{notDoneOnTimeVal.toFixed(1)}
                                            </span>
                                        </div>
                                    )}
                                </div>

                                {/* Label */}
                                <div className="absolute bottom-4 w-full flex flex-col items-center z-40 px-1">
                                    <span className="text-[9px] md:text-[10px] text-gray-800 font-bold text-center leading-tight max-w-full break-words bg-white/80 py-1 rounded">
                                        {label}
                                    </span>
                                </div>
                            </div>
                        );
                    })}
                </div>
            </div>

            <div className="py-2 text-center text-[10px] font-bold text-gray-400 border-t bg-gray-50 uppercase tracking-widest rounded-b-xl">
                Department Name
            </div>
        </div>
    );
};

export default DepartmentScoreChart;
