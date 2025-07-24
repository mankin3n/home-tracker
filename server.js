const express = require('express');
const path = require('path');
const fs = require('fs').promises;
const { createServer } = require('http');
const { Server } = require('socket.io');

const app = express();
const server = createServer(app);
const io = new Server(server, {
  cors: {
    origin: "*",
    methods: ["GET", "POST"]
  }
});

const port = process.env.PORT || 8080;
const DATA_FILE = path.join(__dirname, 'data', 'home-tracker-data.json');

// Middleware
app.use(express.json());
app.use(express.static(path.join(__dirname, 'build')));

// Ensure data directory exists
async function ensureDataDirectory() {
  try {
    await fs.mkdir(path.dirname(DATA_FILE), { recursive: true });
    console.log('📁 Data directory ensured');
  } catch (error) {
    console.error('❌ Error creating data directory:', error);
  }
}

// Default data structure
const defaultStats = {
  lastHome: null,
  hoursHome72h: 0,
  hoursHomeCurrent: 0,
  lastToggle: null,
  lastStatus: false,
  homeSessionStart: null
};
const defaultData = {
  people: [
    { id: 1, name: 'Julia', isHome: false },
    { id: 2, name: 'Jossu', isHome: false },
    { id: 3, name: 'Papu', isHome: false },
    { id: 4, name: 'Cosmo', isHome: false },
    { id: 5, name: 'Pepi', isHome: false },
    { id: 6, name: 'Pauli', isHome: false },
    { id: 7, name: 'Tomi', isHome: false },
    { id: 8, name: 'Yoshi', isHome: false }
  ],
  homeStats: {
    Julia: { ...defaultStats },
    Jossu: { ...defaultStats },
    Papu: { ...defaultStats },
    Cosmo: { ...defaultStats },
    Pepi: { ...defaultStats },
    Pauli: { ...defaultStats },
    Tomi: { ...defaultStats },
    Yoshi: { ...defaultStats }
  },
  nextId: 9,
  sessionStartTime: Date.now(),
  lastUpdated: new Date().toISOString()
};

// Helper to update homeStats for a person
function updateHomeStats(data, personName, isHome) {
  if (!data.homeStats[personName]) {
    data.homeStats[personName] = {
      lastHome: null,
      hoursHome72h: 0,
      hoursHomeCurrent: 0,
      lastToggle: null,
      lastStatus: false,
      homeSessionStart: null
    };
  }
  const stats = data.homeStats[personName];
  const now = Date.now();
  // If toggling to home
  if (isHome && !stats.lastStatus) {
    stats.lastHome = now;
    stats.lastToggle = now;
    stats.lastStatus = true;
    // Start a new home session
    stats.homeSessionStart = now;
  }
  // If toggling to away
  if (!isHome && stats.lastStatus) {
    // Add duration to hoursHomeCurrent and hoursHome72h
    const sessionStart = stats.homeSessionStart || now;
    const duration = now - sessionStart;
    stats.hoursHomeCurrent = 0;
    stats.lastStatus = false;
    stats.lastToggle = now;
    // Add to 72h window
    stats.hoursHome72h = (stats.hoursHome72h || 0) + duration;
    // Clean up sessions older than 72h (not tracked here, but could be with a session log)
    // For now, just cap at 72h
    const max72h = 72 * 60 * 60 * 1000;
    if (stats.hoursHome72h > max72h) stats.hoursHome72h = max72h;
  }
  // If still home, update hoursHomeCurrent
  if (isHome) {
    const sessionStart = stats.homeSessionStart || now;
    stats.hoursHomeCurrent = now - sessionStart;
  }
}

// Patch homeStats to ensure all fields are present for every person
function patchHomeStats(data) {
  const defaultStats = {
    lastHome: null,
    hoursHome72h: 0,
    hoursHomeCurrent: 0,
    lastToggle: null,
    lastStatus: false,
    homeSessionStart: null
  };
  data.people.forEach(person => {
    if (!data.homeStats[person.name]) {
      data.homeStats[person.name] = { ...defaultStats };
    } else {
      data.homeStats[person.name] = { ...defaultStats, ...data.homeStats[person.name] };
    }
  });
}

