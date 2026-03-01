import { BrowserRouter as Router, Routes, Route, Link, useLocation } from 'react-router-dom';
import Scanner from './pages/Scanner';
import Dashboard from './pages/Dashboard';

function Navigation() {
  const location = useLocation();
  
  return (
    <nav className="bg-slate-900 text-white p-4 shadow-md">
      <div className="max-w-6xl mx-auto flex justify-between items-center">
        <div className="font-black text-2xl text-emerald-400 tracking-tight">
          ResiboReport<span className="text-white">.ai</span>
        </div>
        <div className="flex gap-4">
          <Link 
            to="/" 
            className={`px-4 py-2 rounded-lg font-bold transition-colors ${location.pathname === '/' ? 'bg-emerald-500 text-white' : 'text-slate-300 hover:bg-slate-800'}`}>
            📷 Scanner
          </Link>
          <Link 
            to="/dashboard" 
            className={`px-4 py-2 rounded-lg font-bold transition-colors ${location.pathname === '/dashboard' ? 'bg-emerald-500 text-white' : 'text-slate-300 hover:bg-slate-800'}`}>
            📊 Dashboard
          </Link>
        </div>
      </div>
    </nav>
  );
}

function App() {
  return (
    <Router>
      <div className="min-h-screen bg-slate-50 font-sans text-slate-800">
        <Navigation />
        <main className="p-4">
          <Routes>
            <Route path="/" element={<Scanner />} />
            <Route path="/dashboard" element={<Dashboard />} />
          </Routes>
        </main>
      </div>
    </Router>
  );
}

export default App;