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
  homeHistory: {},
  nextId: 9,
  sessionStartTime: Date.now(),
  lastUpdated: new Date().toISOString()
};

// Load data from file
async function loadData() {
  try {
    const data = await fs.readFile(DATA_FILE, 'utf8');
    const parsedData = JSON.parse(data);
    console.log(`💾 Loaded data for ${parsedData.people.length} people`);
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
    
    // Broadcast updated data to all connected clients
    io.emit('dataUpdate', data);
    console.log('📡 Data broadcasted to all connected clients');
    
    return true;
  } catch (error) {
    console.error('❌ Error saving data:', error);
    return false;
  }
}

// Add history entry for a person
function addHistoryEntry(data, personName, isHome) {
  if (!data.homeHistory[personName]) {
    data.homeHistory[personName] = [];
  }
  
  const lastEntry = data.homeHistory[personName][data.homeHistory[personName].length - 1];
  
  // Only add entry if status changed
  if (!lastEntry || lastEntry.isHome !== isHome) {
    data.homeHistory[personName].push({
      timestamp: Date.now(),
      isHome: isHome
    });
    console.log(`📊 Added history entry for ${personName}: ${isHome ? 'HOME' : 'AWAY'}`);
  }
}

// WebSocket connection handling
io.on('connection', (socket) => {
  console.log('🔌 Client connected:', socket.id);
  
  // Send current data to newly connected client
  loadData().then(data => {
    socket.emit('dataUpdate', data);
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
    console.log('📤 Sent data to client');
    res.json(data);
  } catch (error) {
    console.error('❌ Error loading data:', error);
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
    
    // Add to history
    addHistoryEntry(data, person.name, person.isHome);
    
    await saveData(data);
    
    console.log(`🔄 Toggled ${person.name} from ${oldStatus ? 'HOME' : 'AWAY'} to ${person.isHome ? 'HOME' : 'AWAY'}`);
    
    res.json({ 
      success: true, 
      person: person,
      message: `${person.name} is now ${person.isHome ? 'home' : 'away'}`
    });
  } catch (error) {
    console.error('❌ Error toggling person status:', error);
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
    
    // Check if person already exists
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
    
    // Initialize history
    addHistoryEntry(data, newPerson.name, false);
    
    await saveData(data);
    
    console.log(`➕ Added new person: ${newPerson.name} (ID: ${newPerson.id})`);
    
    res.json({ 
      success: true, 
      person: newPerson,
      message: `${newPerson.name} added successfully`
    });
  } catch (error) {
    console.error('❌ Error adding person:', error);
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
    
    // Remove person from array
    data.people.splice(personIndex, 1);
    
    // Remove history
    delete data.homeHistory[person.name];
    
    await saveData(data);
    
    console.log(`➖ Removed person: ${person.name} (ID: ${personId})`);
    
    res.json({ 
      success: true, 
      message: `${person.name} removed successfully`
    });
  } catch (error) {
    console.error('❌ Error removing person:', error);
    res.status(500).json({ error: 'Failed to remove person' });
  }
});

// Get analytics data
app.get('/api/analytics', async (req, res) => {
  try {
    const data = await loadData();
    
    const analyticsData = data.people.map(person => {
      const history = data.homeHistory[person.name] || [];
      let totalHomeTime = 0;
      const now = Date.now();
      
      for (let i = 0; i < history.length; i++) {
        const entry = history[i];
        const nextEntry = history[i + 1];
        
        if (entry.isHome) {
          const endTime = nextEntry ? nextEntry.timestamp : now;
          const duration = Math.max(0, endTime - Math.max(entry.timestamp, data.sessionStartTime));
          totalHomeTime += duration;
        }
      }
      
      // Convert milliseconds to hours
      const hoursHome = Math.min(Math.round(totalHomeTime / (1000 * 60 * 60) * 10) / 10, 72);
      
      return {
        person: person.name,
        hoursHome: hoursHome,
        fullMark: 72
      };
    });
    
    console.log('📊 Generated analytics data');

    // Calculate average home time in hours
    const totalHours = analyticsData.reduce((sum, p) => sum + p.hoursHome, 0);
    const avgHours = analyticsData.length > 0 ? totalHours / analyticsData.length : 0;
    const avgMinutes = Math.round(avgHours * 60 * 10) / 10; // rounded to 1 decimal

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
    console.error('❌ Error generating analytics:', error);
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
