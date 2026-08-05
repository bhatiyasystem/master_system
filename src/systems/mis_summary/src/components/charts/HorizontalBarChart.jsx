import React from 'react';
import './HorizontalBarChart.css';

const HorizontalBarChart = ({ data, labels, colors, maxValue, subValues }) => {
  return (
    <div className="w-full h-full flex flex-col min-h-0">
      <div className="flex-1 overflow-y-auto min-h-0 horizontal-chart-scroll pr-2">
        <div className={`py-2 ${data.length === 1 ? 'flex items-center h-full' : ''}`}>
          <div className="space-y-6 w-full">
            {data.map((value, index) => {
              const percentage = Math.round((value / (subValues ? subValues[index] : maxValue || 1)) * 100);
              const barWidth = Math.min((value / (maxValue || 1)) * 100, 100);

              return (
                <div key={index} className="group flex flex-col space-y-2">
                  <div className="flex justify-between items-end px-1">
                    <span
                      className="text-sm font-semibold text-gray-700 truncate max-w-[70%] drop-shadow-sm"
                      title={labels[index]}
                    >
                      {labels[index]}
                    </span>
                    <div className="text-right">
                      <span className="text-xs font-medium text-gray-400 mr-2 uppercase tracking-wider">Pending</span>
                      <span className="text-sm font-bold text-gray-900 border-b-2 border-red-200">
                        {subValues ? `${value}/${subValues[index] ?? '—'}` : value}
                      </span>
                    </div>
                  </div>

                  <div className="relative h-6 md:h-8 w-full bg-gray-100 rounded-lg overflow-hidden border border-gray-200/50 shadow-inner">
                    {/* Background Grid Lines (Subtle) */}
                    <div className="absolute inset-0 flex justify-between pointer-events-none opacity-20">
                      {[25, 50, 75].map(v => (
                        <div key={v} className="w-px h-full bg-gray-400" style={{ left: `${v}%` }} />
                      ))}
                    </div>

                    {/* The Bar */}
                    <div
                      className="animate-bar-fill h-full rounded-r-md transition-all duration-700 ease-out flex items-center justify-end px-3 relative z-10"
                      style={{
                        width: `${barWidth}%`,
                        background: `linear-gradient(90deg, ${colors[index % colors.length]}, ${colors[index % colors.length]}dd)`,
                        boxShadow: `inset 0 1px 1px rgba(255,255,255,0.3), 0 0 15px ${colors[index % colors.length]}33`
                      }}
                    >
                      {barWidth > 15 && (
                        <span className="text-[10px] md:text-xs font-black text-white drop-shadow-md">
                          {percentage}%
                        </span>
                      )}
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </div>
    </div>
  );
};

export default HorizontalBarChart;