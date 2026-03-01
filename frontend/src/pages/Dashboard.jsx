import { useState, useEffect, useMemo } from 'react';
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid } from 'recharts';

function Dashboard() {
  const [logs, setLogs] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  const [timeFilter, setTimeFilter] = useState('Month'); 

  // 1. Fetch data from Python Backend
  useEffect(() => {
    const fetchReports = async () => {
      try {
        const response = await fetch("/api/python/reports");
        if (!response.ok) throw new Error("Failed to fetch");
        
        const result = await response.json();
        setLogs(result.data.reverse()); 
      } catch (error) {
        console.error("Error fetching logs:", error);
      } finally {
        setIsLoading(false);
      }
    };

    fetchReports();
  }, []);

  // 2. The Math Engine: Grouping data based on the selected filter
  const chartData = useMemo(() => {
    const now = new Date();
    const currentYear = now.getFullYear();
    const currentMonth = now.getMonth();
    
    // Get the exact YYYY-MM-DD string for "Today"
    // Note: We use local timezone offset to avoid UTC date shifting
    const offset = now.getTimezoneOffset() * 60000;
    const todayStr = new Date(now.getTime() - offset).toISOString().split('T')[0];

    // Get the start date for "This Week" (Sunday)
    const startOfWeek = new Date(now);
    startOfWeek.setDate(now.getDate() - now.getDay());
    startOfWeek.setHours(0, 0, 0, 0);

    let dataMap = {};

    // Pre-fill empty buckets so the chart always looks complete
    if (timeFilter === 'Week') {
      ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'].forEach(d => dataMap[d] = 0);
    } else if (timeFilter === 'Year') {
      ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'].forEach(m => dataMap[m] = 0);
    }

    // Sort logs into their buckets and add up the amounts
    logs.forEach(log => {
      if (!log.transaction_date) return;
      
      const dateObj = new Date(log.transaction_date);
      const amount = parseFloat(log.amount) || 0;

      if (timeFilter === 'Today' && log.transaction_date.startsWith(todayStr)) {
        // Group by Hour (e.g., "10:00 AM")
        const time = dateObj.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
        dataMap[time] = (dataMap[time] || 0) + amount;
      } 
      else if (timeFilter === 'Week' && dateObj >= startOfWeek) {
        // Group by Day Name
        const day = dateObj.toLocaleDateString([], { weekday: 'short' });
        if (dataMap[day] !== undefined) dataMap[day] += amount;
      } 
      else if (timeFilter === 'Month' && dateObj.getFullYear() === currentYear && dateObj.getMonth() === currentMonth) {
        // Group by Day Number (e.g., 1, 2, 15)
        const dayNum = dateObj.getDate().toString();
        dataMap[dayNum] = (dataMap[dayNum] || 0) + amount;
      } 
      else if (timeFilter === 'Year' && dateObj.getFullYear() === currentYear) {
        // Group by Month Name
        const month = dateObj.toLocaleDateString([], { month: 'short' });
        if (dataMap[month] !== undefined) dataMap[month] += amount;
      }
    });

    // Convert the dictionary map into an array format that Recharts understands
    if (timeFilter === 'Month' || timeFilter === 'Today') {
      // Sort chronologically (Day 1 to 31, or 9 AM to 5 PM)
      const sortedKeys = Object.keys(dataMap).sort((a, b) => {
         if (timeFilter === 'Month') return parseInt(a) - parseInt(b);
         return a.localeCompare(b);
      });
      return sortedKeys.map(key => ({ 
        label: timeFilter === 'Month' ? `Day ${key}` : key, 
        amount: dataMap[key] 
      }));
    } else {
      // Use the pre-filled order (Sun -> Sat, Jan -> Dec)
      return Object.keys(dataMap).map(key => ({ label: key, amount: dataMap[key] }));
    }
  }, [logs, timeFilter]);

  return (
    <div className="max-w-6xl mx-auto py-8">
      
      {/* Header & Supabase Link */}
      <div className="flex justify-between items-end mb-8">
        <div>
          <h1 className="text-4xl font-black text-slate-800 mb-2">Analytics Overview</h1>
          <p className="text-slate-500">Track your scanned receipts and expenses over time.</p>
        </div>
        <a 
          href="https://supabase.com/dashboard/projects" 
          target="_blank" 
          rel="noopener noreferrer"
          className="bg-slate-800 hover:bg-slate-700 text-white font-bold py-2 px-6 rounded-xl transition-colors text-sm flex items-center gap-2 shadow-sm"
        >
          ⚙️ Manage Database
        </a>
      </div>

      {isLoading ? (
        <div className="text-center py-20 text-slate-500 font-bold animate-pulse text-xl">
          Loading your financial data...
        </div>
      ) : (
        <div className="grid lg:grid-cols-3 gap-8">
          
          {/* LEFT COLUMN: Periodic Reports (Charts) */}
          <div className="lg:col-span-2 flex flex-col gap-8">
            <div className="bg-white p-6 rounded-2xl shadow-sm border border-slate-200">
              
              {/* Filter Buttons */}
              <div className="flex justify-between items-center mb-6">
                <h2 className="text-xl font-bold text-slate-800">Expense Trends</h2>
                <div className="flex bg-slate-100 p-1 rounded-lg">
                  {['Today', 'Week', 'Month', 'Year'].map(filter => (
                    <button 
                      key={filter}
                      onClick={() => setTimeFilter(filter)}
                      className={`px-4 py-1.5 rounded-md text-sm font-bold transition-all ${timeFilter === filter ? 'bg-white shadow-sm text-emerald-600' : 'text-slate-500 hover:text-slate-700'}`}
                    >
                      {filter}
                    </button>
                  ))}
                </div>
              </div>

              {/* The Recharts Canvas */}
              <div className="h-72 w-full">
                {chartData.length === 0 ? (
                  <div className="w-full h-full flex items-center justify-center text-slate-400 font-bold">
                    No transactions recorded for this period.
                  </div>
                ) : (
                  <ResponsiveContainer width="100%" height="100%">
                    {/* Notice we pass chartData here instead of logs! */}
                    <BarChart data={chartData}>
                      <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#e2e8f0"/>
                      {/* XAxis now uses the "label" we generated in our Math Engine */}
                      <XAxis dataKey="label" tick={{fontSize: 12, fill: '#64748b'}} axisLine={false} tickLine={false} />
                      <YAxis tick={{fontSize: 12, fill: '#64748b'}} axisLine={false} tickLine={false} tickFormatter={(val) => `₱${val}`} />
                      <Tooltip 
                        cursor={{fill: '#f1f5f9'}}
                        contentStyle={{ borderRadius: '12px', border: 'none', boxShadow: '0 10px 15px -3px rgb(0 0 0 / 0.1)', fontWeight: 'bold' }}
                        formatter={(value) => [`₱${value.toFixed(2)}`, 'Total Amount']}
                      />
                      <Bar dataKey="amount" fill="#10b981" radius={[6, 6, 0, 0]} />
                    </BarChart>
                  </ResponsiveContainer>
                )}
              </div>
            </div>
          </div>

          {/* RIGHT COLUMN: Recent Logs Table */}
          <div className="bg-white rounded-2xl shadow-sm border border-slate-200 overflow-hidden flex flex-col">
            <div className="p-6 border-b border-slate-100 bg-slate-50">
              <h2 className="text-xl font-bold text-slate-800">Recent Logs</h2>
            </div>
            <div className="p-6 overflow-y-auto max-h-[500px]">
              <div className="flex flex-col gap-4">
                {logs.length === 0 ? (
                  <p className="text-slate-400 text-center py-4">No receipts scanned yet.</p>
                ) : (
                  logs.map((log, index) => (
                    <div key={index} className="flex justify-between items-center p-4 border border-slate-100 rounded-xl hover:bg-slate-50 transition-colors">
                      <div>
                        <p className="font-bold text-slate-800 text-sm tracking-wide">Ref: {log.reference_number}</p>
                        <p className="text-xs text-slate-400 mt-1">{log.transaction_date}</p>
                      </div>
                      <div className="font-black text-emerald-600">
                        ₱{parseFloat(log.amount).toFixed(2)}
                      </div>
                    </div>
                  ))
                )}
              </div>
            </div>
          </div>

        </div>
      )}
    </div>
  );
}

export default Dashboard;