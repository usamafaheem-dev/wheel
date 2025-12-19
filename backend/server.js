import express from 'express'
import cors from 'cors'
import mongoose from 'mongoose'
import dotenv from 'dotenv'

dotenv.config()

const app = express()
const PORT = process.env.PORT || 3000

// Middleware
app.use(cors())
app.use(express.json())

// MongoDB Connection
const MONGODB_URI = process.env.MONGODB_URI

if (!MONGODB_URI) {
  console.error('❌ MONGODB_URI not found in .env file')
  process.exit(1)
}

mongoose.connect(MONGODB_URI)
  .then(() => console.log('✅ MongoDB Connected'))
  .catch(err => {
    console.error('❌ MongoDB Connection Error:', err.message)
    process.exit(1)
  })

// Wheel Schema
const wheelSchema = new mongoose.Schema({
  wheelId: {
    type: String,
    required: true,
    unique: true,
    index: true
  },
  entries: {
    type: [String],
    default: []
  },
  nameToTicketMap: {
    type: Map,
    of: String,
    default: {}
  },
  ticketToNameMap: {
    type: Map,
    of: String,
    default: {}
  },
  nameToIndexMap: {
    type: Map,
    of: Number,
    default: {}
  },
  ticketToIndexMap: {
    type: Map,
    of: Number,
    default: {}
  },
  settings: {
    type: Object,
    default: {}
  },
  createdAt: {
    type: Date,
    default: Date.now
  },
  updatedAt: {
    type: Date,
    default: Date.now
  }
})

const Wheel = mongoose.model('Wheel', wheelSchema)

// GET /api/wheel/:wheelId - Get wheel data
app.get('/api/wheel/:wheelId', async (req, res) => {
  try {
    const { wheelId } = req.params
    const wheel = await Wheel.findOne({ wheelId })
    
    if (!wheel) {
      return res.status(404).json({ error: 'Wheel not found' })
    }
    
    res.json({
      wheelId: wheel.wheelId,
      entries: wheel.entries,
      nameToTicketMap: Object.fromEntries(wheel.nameToTicketMap || new Map()),
      ticketToNameMap: Object.fromEntries(wheel.ticketToNameMap || new Map()),
      nameToIndexMap: Object.fromEntries(wheel.nameToIndexMap || new Map()),
      ticketToIndexMap: Object.fromEntries(wheel.ticketToIndexMap || new Map()),
      settings: wheel.settings,
      createdAt: wheel.createdAt,
      updatedAt: wheel.updatedAt
    })
  } catch (error) {
    console.error('Error:', error)
    res.status(500).json({ error: 'Server error' })
  }
})

// POST /api/wheel - Save wheel data
app.post('/api/wheel', async (req, res) => {
  try {
    const { wheelId, entries, nameToTicketMap, ticketToNameMap, nameToIndexMap, ticketToIndexMap, settings } = req.body
    
    if (!wheelId) {
      return res.status(400).json({ error: 'wheelId required' })
    }
    
    const wheelData = {
      wheelId,
      entries: entries || [],
      nameToTicketMap: nameToTicketMap ? new Map(Object.entries(nameToTicketMap)) : new Map(),
      ticketToNameMap: ticketToNameMap ? new Map(Object.entries(ticketToNameMap)) : new Map(),
      nameToIndexMap: nameToIndexMap ? new Map(Object.entries(nameToIndexMap)) : new Map(),
      ticketToIndexMap: ticketToIndexMap ? new Map(Object.entries(ticketToIndexMap)) : new Map(),
      settings: settings || {},
      updatedAt: new Date()
    }
    
    const wheel = await Wheel.findOneAndUpdate(
      { wheelId },
      wheelData,
      { upsert: true, new: true }
    )
    
    res.json({ success: true, wheelId: wheel.wheelId })
  } catch (error) {
    console.error('Error:', error)
    res.status(500).json({ error: 'Server error' })
  }
})

// PUT /api/wheel/:wheelId - Update wheel data
app.put('/api/wheel/:wheelId', async (req, res) => {
  try {
    const { wheelId } = req.params
    const { entries, nameToTicketMap, ticketToNameMap, nameToIndexMap, ticketToIndexMap, settings } = req.body
    
    const updateData = { updatedAt: new Date() }
    if (entries) updateData.entries = entries
    if (nameToTicketMap) updateData.nameToTicketMap = new Map(Object.entries(nameToTicketMap))
    if (ticketToNameMap) updateData.ticketToNameMap = new Map(Object.entries(ticketToNameMap))
    if (nameToIndexMap) updateData.nameToIndexMap = new Map(Object.entries(nameToIndexMap))
    if (ticketToIndexMap) updateData.ticketToIndexMap = new Map(Object.entries(ticketToIndexMap))
    if (settings) updateData.settings = settings
    
    const wheel = await Wheel.findOneAndUpdate(
      { wheelId },
      updateData,
      { new: true }
    )
    
    if (!wheel) {
      return res.status(404).json({ error: 'Wheel not found' })
    }
    
    res.json({ success: true, wheelId: wheel.wheelId })
  } catch (error) {
    console.error('Error:', error)
    res.status(500).json({ error: 'Server error' })
  }
})

// DELETE /api/wheel/:wheelId - Reset wheel
app.delete('/api/wheel/:wheelId', async (req, res) => {
  try {
    const { wheelId } = req.params
    await Wheel.findOneAndDelete({ wheelId })
    res.json({ success: true })
  } catch (error) {
    console.error('Error:', error)
    res.status(500).json({ error: 'Server error' })
  }
})

// Health check
app.get('/api/health', (req, res) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString() })
})

app.listen(PORT, () => {
  console.log(`🚀 Server running on port ${PORT}`)
  console.log(`📡 API: http://localhost:${PORT}/api`)
})

