# 🎡 Spin Wheel Application

High-performance spinning wheel application with MongoDB backend.

## 📁 Project Structure

```
spin-wheel/
├── backend/              # Backend Server (Node.js + MongoDB)
│   ├── server.js        # Express server
│   ├── package.json    # Backend dependencies
│   └── .env           # MongoDB connection
│
└── frontend/            # Frontend (React + Vite)
    ├── src/            # React source code
    ├── public/         # Static assets
    ├── index.html      # HTML entry point
    ├── vite.config.js  # Vite configuration
    └── package.json   # Frontend dependencies
```

## 🚀 Quick Start

### Backend Setup

```bash
cd backend
npm install
# Create .env file with MongoDB connection
npm run dev
```

### Frontend Setup

```bash
cd frontend
npm install
npm run dev
```

## 🔧 Configuration

### Backend `.env` File

```env
MONGODB_URI=mongodb+srv://wheel:wheel@wheel.okagl6a.mongodb.net/?appName=wheel
PORT=3000
NODE_ENV=development
```

### Frontend `.env` File (Optional)

```env
VITE_API_URL=http://localhost:3000/api
```

## 📡 API Endpoints

- `GET /api/wheel/:wheelId` - Get wheel data
- `POST /api/wheel` - Save wheel data
- `PUT /api/wheel/:wheelId` - Update wheel data
- `DELETE /api/wheel/:wheelId` - Reset wheel

## ✅ Features

- ✅ MongoDB persistent storage
- ✅ Shared data across all users
- ✅ High-performance rendering
- ✅ Smooth animations
- ✅ Optimized for large datasets (3000+ entries)