// Load data from file
async function loadData() {
  try {
    const data = await fs.readFile(DATA_FILE, 'utf8');
    const parsedData = JSON.parse(data);
    
    // Ensure homeStats object exists
    if (!parsedData.homeStats) {
      parsedData.homeStats = {};
    }
    
    patchHomeStats(parsedData);
    console.log(`💾 Loaded data for ${parsedData.people.length} people`);
    console.log(`📊 Patched stats for ${Object.keys(parsedData.homeStats).length} people`);
    return parsedData;
  } catch (error) {
    console.log('📝 No existing data file found, using defaults');
    await saveData(defaultData);
    return defaultData;
  }
}

// Save data to file and broadcast to all clients
async function saveData(data) {
  try {
    data.lastUpdated = new Date().toISOString();
    await fs.writeFile(DATA_FILE, JSON.stringify(data, null, 2));
    console.log('💾 Data saved successfully');
    
    // Attach stats to each person before broadcasting
    const defaultStats = {
      lastHome: null,
      hoursHome72h: 0,
      hoursHomeCurrent: 0
    };
    const peopleWithStats = data.people.map(person => {
      const personStats = data.homeStats && data.homeStats[person.name] ? data.homeStats[person.name] : {};
      return {
        ...person,
        stats: { ...defaultStats, ...personStats }
      };
    });
    
    const dataWithStats = {
      ...data,
      people: peopleWithStats
    };
    
    // Broadcast updated data to all connected clients
    io.emit('dataUpdate', dataWithStats);
    console.log('📡 Data broadcasted to all connected clients');
    
    return true;
  } catch (error) {
    console.error('❌ Error saving data:', error);
    return false;
  }
}

// WebSocket connection handling
io.on('connection', (socket) => {
  console.log('🔌 Client connected:', socket.id);
  
  // Send current data to newly connected client
  loadData().then(data => {
    // Attach stats to each person before sending
    const defaultStats = {
      lastHome: null,
      hoursHome72h: 0,
      hoursHomeCurrent: 0
    };
    const peopleWithStats = data.people.map(person => {
      const personStats = data.homeStats && data.homeStats[person.name] ? data.homeStats[person.name] : {};
      return {
        ...person,
        stats: { ...defaultStats, ...personStats }
      };
    });
    
    const dataWithStats = {
      ...data,
      people: peopleWithStats
    };
    
    socket.emit('dataUpdate', dataWithStats);
    console.log('📤 Sent initial data to client:', socket.id);
  }).catch(error => {
    console.error('❌ Error sending initial data to client:', error);
  });
  
  socket.on('disconnect', () => {
    console.log('🔌 Client disconnected:', socket.id);
  });
});

// API Routes

// Health check endpoint
app.get('/health', (req, res) => {
  res.status(200).json({ 
    status: 'healthy', 
    timestamp: new Date().toISOString(),
    port: port 
  });
});

// Get all data
app.get('/api/data', async (req, res) => {
  try {
    const data = await loadData();
    // Attach stats to each person, always providing all fields
    const defaultStats = {
      lastHome: null,
      hoursHome72h: 0,
      hoursHomeCurrent: 0
    };
    const peopleWithStats = data.people.map(person => {
      const personStats = data.homeStats && data.homeStats[person.name] ? data.homeStats[person.name] : {};
      return {
        ...person,
        stats: { ...defaultStats, ...personStats }
      };
    });
    res.json({
      ...data,
      people: peopleWithStats
    });
  } catch (error) {
    res.status(500).json({ error: 'Failed to load data' });
  }
});

// Update person status
app.post('/api/people/:id/toggle', async (req, res) => {
  try {
    const personId = parseInt(req.params.id);
    const data = await loadData();
    const person = data.people.find(p => p.id === personId);
    if (!person) {
      return res.status(404).json({ error: 'Person not found' });
    }
    const oldStatus = person.isHome;
    person.isHome = !person.isHome;
    // Update homeStats
    updateHomeStats(data, person.name, person.isHome);
    await saveData(data);
    res.json({ 
      success: true, 
      person: person,
      stats: data.homeStats[person.name],
      message: `${person.name} is now ${person.isHome ? 'home' : 'away'}`
    });
  } catch (error) {
    res.status(500).json({ error: 'Failed to update person status' });
  }
});

