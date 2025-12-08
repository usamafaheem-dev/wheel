import { useState } from 'react'
import './App.css'

function App() {
  const [names, setNames] = useState([
    'Ali', 'Beatriz', 'Charles', 'Diya', 'Eric', 'Fatima', 'Gabriel', 'Hanna'
  ])
  const [newName, setNewName] = useState('')
  const [showAdvanced, setShowAdvanced] = useState(false)

  const addName = () => {
    if (newName.trim() && !names.includes(newName.trim())) {
      setNames([...names, newName.trim()])
      setNewName('')
    }
  }

  const removeName = (nameToRemove) => {
    setNames(names.filter(name => name !== nameToRemove))
  }

  const shuffleNames = () => {
    const shuffled = [...names].sort(() => Math.random() - 0.5)
    setNames(shuffled)
  }

  const sortNames = () => {
    const sorted = [...names].sort()
    setNames(sorted)
  }

  const handleKeyPress = (e) => {
    if (e.key === 'Enter') {
      addName()
    }
  }

  const colors = ['#3B82F6', '#10B981', '#F59E0B', '#EF4444'] // blue, green, yellow, red

  return (
    <div className="app">
      {/* Header Navigation Bar */}
      <header className="header">
        <div className="header-right">
          <button className="header-btn" title="Customize">
            <span className="icon">⚙️</span>
            <span>Customize</span>
          </button>
          <button className="header-btn" title="New">
            <span className="icon">📄</span>
            <span>New</span>
          </button>
          <button className="header-btn" title="Open">
            <span className="icon">📁</span>
            <span>Open</span>
          </button>
          <button className="header-btn" title="Save">
            <span className="icon">💾</span>
            <span>Save</span>
          </button>
          <button className="header-btn" title="Share">
            <span className="icon">🔗</span>
            <span>Share</span>
          </button>
          <button className="header-btn" title="Gallery">
            <span className="icon">🔍</span>
            <span>Gallery</span>
          </button>
          <button className="header-btn" title="Fullscreen">
            <span className="icon">⛶</span>
          </button>
          <button className="header-btn dropdown" title="More">
            <span>More</span>
            <span className="icon">▼</span>
          </button>
          <button className="header-btn dropdown" title="Language">
            <span className="icon">🌐</span>
            <span>English</span>
            <span className="icon">▼</span>
          </button>
        </div>
      </header>

      {/* Main Content */}
      <div className="main-content">
        {/* Center - Wheel */}
        <div className="wheel-container">
          <div className="wheel-wrapper">
            <svg className="wheel" viewBox="0 0 700 700">
              <defs>
                <filter id="shadow">
                  <feDropShadow dx="0" dy="4" stdDeviation="8" floodOpacity="0.3"/>
                </filter>
              </defs>
              {names.map((name, index) => {
                const angle = (360 / names.length)
                const startAngle = (index * angle - 90) * (Math.PI / 180)
                const endAngle = ((index + 1) * angle - 90) * (Math.PI / 180)
                const largeArc = angle > 180 ? 1 : 0
                
                const x1 = 350 + 320 * Math.cos(startAngle)
                const y1 = 350 + 320 * Math.sin(startAngle)
                const x2 = 350 + 320 * Math.cos(endAngle)
                const y2 = 350 + 320 * Math.sin(endAngle)
                
                const midAngle = (startAngle + endAngle) / 2
                const textX = 350 + 170 * Math.cos(midAngle)
                const textY = 350 + 170 * Math.sin(midAngle)
                
                const path = `M 350 350 L ${x1} ${y1} A 320 320 0 ${largeArc} 1 ${x2} ${y2} Z`
                
                return (
                  <g key={index}>
                    <path
                      d={path}
                      fill={colors[index % colors.length]}
                      filter="url(#shadow)"
                    />
                    <text
                      x={textX}
                      y={textY}
                      fill="white"
                      fontSize="20"
                      fontWeight="bold"
                      textAnchor="middle"
                      dominantBaseline="middle"
                      transform={`rotate(${(index * angle + angle / 2)} ${textX} ${textY})`}
                    >
                      {name}
                    </text>
                  </g>
                )
              })}
              <circle cx="350" cy="350" r="35" fill="white" filter="url(#shadow)"/>
            </svg>
            <div className="wheel-pointer"></div>
            <div className="wheel-overlay">
              <div className="spin-text">Click to spin</div>
              <div className="spin-text-small">or press ctrl+enter</div>
            </div>
          </div>
        </div>

        {/* Right Sidebar - Entries */}
        <div className="right-sidebar">
          <div className="sidebar-header">
            <div className="tabs">
              <button className="tab active">Entries {names.length}</button>
              <button className="tab">Results 0</button>
            </div>
            <label className="hide-checkbox">
              <input type="checkbox" />
              <span>Hide</span>
            </label>
          </div>
          
          <div className="sidebar-actions">
            <button className="action-btn" onClick={shuffleNames} title="Shuffle">
              <span className="icon">🔀</span>
              <span>Shuffle</span>
            </button>
            <button className="action-btn" onClick={sortNames} title="Sort">
              <span className="icon">⇅</span>
              <span>Sort</span>
            </button>
            <button className="action-btn dropdown" title="Add image">
              <span>Add image</span>
              <span className="icon">▼</span>
            </button>
            <label className="advanced-checkbox">
              <input 
                type="checkbox" 
                checked={showAdvanced}
                onChange={(e) => setShowAdvanced(e.target.checked)}
              />
              <span>Advanced</span>
            </label>
          </div>

          <div className="entries-list">
            <div className="add-name-input">
              <input
                type="text"
                placeholder="Add name..."
                value={newName}
                onChange={(e) => setNewName(e.target.value)}
                onKeyPress={handleKeyPress}
              />
              <button onClick={addName}>+</button>
            </div>
            <div className="names-container">
              {names.map((name, index) => (
                <div key={index} className="name-item">
                  <span>{name}</span>
                  <button 
                    className="remove-btn"
                    onClick={() => removeName(name)}
                    title="Remove"
                  >
                    ×
                  </button>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}

export default App
