import React from 'react';

const MisReport = () => {
  const peopleData = [
    {
      id: 1,
      name: "Rajesh Kumar",
      department: "Engineering",
      dateStart: "2025-01-01",
      dateEnd: "2025-12-31",
      target: "100%",
      actualWorkDone: 85,
      workDone: 85,
      workDoneOnTime: 90,
      totalWorkDone: 2,
      weekPending: '',
      avatar: "👨‍💼"
    },
    {
      id: 2,
      name: "Priya Sharma",
      department: "Design",
      dateStart: "2025-02-01",
      dateEnd: "2025-12-31",
      target: "95%",
      actualWorkDone: 82,
      workDone: 82,
      workDoneOnTime: 85,
      totalWorkDone: 3,
      weekPending: '',
      avatar: "👩‍💼"
    },
    {
      id: 3,
      name: "Amit Patel",
      department: "Marketing",
      dateStart: "2025-03-01",
      dateEnd: "2025-12-31",
      target: "90%",
      actualWorkDone: 70,
      workDone: 70,
      workDoneOnTime: 75,
      totalWorkDone: 4,
      weekPending: '',
      avatar: "👨‍💼"
    },
    {
      id: 4,
      name: "Neha Gupta",
      department: "Sales",
      dateStart: "2025-01-15",
      dateEnd: "2025-12-31",
      target: "100%",
      actualWorkDone: 95,
      workDone: 95,
      workDoneOnTime: 98,
      totalWorkDone: 1,
      weekPending: '',
      avatar: "👩‍💼"
    },
    {
      id: 5,
      name: "Vikram Singh",
      department: "Engineering",
      dateStart: "2025-02-15",
      dateEnd: "2025-12-31",
      target: "95%",
      actualWorkDone: 88,
      workDone: 88,
      workDoneOnTime: 90,
      totalWorkDone: 2,
      weekPending: '',
      avatar: "👨‍💼"
    }
  ];

  const ProgressBar = ({ value, color }) => {
    return (
      <div className="flex items-center space-x-2">
        <div className="w-20 bg-gray-200 rounded-full h-3">
          <div 
            className={`h-3 rounded-full ${color}`} 
            style={{ width: `${value}%` }}
          ></div>
        </div>
        <span className="text-sm text-gray-600">{value}%</span>
      </div>
    );
  };

  const TotalDoneWork = ({ weeks }) => {
    const getColor = (weeks) => {
      if (weeks === 1) return 'bg-green-100 text-green-800';
      if (weeks === 2) return 'bg-yellow-100 text-yellow-800';
      if (weeks === 3) return 'bg-orange-100 text-orange-800';
      return 'bg-red-100 text-red-800';
    };

    return (
      <span className={`px-2 py-1 rounded-full text-sm font-medium ${getColor(weeks)}`}>
        {weeks}
      </span>
    );
  };

  return (
    <div className="p-6 bg-gray-50 min-h-screen">
      <div className="max-w-7xl mx-auto">
        <h1 className="text-2xl font-bold text-gray-900 mb-6">List of People</h1>
        
        <div className="bg-white rounded-lg shadow overflow-hidden">
          <div className="overflow-x-auto">
            <table className="min-w-full">
              <thead className="bg-gray-50 border-b border-gray-200">
                <tr>
                  <th className="px-6 py-4 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">NAME</th>
                  <th className="px-6 py-4 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">DATE START</th>
                  <th className="px-6 py-4 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">DATE END</th>
                  <th className="px-6 py-4 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">TARGET</th>
                  <th className="px-6 py-4 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">ACTUAL WORK DONE</th>
                  <th className="px-6 py-4 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">% WORK DONE</th>
                  <th className="px-6 py-4 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">% WORK DONE ON TIME</th>
                  <th className="px-6 py-4 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">TOTAL WORK DONE</th>
                  <th className="px-6 py-4 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">WEEK PENDING</th>
                </tr>
              </thead>
              <tbody className="bg-white divide-y divide-gray-200">
                {peopleData.map((person, index) => (
                  <tr key={person.id} className={index % 2 === 0 ? 'bg-white' : 'bg-gray-50'}>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <div className="flex items-center">
                        <div className="flex-shrink-0 h-10 w-10">
                          <div className="h-10 w-10 rounded-full bg-gray-200 flex items-center justify-center text-lg">
                            {person.avatar}
                          </div>
                        </div>
                        <div className="ml-4">
                          <div className="text-sm font-medium text-gray-900">{person.name}</div>
                          <div className="text-sm text-gray-500">{person.department}</div>
                        </div>
                      </div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">{person.dateStart}</td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">{person.dateEnd}</td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">{person.target}</td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <ProgressBar value={person.actualWorkDone} color="bg-blue-500" />
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <ProgressBar value={person.workDone} color="bg-green-500" />
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <ProgressBar value={person.workDoneOnTime} color="bg-purple-500" />
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500"><TotalDoneWork weeks={person.totalWorkDone} /></td>
                    <td className="px-6 py-4 whitespace-nowrap">
                    {person.weekPending}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </div>
  );
};

export default MisReport;