// Add new person
app.post('/api/people', async (req, res) => {
  try {
    const { name } = req.body;
    if (!name || !name.trim()) {
      return res.status(400).json({ error: 'Name is required' });
    }
    const data = await loadData();
    const existingPerson = data.people.find(p => p.name.toLowerCase() === name.trim().toLowerCase());
    if (existingPerson) {
      return res.status(409).json({ error: 'Person already exists' });
    }
    const newPerson = {
      id: data.nextId,
      name: name.trim(),
      isHome: false
    };
    data.people.push(newPerson);
    data.nextId += 1;
    // Initialize stats
    data.homeStats[newPerson.name] = { ...defaultStats };
    updateHomeStats(data, newPerson.name, false);
    await saveData(data);
    res.json({ 
      success: true, 
      person: newPerson,
      stats: data.homeStats[newPerson.name],
      message: `${newPerson.name} added successfully`
    });
  } catch (error) {
    res.status(500).json({ error: 'Failed to add person' });
  }
});

// Remove person
app.delete('/api/people/:id', async (req, res) => {
  try {
    const personId = parseInt(req.params.id);
    const data = await loadData();
    const personIndex = data.people.findIndex(p => p.id === personId);
    if (personIndex === -1) {
      return res.status(404).json({ error: 'Person not found' });
    }
    const person = data.people[personIndex];
    data.people.splice(personIndex, 1);
    // Remove stats
    delete data.homeStats[person.name];
    await saveData(data);
    res.json({ 
      success: true, 
      message: `${person.name} removed successfully`
    });
  } catch (error) {
    res.status(500).json({ error: 'Failed to remove person' });
  }
});

// Get analytics data
app.get('/api/analytics', async (req, res) => {
  try {
    const data = await loadData();
    const analyticsData = data.people.map(person => {
      const stats = (data.homeStats && data.homeStats[person.name]) ? data.homeStats[person.name] : {};
      // Convert ms to hours for analytics
      const hoursHome72h = stats.hoursHome72h ? Math.round(stats.hoursHome72h / (1000 * 60 * 60) * 10) / 10 : 0;
      return {
        person: person.name,
        hoursHome72h,
        lastHome: stats.lastHome || null,
        hoursHomeCurrent: stats.hoursHomeCurrent ? Math.round(stats.hoursHomeCurrent / (1000 * 60 * 60) * 10) / 10 : 0,
        fullMark: 72
      };
    });
    // Average for 72h
    const totalHours = analyticsData.reduce((sum, p) => sum + p.hoursHome72h, 0);
    const avgHours = analyticsData.length > 0 ? totalHours / analyticsData.length : 0;
    const avgMinutes = Math.round(avgHours * 60 * 10) / 10;
    res.json({
      success: true,
      analytics: analyticsData,
      sessionStartTime: data.sessionStartTime,
      lastUpdated: data.lastUpdated,
      averageHomeTime: {
        hours: Math.round(avgHours * 10) / 10,
        minutes: avgMinutes
      }
    });
  } catch (error) {
    res.status(500).json({ error: 'Failed to generate analytics' });
  }
});

// Reset all data (for testing)
app.post('/api/reset', async (req, res) => {
  try {
    const newData = {
      ...defaultData,
      sessionStartTime: Date.now()
    };
    
    await saveData(newData);
    
    console.log('🔄 Data reset to defaults');
    
    res.json({ 
      success: true, 
      message: 'Data reset successfully',
      data: newData
    });
  } catch (error) {
    console.error('❌ Error resetting data:', error);
    res.status(500).json({ error: 'Failed to reset data' });
  }
});

// Serve the React app for all other routes
app.get('*', (req, res) => {
  res.sendFile(path.join(__dirname, 'build', 'index.html'));
});

// Error handling middleware
app.use((error, req, res, next) => {
  console.error('💥 Server error:', error);
  res.status(500).json({ error: 'Internal server error' });
});

// Initialize and start server
async function startServer() {
  await ensureDataDirectory();
  
  server.listen(port, '0.0.0.0', () => {
    console.log(`🏠 Home Tracker server is running on port ${port}`);
    console.log(`📅 Started at: ${new Date().toISOString()}`);
    console.log(`🌐 Environment: ${process.env.NODE_ENV || 'production'}`);
    console.log(`💾 Data file: ${DATA_FILE}`);
    console.log(`🔌 WebSocket server ready for real-time updates`);
  });
}

startServer().catch(console.error);
