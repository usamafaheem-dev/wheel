import { useState, useEffect, useRef, useCallback } from 'react'
import { FiSettings, FiFile, FiFolder, FiSave, FiShare2, FiSearch, FiMaximize, FiChevronDown, FiGlobe, FiShuffle, FiArrowUp, FiArrowDown } from 'react-icons/fi'
import './App.css'

function App() {
  const [names, setNames] = useState([
    'Ali', 'Beatriz', 'Charles', 'Diya', 'Eric', 'Fatima', 'Gabriel', 'Hanna'
  ])
  const [newName, setNewName] = useState('')
  const [showAdvanced, setShowAdvanced] = useState(false)
  const [rotation, setRotation] = useState(0)
  const [isSpinning, setIsSpinning] = useState(false)
  const wheelRef = useRef(null)

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

  const spinWheel = useCallback(() => {
    if (isSpinning || names.length === 0) return
    
    setIsSpinning(true)
    
    // Calculate random rotation (multiple full spins + random angle)
    const spins = 5 + Math.random() * 5 // 5-10 full spins
    setRotation(prevRotation => {
      const randomAngle = Math.random() * 360
      const totalRotation = prevRotation + spins * 360 + randomAngle
      
      // Calculate which slice the pointer lands on
      // Pointer is at 0 degrees (right side), so we need to account for that
      const normalizedAngle = (360 - (totalRotation % 360)) % 360
      const sliceAngle = 360 / names.length
      const selectedIndex = Math.floor(normalizedAngle / sliceAngle)
      
      // Reset spinning state after animation completes
      setTimeout(() => {
        setIsSpinning(false)
        // You can add logic here to show the selected name
        console.log('Selected:', names[selectedIndex])
      }, 4000) // Match CSS transition duration
      
      return totalRotation
    })
  }, [isSpinning, names])

  const handleWheelClick = () => {
    spinWheel()
  }

  useEffect(() => {
    const handleKeyDown = (e) => {
      if ((e.ctrlKey || e.metaKey) && e.key === 'Enter') {
        e.preventDefault()
        spinWheel()
      }
    }

    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [spinWheel])

  const colors = ['rgb(59, 130, 246)', 'rgb(16, 185, 129)', 'rgb(245, 158, 11)', 'rgb(239, 68, 68)'] // blue, green, yellow, red

  return (
    <div className="app">
      {/* Header Navigation Bar */}
      <header className="header">
        <div className="header-right">
          <button className="header-btn" title="Customize">
            <FiSettings className="icon" />
            <span>Customize</span>
          </button>
          <button className="header-btn" title="New">
            <FiFile className="icon" />
            <span>New</span>
          </button>
          <button className="header-btn" title="Open">
            <FiFolder className="icon" />
            <span>Open</span>
          </button>
          <button className="header-btn" title="Save">
            <FiSave className="icon" />
            <span>Save</span>
          </button>
          <button className="header-btn" title="Share">
            <FiShare2 className="icon" />
            <span>Share</span>
          </button>
          <button className="header-btn" title="Gallery">
            <FiSearch className="icon" />
            <span>Gallery</span>
          </button>
          <button className="header-btn" title="Fullscreen">
            <FiMaximize className="icon" />
          </button>
          <button className="header-btn dropdown" title="More">
            <span>More</span>
            <FiChevronDown className="icon" />
          </button>
          <button className="header-btn dropdown" title="Language">
            <FiGlobe className="icon" />
            <span>English</span>
            <FiChevronDown className="icon" />
          </button>
        </div>
      </header>

      {/* Main Content */}
      <div className="main-content">
        {/* Center - Wheel */}
        <div className="wheel-container">
          <div className="wheel-wrapper" onClick={handleWheelClick} style={{ cursor: isSpinning ? 'not-allowed' : 'pointer' }}>
            <svg 
              className="wheel" 
              viewBox="0 0 750 750"
              ref={wheelRef}
              style={{ transform: `rotate(${rotation}deg)` }}
            >
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
                
                const x1 = 375 + 340 * Math.cos(startAngle)
                const y1 = 375 + 340 * Math.sin(startAngle)
                const x2 = 375 + 340 * Math.cos(endAngle)
                const y2 = 375 + 340 * Math.sin(endAngle)
                
                const path = `M 375 375 L ${x1} ${y1} A 340 340 0 ${largeArc} 1 ${x2} ${y2} Z`
                
                // Calculate middle angle for text positioning
                const midAngle = (startAngle + endAngle) / 2
                
                // Position text along the radial direction (from inner to outer)
                // Text should be horizontal along the slice length
                const innerRadius = 120
                const outerRadius = 280
                const textRadius = (innerRadius + outerRadius) / 2
                
                // Calculate text position at middle radius of slice
                const textX = 375 + textRadius * Math.cos(midAngle)
                const textY = 375 + textRadius * Math.sin(midAngle)
                
                // Rotate text to align with the slice direction (radial, from center outward)
                // Text should be horizontal along the slice length
                const textRotationDeg = (midAngle * 180 / Math.PI)
                
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
                      fontSize="18"
                      fontWeight="bold"
                      textAnchor="middle"
                      dominantBaseline="middle"
                      transform={`rotate(${textRotationDeg} ${textX} ${textY})`}
                      style={{ 
                        whiteSpace: 'nowrap',
                        letterSpacing: '0.5px'
                      }}
                    >
                      {name}
                    </text>
                  </g>
                )
              })}
              <circle cx="375" cy="375" r="38" fill="white" filter="url(#shadow)"/>
            </svg>
            <div className="wheel-pointer"></div>
            <div className="wheel-overlay" onClick={(e) => e.stopPropagation()}>
              <div className="spin-text">{isSpinning ? 'Spinning...' : 'Click to spin'}</div>
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
              <FiShuffle className="icon" />
              <span>Shuffle</span>
            </button>
            <button className="action-btn" onClick={sortNames} title="Sort">
              <span className="icon" style={{ display: 'flex', flexDirection: 'column', lineHeight: '0.5' }}>
                <FiArrowUp style={{ fontSize: '10px' }} />
                <FiArrowDown style={{ fontSize: '10px' }} />
              </span>
              <span>Sort</span>
            </button>
            <button className="action-btn dropdown" title="Add image">
              <span>Add image</span>
              <FiChevronDown className="icon" />
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
