import React, { useState, useEffect } from 'react';
import { PlusCircle, Trash2, Edit3, BarChart3 } from 'lucide-react';
import { RadarChart, PolarGrid, PolarAngleAxis, PolarRadiusAxis, Radar, ResponsiveContainer } from 'recharts';

interface Person {
  id: number;
  name: string;
  isHome: boolean;
}

interface HistoryEntry {
  timestamp: number;
  isHome: boolean;
}

const HomeTracker: React.FC = () => {
  // Initialize logging
  useEffect(() => {
    console.log('🏠 Home Tracker App Starting...');
    console.log('📅 App started at:', new Date().toISOString());
    console.log('🌐 Environment:', process.env.NODE_ENV);
    console.log('📱 User Agent:', navigator.userAgent);
    console.log('🔧 React Version:', React.version);
  }, []);

  const [currentView, setCurrentView] = useState<'home' | 'edit' | 'analytics'>('home');
  const [people, setPeople] = useState<Person[]>([
    { id: 1, name: 'Julia', isHome: false },
    { id: 2, name: 'Jossu', isHome: false },
    { id: 3, name: 'Papu', isHome: false },
    { id: 4, name: 'Cosmo', isHome: false },
    { id: 5, name: 'Pepi', isHome: false },
    { id: 6, name: 'Pauli', isHome: false },
    { id: 7, name: 'Tomi', isHome: false },
    { id: 8, name: 'Yoshi', isHome: false }
  ]);
  const [newPersonName, setNewPersonName] = useState<string>('');
  const [nextId, setNextId] = useState<number>(9);
  const [homeHistory, setHomeHistory] = useState<Record<string, HistoryEntry[]>>({});
  const [sessionStartTime] = useState<number>(Date.now());

  // Log initial state
  useEffect(() => {
    console.log('👥 Initial people loaded:', people.length, 'people');
    console.log('🏁 Session start time:', new Date(sessionStartTime).toISOString());
  }, [people.length, sessionStartTime]);

  // Track home status changes for analytics
  useEffect(() => {
    const now = Date.now();
    
    people.forEach(person => {
      setHomeHistory(prev => {
        const updatedHistory = { ...prev };
        
        if (!updatedHistory[person.name]) {
          updatedHistory[person.name] = [];
          console.log(`📝 Created history for ${person.name}`);
        }
        
        const lastEntry = updatedHistory[person.name][updatedHistory[person.name].length - 1];
        
        // If status changed or this is the first entry
        if (!lastEntry || lastEntry.isHome !== person.isHome) {
          updatedHistory[person.name].push({
            timestamp: now,
            isHome: person.isHome
          });
          console.log(`🔄 Status change for ${person.name}: ${person.isHome ? 'HOME' : 'AWAY'} at ${new Date(now).toLocaleTimeString()}`);
        }
        
        return updatedHistory;
      });
    });
  }, [people.map(p => `${p.name}-${p.isHome}`).join(',')]);

  // Calculate actual hours spent at home since session start
  const calculateHomeHours = (personName: string): number => {
    const history = homeHistory[personName] || [];
    if (history.length === 0) return 0;
    
    let totalHomeTime = 0;
    const now = Date.now();
    
    for (let i = 0; i < history.length; i++) {
      const entry = history[i];
      const nextEntry = history[i + 1];
      
      if (entry.isHome) {
        const endTime = nextEntry ? nextEntry.timestamp : now;
        const duration = Math.max(0, endTime - Math.max(entry.timestamp, sessionStartTime));
        totalHomeTime += duration;
      }
    }
    
    // Convert milliseconds to hours and cap at 72 for display
    const hours = Math.min(Math.round(totalHomeTime / (1000 * 60 * 60) * 10) / 10, 72);
    console.log(`⏰ ${personName} has been home for ${hours} hours this session`);
    return hours;
  };

  const togglePersonStatus = (personId: number): void => {
    const person = people.find(p => p.id === personId);
    if (person) {
      console.log(`🔄 Toggling ${person.name} from ${person.isHome ? 'HOME' : 'AWAY'} to ${!person.isHome ? 'HOME' : 'AWAY'}`);
    }
    
    setPeople(prev => prev.map(person => 
      person.id === personId ? { ...person, isHome: !person.isHome } : person
    ));
  };

  const addPerson = (): void => {
    if (newPersonName.trim()) {
      console.log(`➕ Adding new person: ${newPersonName.trim()} (ID: ${nextId})`);
      setPeople(prev => [...prev, { 
        id: nextId, 
        name: newPersonName.trim(), 
        isHome: false 
      }]);
      setNextId(prev => prev + 1);
      setNewPersonName('');
    } else {
      console.warn('❌ Cannot add person with empty name');
    }
  };

  const removePerson = (personId: number): void => {
    const personToRemove = people.find(p => p.id === personId);
    if (personToRemove) {
      console.log(`➖ Removing person: ${personToRemove.name} (ID: ${personId})`);
      // Remove from history as well
      setHomeHistory(prev => {
        const updatedHistory = { ...prev };
        delete updatedHistory[personToRemove.name];
        console.log(`🗑️ Removed history for ${personToRemove.name}`);
        return updatedHistory;
      });
    }
    setPeople(prev => prev.filter(person => person.id !== personId));
  };

  const homeCount = people.filter(person => person.isHome).length;

  // Log home count changes
  useEffect(() => {
    console.log(`🏠 Currently ${homeCount} people are home`);
  }, [homeCount]);

  // Generate analytics data based on actual tracking
  const getAnalyticsData = () => {
    const data = people.map(person => ({
      person: person.name,
      hoursHome: calculateHomeHours(person.name),
      fullMark: 72
    }));
    console.log('📊 Analytics data generated:', data);
    return data;
  };

  // Log view changes
  const handleViewChange = (newView: 'home' | 'edit' | 'analytics') => {
    console.log(`📱 View changed from ${currentView} to ${newView}`);
    setCurrentView(newView);
  };

  // Error boundary logging
  useEffect(() => {
    const handleError = (event: ErrorEvent) => {
      console.error('💥 JavaScript Error:', event.error);
      console.error('📍 Error details:', {
        message: event.message,
        filename: event.filename,
        lineno: event.lineno,
        colno: event.colno
      });
    };

    const handleUnhandledRejection = (event: PromiseRejectionEvent) => {
      console.error('💥 Unhandled Promise Rejection:', event.reason);
    };

    window.addEventListener('error', handleError);
    window.addEventListener('unhandledrejection', handleUnhandledRejection);

    return () => {
      window.removeEventListener('error', handleError);
      window.removeEventListener('unhandledrejection', handleUnhandledRejection);
    };
  }, []);

  if (currentView === 'home') {
    return (
      <div className="min-h-screen bg-gradient-to-br p-6">
        <div className="max-w-md mx-auto">
          <div className="text-center mb-8">
            <div className="flex justify-between items-center mb-4">
              <div></div>
              <h1 className="text-3xl font-light text-gray-800">Who's Home?</h1>
              <div className="flex space-x-2">
                <button
                  onClick={() => handleViewChange('analytics')}
                  className="p-2 text-gray-500 hover:text-green-600 transition-colors"
                >
                  <BarChart3 size={24} />
                </button>
                <button
                  onClick={() => handleViewChange('edit')}
                  className="p-2 text-gray-500 hover:text-green-600 transition-colors"
                >
                  <Edit3 size={24} />
                </button>
              </div>
            </div>
            <div className="bg-white rounded-full px-6 py-2 shadow-sm border border-gray-100">
              <span className="text-lg font-medium text-gray-600">
                {homeCount} {homeCount === 1 ? 'person' : 'people'} home
              </span>
            </div>
          </div>

          <div className="space-y-3">
            {people
              .sort((a, b) => (b.isHome ? 1 : 0) - (a.isHome ? 1 : 0))
              .map((person) => (
                <div
                  key={person.id}
                  className={`bg-white rounded-2xl p-5 shadow-sm border transition-all duration-300 ${
                    person.isHome 
                      ? 'border-green-200 bg-gradient-to-r from-green-50 to-white' 
                      : 'border-gray-100 hover:border-gray-200'
                  }`}
                >
                  <div className="flex items-center justify-between">
                    <div className="flex items-center space-x-4">
                      <div className={`w-3 h-3 rounded-full transition-colors duration-300 ${
                        person.isHome ? 'bg-green-400' : 'bg-gray-300'
                      }`}></div>
                      <div className="flex flex-col">
                        <span className={`text-lg font-medium transition-colors duration-300 ${
                          person.isHome ? 'text-green-800' : 'text-gray-700'
                        }`}>
                          {person.name}
                        </span>
                        <span className="text-xs text-gray-500">
                          {calculateHomeHours(person.name)}h at home in this session
                        </span>
                      </div>
                    </div>
                    
                    <button
                      onClick={(e) => {
                        e.preventDefault();
                        e.stopPropagation();
                        togglePersonStatus(person.id);
                      }}
                      className={`relative inline-flex h-8 w-14 items-center rounded-full transition-colors duration-300 focus:outline-none focus:ring-2 focus:ring-green-300 focus:ring-offset-2 ${
                        person.isHome ? 'bg-green-400' : 'bg-gray-300'
                      }`}
                    >
                      <span
                        className={`inline-block h-6 w-6 transform rounded-full bg-white shadow-lg transition-all duration-300 ${
                          person.isHome ? 'translate-x-7' : 'translate-x-1'
                        }`}
                      />
                    </button>
                  </div>
                  
                  <div className="mt-2 ml-7">
                    <span className={`text-sm font-medium ${
                      person.isHome ? 'text-green-600' : 'text-gray-500'
                    }`}>
                      {person.isHome ? 'At home' : 'Away'}
                    </span>
                  </div>
                </div>
              ))}
          </div>

          <div className="mt-8 text-center">
            <p className="text-gray-400 text-sm">
              Tap the switches to update who's home
            </p>
          </div>
        </div>
      </div>
    );
  }

  if (currentView === 'edit') {
    return (
      <div className="min-h-screen bg-gradient-to-br p-6">
        <div className="max-w-md mx-auto">
          <div className="text-center mb-8">
            <div className="flex justify-between items-center mb-4">
              <button
                onClick={() => handleViewChange('home')}
                className="text-gray-500 hover:text-green-600 transition-colors"
              >
                ← Back
              </button>
              <h1 className="text-3xl font-light text-gray-800">Edit People</h1>
              <div></div>
            </div>
          </div>

          <div className="bg-white rounded-2xl p-5 shadow-sm border border-gray-100 mb-6">
            <h2 className="text-lg font-medium text-gray-800 mb-4">Add New Person</h2>
            <div className="flex space-x-3">
              <input
                type="text"
                value={newPersonName}
                onChange={(e) => {
                  setNewPersonName(e.target.value);
                  console.log('✏️ New person name input:', e.target.value);
                }}
                placeholder="Enter name..."
                className="flex-1 px-4 py-2 border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-green-300 focus:border-transparent"
                onKeyPress={(e) => {
                  if (e.key === 'Enter') {
                    console.log('⌨️ Enter key pressed, adding person');
                    addPerson();
                  }
                }}
              />
              <button
                onClick={addPerson}
                className="px-4 py-2 bg-green-400 text-white rounded-xl hover:bg-green-500 transition-colors flex items-center space-x-2"
              >
                <PlusCircle size={18} />
                <span>Add</span>
              </button>
            </div>
          </div>

          <div className="space-y-3">
            {people.map((person) => (
              <div
                key={person.id}
                className="bg-white rounded-2xl p-5 shadow-sm border border-gray-100 hover:border-gray-200 transition-all duration-300"
              >
                <div className="flex items-center justify-between">
                  <div className="flex items-center space-x-4">
                    <div className={`w-3 h-3 rounded-full ${
                      person.isHome ? 'bg-green-400' : 'bg-gray-300'
                    }`}></div>
                    <div className="flex flex-col">
                      <span className="text-lg font-medium text-gray-700">
                        {person.name}
                      </span>
                      <span className="text-xs text-gray-500">
                        {calculateHomeHours(person.name)}h tracked
                      </span>
                    </div>
                  </div>
                  
                  <button
                    onClick={(e) => {
                      e.preventDefault();
                      e.stopPropagation();
                      removePerson(person.id);
                    }}
                    className="p-2 text-gray-400 hover:text-red-500 transition-colors"
                  >
                    <Trash2 size={18} />
                  </button>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    );
  }

  // Analytics view
  const analyticsData = getAnalyticsData();
  
  return (
    <div className="min-h-screen bg-gradient-to-br p-6">
      <div className="max-w-md mx-auto">
        <div className="text-center mb-8">
          <div className="flex justify-between items-center mb-4">
            <button
              onClick={() => handleViewChange('home')}
              className="text-gray-500 hover:text-green-600 transition-colors"
            >
              ← Back
            </button>
            <h1 className="text-3xl font-light text-gray-800">Analytics</h1>
            <div></div>
          </div>
          <p className="text-gray-600">Who has been at home in the last 48 hours</p>
        </div>

        <div className="bg-white rounded-2xl p-6 shadow-sm border border-gray-100 mb-6">
          <div className="h-96">
            <ResponsiveContainer width="100%" height="100%">
              <RadarChart 
                data={analyticsData}
                onMouseEnter={() => console.log('📊 Radar chart interaction')}
              >
                <PolarGrid gridType="polygon" radialLines={true} />
                <PolarAngleAxis 
                  dataKey="person" 
                  tick={{ fontSize: 12, fill: '#6B7280' }}
                />
                <PolarRadiusAxis 
                  angle={90} 
                  domain={[0, 72]}
                  tick={{ fontSize: 10, fill: '#9CA3AF' }}
                  tickFormatter={(value) => `${value}h`}
                />
                <Radar
                  name="Hours at Home"
                  dataKey="hoursHome"
                  stroke="#10B981"
                  fill="#10B981"
                  fillOpacity={0.2}
                  strokeWidth={2}
                />
              </RadarChart>
            </ResponsiveContainer>
          </div>
        </div>

        <div className="grid grid-cols-2 gap-4">
          <div className="bg-white rounded-2xl p-5 shadow-sm border border-gray-100">
            <h3 className="text-sm font-medium text-gray-600 mb-2">Most at Home</h3>
            <p className="text-2xl font-light text-gray-800">
              {analyticsData.length > 0 ? analyticsData.reduce((max, person) => 
                person.hoursHome > max.hoursHome ? person : max
              ).person : 'N/A'}
            </p>
            <p className="text-sm text-gray-500">
              {analyticsData.length > 0 ? Math.max(...analyticsData.map(p => p.hoursHome)) : 0} hours
            </p>
          </div>
          <div className="bg-white rounded-2xl p-5 shadow-sm border border-gray-100">
            <h3 className="text-sm font-medium text-gray-600 mb-2">Average Time</h3>
            <p className="text-2xl font-light text-gray-800">
              {analyticsData.length > 0 ? Math.round(analyticsData.reduce((sum, p) => sum + p.hoursHome, 0) / analyticsData.length * 10) / 10 : 0}h
            </p>
            <p className="text-sm text-gray-500">per person</p>
          </div>
        </div>
      </div>
    </div>
  );
};

export default HomeTracker;
