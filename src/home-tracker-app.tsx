import React, { useState, useEffect, useRef } from 'react';
import { PlusCircle, Trash2, Edit3, BarChart3 } from 'lucide-react';
import { RadarChart, PolarGrid, PolarAngleAxis, PolarRadiusAxis, Radar, ResponsiveContainer } from 'recharts';
import { io, Socket } from 'socket.io-client';

interface Person {
  id: number;
  name: string;
  isHome: boolean;
}

interface HistoryEntry {
  timestamp: number;
  isHome: boolean;
}

interface ServerData {
  people: Person[];
  homeHistory: Record<string, HistoryEntry[]>;
  nextId: number;
  sessionStartTime: number;
  lastUpdated: string;
}

const HomeTracker: React.FC = () => {
  // Initialize logging
  useEffect(() => {
    console.log('🏠 Home Tracker App Starting...');
    console.log('📅 App started at:', new Date().toISOString());
    console.log('🌐 Environment:', process.env.NODE_ENV);
  }, []);

  const [currentView, setCurrentView] = useState<'home' | 'edit' | 'analytics'>('home');
  const [people, setPeople] = useState<Person[]>([]);
  const [newPersonName, setNewPersonName] = useState<string>('');
  const [homeHistory, setHomeHistory] = useState<Record<string, HistoryEntry[]>>({});
  const [sessionStartTime, setSessionStartTime] = useState<number>(Date.now());
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);
  const socketRef = useRef<Socket | null>(null);

  // API helper functions
  const apiCall = async (url: string, options: RequestInit = {}) => {
    try {
      const response = await fetch(url, {
        headers: {
          'Content-Type': 'application/json',
          ...options.headers,
        },
        ...options,
      });

      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }

      return await response.json();
    } catch (error) {
      console.error(`❌ API call failed for ${url}:`, error);
      throw error;
    }
  };

  // Load initial data from server
  const loadData = async () => {
    try {
      setLoading(true);
      setError(null);
      
      const data: ServerData = await apiCall('/api/data');
      
      setPeople(data.people);
      setHomeHistory(data.homeHistory);
      setSessionStartTime(data.sessionStartTime);
      
      console.log('📤 Loaded data from server:', data.people.length, 'people');
      console.log('🏁 Session start time:', new Date(data.sessionStartTime).toISOString());
    } catch (error) {
      console.error('❌ Failed to load data from server:', error);
      setError('Failed to load data from server');
    } finally {
      setLoading(false);
    }
  };

  // Setup WebSocket connection and load initial data
  useEffect(() => {
    // Initialize WebSocket connection
    socketRef.current = io();
    
    socketRef.current.on('connect', () => {
      console.log('🔌 Connected to WebSocket server');
      setError(null);
    });
    
    socketRef.current.on('dataUpdate', (serverData: ServerData) => {
      console.log('📡 Received real-time data update');
      setPeople(serverData.people);
      setHomeHistory(serverData.homeHistory);
      setSessionStartTime(serverData.sessionStartTime);
      setLoading(false);
    });
    
    socketRef.current.on('disconnect', () => {
      console.log('🔌 Disconnected from WebSocket server');
    });
    
    socketRef.current.on('connect_error', (error) => {
      console.error('❌ WebSocket connection error:', error);
      setError('Connection to server lost. Trying to reconnect...');
      // Fallback to REST API if WebSocket fails
      loadData();
    });
    
    // Cleanup on unmount
    return () => {
      if (socketRef.current) {
        socketRef.current.disconnect();
      }
    };
  }, []);

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
    return hours;
  };

  const togglePersonStatus = async (personId: number): Promise<void> => {
    const person = people.find(p => p.id === personId);
    if (!person) return;

    try {
      console.log(`🔄 Toggling ${person.name} from ${person.isHome ? 'HOME' : 'AWAY'} to ${!person.isHome ? 'HOME' : 'AWAY'}`);
      
      const result = await apiCall(`/api/people/${personId}/toggle`, {
        method: 'POST',
      });

      if (result.success) {
        console.log('✅', result.message);
        // No need to reload data - WebSocket will send real-time update
      }
    } catch (error) {
      console.error('❌ Failed to toggle person status:', error);
      setError('Failed to update person status');
    }
  };

  const addPerson = async (): Promise<void> => {
    if (!newPersonName.trim()) {
      console.warn('❌ Cannot add person with empty name');
      return;
    }

    try {
      console.log(`➕ Adding new person: ${newPersonName.trim()}`);
      
      const result = await apiCall('/api/people', {
        method: 'POST',
        body: JSON.stringify({ name: newPersonName.trim() }),
      });

      if (result.success) {
        setNewPersonName('');
        console.log('✅', result.message);
        // No need to reload data - WebSocket will send real-time update
      }
    } catch (error) {
      console.error('❌ Failed to add person:', error);
      setError('Failed to add person');
    }
  };

  const removePerson = async (personId: number): Promise<void> => {
    const person = people.find(p => p.id === personId);
    if (!person) return;

    try {
      console.log(`➖ Removing person: ${person.name} (ID: ${personId})`);
      
      const result = await apiCall(`/api/people/${personId}`, {
        method: 'DELETE',
      });

      if (result.success) {
        console.log('✅', result.message);
        // No need to reload data - WebSocket will send real-time update
      }
    } catch (error) {
      console.error('❌ Failed to remove person:', error);
      setError('Failed to remove person');
    }
  };

  const homeCount = people.filter(person => person.isHome).length;

  // Generate analytics data based on actual tracking
  const getAnalyticsData = () => {
    return people.map(person => ({
      person: person.name,
      hoursHome: calculateHomeHours(person.name),
      fullMark: 72
    }));
  };

  // Log view changes
  const handleViewChange = (newView: 'home' | 'edit' | 'analytics') => {
    console.log(`📱 View changed from ${currentView} to ${newView}`);
    setCurrentView(newView);
  };

  // Show loading state
  if (loading) {
    return (
      <div className="min-h-screen bg-gradient-to-br p-6 flex items-center justify-center">
        <div className="max-w-md mx-auto text-center">
          <div className="bg-white rounded-2xl p-8 shadow-sm border border-gray-100">
            <h1 className="text-2xl font-light text-gray-800 mb-4">Loading Home Tracker...</h1>
            <div className="animate-pulse bg-gray-200 h-4 rounded mb-4"></div>
            <div className="animate-pulse bg-gray-200 h-4 rounded w-3/4 mx-auto"></div>
          </div>
        </div>
      </div>
    );
  }

  // Show error state
  if (error) {
    return (
      <div className="min-h-screen bg-gradient-to-br p-6 flex items-center justify-center">
        <div className="max-w-md mx-auto text-center">
          <div className="bg-white rounded-2xl p-8 shadow-sm border border-red-200">
            <h1 className="text-2xl font-light text-red-800 mb-4">Error</h1>
            <p className="text-red-600 mb-4">{error}</p>
            <button
              onClick={loadData}
              className="px-4 py-2 bg-red-500 text-white rounded-xl hover:bg-red-600 transition-colors"
            >
              Retry
            </button>
          </div>
        </div>
      </div>
    );
  }

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
              Tap the switches to update who's home • Real-time sync across all devices
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
