import { toJpeg } from 'html-to-image';

export const generateDashboardJPEG = async (visibleColumnsList, filteredEmployeesData, topBestPerformers = [], pendingTasks = [], topWorstPerformers = [], departmentScores = []) => {
  const today = new Date().toLocaleDateString();

  // Create a temporary container for the report
  const container = document.createElement('div');
  container.style.position = 'fixed';
  container.style.left = '0';
  container.style.top = '0';
  container.style.width = '1200px';
  container.style.backgroundColor = 'white';
  container.style.padding = '40px';
  container.style.fontFamily = 'Arial, sans-serif';
  container.style.zIndex = '-9999';
  container.style.visibility = 'visible';
  container.style.pointerEvents = 'none';

  // Build HTML content
  let html = `
    <div style="text-align: center; margin-bottom: 30px; background-color: white;">
      <h1 style="font-size: 28px; color: #111827; margin: 0;">MIS System - Dashboard FULL Report</h1>
      <p style="font-size: 14px; color: #6b7280; margin-top: 5px;">Generated on: ${today}</p>
      <div style="height: 2px; background-color: #e5e7eb; margin: 20px 0;"></div>
    </div>

    <!-- Summary Sections Table -->
    <table style="width: 100%; border-collapse: separate; border-spacing: 20px 0; margin-bottom: 30px; background-color: white;">
      <tr>
        <!-- Top 5 Best Performers -->
        <td style="width: 33.33%; vertical-align: top; padding: 15px; border-radius: 12px; border: 1px solid #e5e7eb; background: #f0fdf4;">
          <h3 style="font-size: 16px; font-weight: bold; color: #166534; margin: 0 0 15px 0;">
            <span style="display: inline-block; width: 4px; height: 16px; background-color: #22c55e; border-radius: 2px; margin-right: 8px; vertical-align: middle;"></span>
            Top 5 Best Performers
          </h3>
          <table style="width: 100%; border-collapse: separate; border-spacing: 0 8px;">
            ${(topBestPerformers || []).map(emp => `
              <tr>
                <td style="padding: 8px; background: white; border-radius: 8px; border: 1px solid #dcfce7; font-size: 13px; font-weight: 600; color: #374151;">${emp.name}</td>
                <td style="padding: 8px; background: white; border-radius: 8px; border: 1px solid #dcfce7; font-size: 13px; font-weight: 700; color: #166534; text-align: right;">${emp.donePct || 0}% (${emp.workDone} / ${emp.totalTasks})</td>
              </tr>
            `).join('')}
            ${(!topBestPerformers || topBestPerformers.length === 0) ? '<tr><td colspan="2" style="font-size: 12px; color: #9ca3af; font-style: italic; text-align: center; padding: 10px;">No data available</td></tr>' : ''}
          </table>
        </td>

        <!-- Pending Tasks by User -->
        <td style="width: 33.33%; vertical-align: top; padding: 15px; border-radius: 12px; border: 1px solid #e5e7eb; background: #fef2f2;">
          <h3 style="font-size: 16px; font-weight: bold; color: #991b1b; margin: 0 0 15px 0;">
            <span style="display: inline-block; width: 4px; height: 16px; background-color: #ef4444; border-radius: 2px; margin-right: 8px; vertical-align: middle;"></span>
            Pending Tasks by User
          </h3>
          <table style="width: 100%; border-collapse: separate; border-spacing: 0 8px;">
            ${(pendingTasks || []).map(emp => `
              <tr>
                <td style="padding: 8px; background: white; border-radius: 8px; border: 1px solid #fee2e2; font-size: 13px; font-weight: 600; color: #374151;">${emp.name}</td>
                <td style="padding: 8px; background: white; border-radius: 8px; border: 1px solid #fee2e2; font-size: 13px; font-weight: 700; color: #991b1b; text-align: right;">${emp.pending} / ${emp.total}</td>
              </tr>
            `).join('')}
            ${(!pendingTasks || pendingTasks.length === 0) ? '<tr><td colspan="2" style="font-size: 12px; color: #9ca3af; font-style: italic; text-align: center; padding: 10px;">All tasks completed! ✅</td></tr>' : ''}
          </table>
        </td>

        <!-- Top 5 Worst Performers -->
        <td style="width: 33.33%; vertical-align: top; padding: 15px; border-radius: 12px; border: 1px solid #e5e7eb; background: #fff7ed;">
          <h3 style="font-size: 16px; font-weight: bold; color: #9a3412; margin: 0 0 15px 0;">
            <span style="display: inline-block; width: 4px; height: 16px; background-color: #f97316; border-radius: 2px; margin-right: 8px; vertical-align: middle;"></span>
            Top 5 Worst Performers
          </h3>
          <table style="width: 100%; border-collapse: separate; border-spacing: 0 8px;">
            ${(topWorstPerformers || []).map(emp => `
              <tr>
                <td style="padding: 8px; background: white; border-radius: 8px; border: 1px solid #ffedd5; font-size: 13px; font-weight: 600; color: #374151;">${emp.name}</td>
                <td style="padding: 8px; background: white; border-radius: 8px; border: 1px solid #ffedd5; font-size: 13px; font-weight: 700; color: #9a3412; text-align: right;">${emp.workNotDonePercentage ?? emp.score ?? 0}%</td>
              </tr>
            `).join('')}
            ${(!topWorstPerformers || topWorstPerformers.length === 0) ? '<tr><td colspan="2" style="font-size: 12px; color: #9ca3af; font-style: italic; text-align: center; padding: 10px;">No data available</td></tr>' : ''}
          </table>
        </td>
      </tr>
    </table>
    
    <!-- Performance Analytics Chart Section -->
    <div style="margin-bottom: 30px; background-color: white; border: 1px solid #e5e7eb; border-radius: 12px; padding: 20px;">
      <h2 style="font-size: 20px; font-weight: bold; color: #374151; margin: 0 0 15px 0;">
        <span style="display: inline-block; width: 6px; height: 20px; background-color: #2563eb; border-radius: 3px; margin-right: 10px; vertical-align: middle;"></span>
        Performance Analytics Graph
      </h2>
      <div style="width: 100%; height: 350px; background-color: #f9fafb; border-radius: 8px; overflow: hidden; display: flex; align-items: center; justify-content: center;">
        <img 
          src="https://docs.google.com/spreadsheets/d/e/2PACX-1vTO2wI31pXL9u9z_BmFSXomz2KWYoGRq687oTZL-PqltVhtQzqMVWTwtrfen7UbtitCDzNwRla0sWDZ/pubchart?oid=1932717403&format=image" 
          style="max-width: 100%; max-height: 100%; object-fit: contain;"
          alt="Performance Graph"
        />
      </div>
    </div>

    <!-- Department Performance Section -->
    <div style="margin-bottom: 20px; background-color: white;">
      <h2 style="font-size: 20px; font-weight: bold; color: #374151; margin: 0 0 15px 0;">
        <span style="display: inline-block; width: 6px; height: 20px; background-color: #a855f7; border-radius: 3px; margin-right: 10px; vertical-align: middle;"></span>
        Department Performance
      </h2>
      <table style="width: 100%; border-collapse: collapse; font-size: 13px; border: 1px solid #e5e7eb; background-color: white;">
        <thead>
          <tr style="background-color: #f8fafc; color: #475569; border-bottom: 2px solid #e2e8f0;">
            <th style="padding: 12px 15px; text-align: left; border: 1px solid #e5e7eb;">Department Name</th>
            <th style="padding: 12px 15px; text-align: right; border: 1px solid #e5e7eb;">Total Pending Works</th>
            <th style="padding: 12px 15px; text-align: right; border: 1px solid #e5e7eb;">Work Not Done %</th>
            <th style="padding: 12px 15px; text-align: right; border: 1px solid #e5e7eb;">Not Done On Time %</th>
          </tr>
        </thead>
        <tbody>
          ${(departmentScores || []).map((dept, index) => `
            <tr style="background-color: ${index % 2 === 0 ? '#ffffff' : '#f9fafb'};">
              <td style="padding: 10px 15px; border: 1px solid #e5e7eb; font-weight: 600; color: #1e293b;">${dept.name}</td>
              <td style="padding: 10px 15px; border: 1px solid #e5e7eb; text-align: right; color: #d97706; font-weight: bold;">${dept.pendingWorks}</td>
              <td style="padding: 10px 15px; border: 1px solid #e5e7eb; text-align: right; color: #2563eb; font-weight: bold;">${(dept.workNotDonePct || 0).toFixed(1)}%</td>
              <td style="padding: 10px 15px; border: 1px solid #e5e7eb; text-align: right; color: #dc2626; font-weight: bold;">${(dept.notDoneOnTimePct || 0).toFixed(1)}%</td>
            </tr>
          `).join('')}
          ${(!departmentScores || departmentScores.length === 0) ? '<tr><td colspan="4" style="padding: 15px; text-align: center; color: #9ca3af; font-style: italic;">No department data available</td></tr>' : ''}
        </tbody>
      </table>
    </div>
    
    <div style="margin-bottom: 20px; background-color: white;">
      <h2 style="font-size: 20px; color: #374151;">List of Employees</h2>
    </div>
    
    <table style="width: 100%; border-collapse: collapse; font-size: 12px; border: 1px solid #e5e7eb; background-color: white;">
      <thead>
        <tr style="background-color: #2563eb; color: white;">
  `;

  // Add Headers
  visibleColumnsList.forEach(col => {
    html += `<th style="padding: 12px 8px; text-align: left; border: 1px solid #3b82f6; background-color: #2563eb; color: white;">${col.label}</th>`;
  });

  html += `
        </tr>
      </thead>
      <tbody style="background-color: white;">
  `;

  // Add Body
  filteredEmployeesData.forEach((emp, index) => {
    const bgColor = index % 2 === 0 ? '#ffffff' : '#f9fafb';
    html += `<tr style="background-color: ${bgColor};">`;

    visibleColumnsList.forEach(col => {
      let value = '';
      switch (col.key) {
        case 'id': value = emp.id; break;
        case 'name': value = emp.name; break;
        case 'target': value = emp.target; break;
        case 'actualWork': value = emp.actualWorkDone; break;
        case 'weeklyDone': value = emp.weeklyWorkDone; break;
        case 'weeklyOnTime': value = emp.weeklyWorkDoneOnTime; break;
        case 'totalWork': value = emp.totalWorkDone; break;
        case 'weekPending': value = emp.weekPending; break;
        case 'allPending': value = emp.allPendingTillDate; break;
        case 'lastWeekPlannedNotDone': value = emp.plannedWorkNotDone; break;
        case 'lastWeekPlannedNotDoneOnTime': value = emp.plannedWorkNotDoneOnTime; break;
        case 'lastWeekCommitment': value = emp.commitment; break;
        case 'nextWeekPlannedNotDone': value = emp.nextWeekPlannedWorkNotDone || '0'; break;
        case 'nextWeekPlannedNotDoneOnTime': value = emp.nextWeekPlannedWorkNotDoneOnTime || '0'; break;
        case 'nextWeekCommitment': value = emp.nextWeekCommitment || '0'; break;
        default: value = '';
      }
      html += `<td style="padding: 10px 8px; border: 1px solid #e5e7eb; color: #374151;">${value}</td>`;
    });

    html += `</tr>`;
  });

  html += `
      </tbody>
    </table>
    <div style="margin-top: 30px; text-align: center; color: #9ca3af; font-size: 10px; background-color: white;">
      © ${new Date().getFullYear()} MIS System Dashboard. Information exported for internal use.
    </div>
  `;

  container.innerHTML = html;
  document.body.appendChild(container);

  try {
    // Wait for styles and potentially some rendering
    await new Promise(resolve => setTimeout(resolve, 1500));

    const dataUrl = await toJpeg(container, {
      quality: 0.95,
      backgroundColor: '#ffffff',
      cacheBust: true
    });

    // Create download link
    const link = document.createElement('a');
    link.download = `MIS-Dashboard-Full-Report-${today.replace(/\//g, '-')}.jpeg`;
    link.href = dataUrl;
    link.click();
  } catch (err) {
    console.error('Error generating JPEG:', err);
  } finally {
    // Cleanup
    document.body.removeChild(container);
  }
};
