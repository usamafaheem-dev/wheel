import { useState, useEffect, useRef, useCallback } from 'react'
import confetti from 'canvas-confetti'
import { FiSettings, FiFile, FiFolder, FiSave, FiShare2, FiSearch, FiMaximize, FiChevronDown, FiGlobe, FiShuffle, FiArrowUp, FiArrowDown, FiPlay, FiSquare, FiHelpCircle, FiImage, FiDroplet } from 'react-icons/fi'
import './App.css'
import CanvasWheel from './components/CanvasWheel'

function App() {
  const [names, setNames] = useState([
    'Ali', 'Beatriz', 'Charles', 'Diya', 'Eric', 'Fatima', 'Gabriel', 'Hanna'
  ])
  const [results, setResults] = useState([])
  const [activeTab, setActiveTab] = useState('entries')
  const [namesText, setNamesText] = useState('Ali\nBeatriz\nCharles\nDiya\nEric\nFatima\nGabriel\nHanna')
  const [showAdvanced, setShowAdvanced] = useState(false)
  const [finalRotation, setFinalRotation] = useState(0) // Single rotation value - the only source of truth
  const [isSpinning, setIsSpinning] = useState(false)
  const [isSidebarHidden, setIsSidebarHidden] = useState(false)
  const [showWinner, setShowWinner] = useState(false)
  const [winner, setWinner] = useState(null)
  const [showCustomize, setShowCustomize] = useState(false)
  const [customizeTab, setCustomizeTab] = useState('during-spin')
  const [isFullscreen, setIsFullscreen] = useState(false)
  const [settings, setSettings] = useState({
    sound: 'Ticking sound',
    volume: 50,
    displayDuplicates: true,
    spinSlowly: false,
    showTitle: true,
    spinTime: 3,
    maxNamesVisible: 1000,
    afterSpinSound: 'Subdued applause',
    afterSpinVolume: 50,
    animateWinningEntry: false,
    launchConfetti: true,
    autoRemoveWinner: false,
    displayPopup: true,
    popupMessage: 'We have a winner!',
    displayRemoveButton: true,
    playClickSoundOnRemove: false,
    oneColorPerSection: true,
    wheelBackgroundImage: false,
    selectedTheme: '',
    colorPalettes: [true, true, true, true, true, false, false, false],
    centerImage: '',
    imageSize: 'S',
    pageBackgroundColor: false,
    displayColorGradient: true,
    contours: false,
    wheelShadow: true,
    pointerChangesColor: true
  })
  const wheelRef = useRef(null)
  const winnerProcessedRef = useRef(false)
  const animationFrameRef = useRef(null)
  const animationCompletedRef = useRef(false) // Track if animation is completed
  const isFrozenRef = useRef(false) // Track if wheel is frozen

  // Audio Context for zero-latency synthetic sounds
  const audioContextRef = useRef(null)

  // Initialize Audio Context on user interaction
  useEffect(() => {
    const initAudio = () => {
      if (!audioContextRef.current) {
        audioContextRef.current = new (window.AudioContext || window.webkitAudioContext)()
      }
    }
    window.addEventListener('click', initAudio)
    window.addEventListener('keydown', initAudio)
    return () => {
      window.removeEventListener('click', initAudio)
      window.removeEventListener('keydown', initAudio)
      if (audioContextRef.current) audioContextRef.current.close()
    }
  }, [])

  // 1. Synthetic "Click" Sound (Zero Latency)
  // Short, sharp white noise burst + sine wave for a physical "click" sound
  const playClickSound = useCallback(() => {
    const ctx = audioContextRef.current
    if (!ctx) return
    if (ctx.state === 'suspended') ctx.resume()

    const t = ctx.currentTime

    // Filtered Noise for "Texture"
    const bufferSize = ctx.sampleRate * 0.01 // 10ms
    const buffer = ctx.createBuffer(1, bufferSize, ctx.sampleRate)
    const data = buffer.getChannelData(0)
    for (let i = 0; i < bufferSize; i++) {
      data[i] = Math.random() * 2 - 1
    }
    const noise = ctx.createBufferSource()
    noise.buffer = buffer
    const noiseGain = ctx.createGain()
    noiseGain.gain.setValueAtTime(0.5, t)
    noiseGain.gain.exponentialRampToValueAtTime(0.01, t + 0.01)
    noise.connect(noiseGain)
    noiseGain.connect(ctx.destination)
    noise.start(t)

    // High Sine Beep for "Impact"
    const osc = ctx.createOscillator()
    const gain = ctx.createGain()
    osc.frequency.setValueAtTime(800, t)
    osc.frequency.exponentialRampToValueAtTime(0.01, t + 0.05)
    gain.gain.setValueAtTime(0.3, t)
    gain.gain.exponentialRampToValueAtTime(0.01, t + 0.05)

    osc.connect(gain)
    gain.connect(ctx.destination)
    osc.start(t)
    osc.stop(t + 0.05)
  }, [])

  // 2. Synthetic "Fanfare" Sound (Win)
  const playFanfare = useCallback(() => {
    const ctx = audioContextRef.current
    if (!ctx) return
    if (ctx.state === 'suspended') ctx.resume()

    const t = ctx.currentTime
    // Simple major chord arpeggio
    const freqs = [523.25, 659.25, 783.99, 1046.50] // C Major

    freqs.forEach((f, i) => {
      const osc = ctx.createOscillator()
      const gain = ctx.createGain()
      osc.type = 'triangle'
      osc.frequency.value = f

      // Staggered entrance
      const start = t + i * 0.1
      const dur = 0.8

      gain.gain.setValueAtTime(0, start)
      gain.gain.linearRampToValueAtTime(0.2, start + 0.05)
      gain.gain.exponentialRampToValueAtTime(0.001, start + dur)

      osc.connect(gain)
      gain.connect(ctx.destination)
      osc.start(start)
      osc.stop(start + dur)
    })
  }, [])

  // Continuous slow rotation - only when not spinning and not frozen
  useEffect(() => {
    // Cancel any existing slow rotation animation
    if (animationFrameRef.current && !isSpinning) {
      // Don't cancel if spinning animation is active
      return
    }

    // Stop slow rotation when spinning, when winner is found, when pop-up is shown, or when frozen
    if (isSpinning || winner || showWinner || isFrozenRef.current) {
      return
    }

    let lastTime = performance.now()
    const slowRotationFrameRef = { current: null }

    const animateSlow = (currentTime) => {
      // Check if we should stop (conditions may have changed)
      if (isSpinning || winner || showWinner || isFrozenRef.current) {
        slowRotationFrameRef.current = null
        return
      }

      const delta = currentTime - lastTime
      lastTime = currentTime

      // Update finalRotation smoothly (1.5 degrees per 50ms = 30 degrees per second)
      setFinalRotation(prev => (prev + (1.5 * delta / 50)) % 360)

      slowRotationFrameRef.current = requestAnimationFrame(animateSlow)
    }

    slowRotationFrameRef.current = requestAnimationFrame(animateSlow)
    return () => {
      if (slowRotationFrameRef.current) {
        cancelAnimationFrame(slowRotationFrameRef.current)
        slowRotationFrameRef.current = null
      }
    }
  }, [isSpinning, winner, showWinner])

  // Update names array in real-time as user types in textarea
  const handleNamesTextChange = (e) => {
    const text = e.target.value
    setNamesText(text)

    // Parse textarea content into names array (split by newlines, filter empty lines)
    const lines = text.split('\n').map(line => line.trim()).filter(line => line.length > 0)
    setNames(lines)
  }

  const removeName = (nameToRemove) => {
    // Remove the name from textarea
    const lines = namesText.split('\n').filter(line => line.trim() !== nameToRemove)
    const newText = lines.join('\n')
    setNamesText(newText)
    setNames(lines.filter(line => line.trim().length > 0))
  }

  const shuffleNames = () => {
    const shuffled = [...names].sort(() => Math.random() - 0.5)
    setNames(shuffled)
    // Update textarea to match shuffled names
    setNamesText(shuffled.join('\n'))
  }

  const sortNames = () => {
    const sorted = [...names].sort((a, b) => {
      return a.localeCompare(b, undefined, { sensitivity: 'base' })
    })
    setNames(sorted)
    // Update textarea to match sorted names
    setNamesText(sorted.join('\n'))
  }

  const spinWheel = useCallback(() => {
    if (isSpinning || names.length === 0) return

    // Cancel any existing animation
    if (animationFrameRef.current) {
      cancelAnimationFrame(animationFrameRef.current)
      animationFrameRef.current = null
    }

    // Clear frozen state when starting new spin
    isFrozenRef.current = false
    animationCompletedRef.current = false
    winnerProcessedRef.current = false

    setIsSpinning(true)

    // Get current rotation - this is the ONLY rotation value
    const startRotation = finalRotation
    let lastTickRotation = startRotation // Track last rotation for sound sync

    // Duration: 6000ms as requested for "increase some more time"
    const duration = 6000

    // Calculate total rotation: 5-8 full rotations (1800-2880 degrees)
    const minRotations = 5
    const maxRotations = 8
    const spins = minRotations + Math.random() * (maxRotations - minRotations)
    const totalRotationDegrees = spins * 360

    // Add random angle for unpredictability (0-360 degrees)
    const randomAngle = Math.random() * 360

    // Final rotation = start + total rotation + random angle
    const endRotation = startRotation + totalRotationDegrees + randomAngle

    const startTime = performance.now()

    // Easing function: Ease-In-Out Cubic
    // "Motor start" effect: Accelerate (slowly start), fast spin, then decelerate (slow stop)
    const ease = (t) => {
      // t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2
      // This creates a symmetrical S-curve: 
      // First 50% of time: Accelerate from 0 to Max Speed
      // Last 50% of time: Decelerate from Max Speed to 0
      // Actually, for a spin wheel, we want a SHORT acceleration and LONG deceleration.
      // But standard easeInOut is typically symmetric. 
      // Let's use standard symmetric easeInOutCubic for the requested "Slow start -> Fast -> Slow stop"
      return t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2
    }

    const animate = () => {
      // Prevent any further execution if already completed
      if (animationCompletedRef.current) {
        if (animationFrameRef.current) {
          cancelAnimationFrame(animationFrameRef.current)
          animationFrameRef.current = null
        }
        return
      }

      const elapsed = performance.now() - startTime
      const progress = Math.min(elapsed / duration, 1)

      if (progress < 1) {
        // Check again if completed
        if (animationCompletedRef.current) {
          return
        }
        // Apply easing for smooth acceleration and deceleration
        const easedProgress = ease(progress)
        const current = startRotation + (endRotation - startRotation) * easedProgress
        // Robust sync: Play every 25 degrees
        // Use playClickSound directly for instant response
        if (Math.abs(current - lastTickRotation) >= 25) {
          playClickSound()
          lastTickRotation = current
        }

        // Update ONLY finalRotation - the single source of truth
        setFinalRotation(current)
        animationFrameRef.current = requestAnimationFrame(animate)
      } else {
        // Animation complete - stop IMMEDIATELY at exact target
        animationCompletedRef.current = true

        // Cancel animation frame immediately
        if (animationFrameRef.current) {
          cancelAnimationFrame(animationFrameRef.current)
          animationFrameRef.current = null
        }

        // Set to EXACT endRotation - freeze immediately
        setFinalRotation(endRotation)
        isFrozenRef.current = true

        // Only process winner once
        if (!winnerProcessedRef.current) {
          winnerProcessedRef.current = true

          // Calculate winner using the EXACT final rotation value
          const frozenRot = endRotation
          const sliceAngle = 360 / names.length

          // The pointer is fixed at 0° (right side, pointing to the right)
          // After the wheel rotates clockwise by R degrees, find which slice is at the pointer

          // Normalize rotation to 0-360 range
          const R = ((frozenRot % 360) + 360) % 360

          // The pointer is at 0° (right side)
          // After rotating clockwise by R degrees, what's at the pointer (0°) 
          // was originally at (-R) degrees in the wheel's coordinate system
          // Convert to 0-360 range: (360 - R) % 360
          const pointerAngleInOriginal = (360 - R) % 360

          // Find which slice contains this angle
          // Slices start at -90° (top), so slice i covers:
          // from (i * sliceAngle - 90) to ((i+1) * sliceAngle - 90)
          let selectedIndex = 0
          let found = false

          for (let i = 0; i < names.length; i++) {
            // Calculate slice boundaries in original coordinates (0-360 range)
            const sliceStart = (i * sliceAngle - 90 + 360) % 360
            const sliceEnd = ((i + 1) * sliceAngle - 90 + 360) % 360

            // Check if pointer angle is within this slice
            let inSlice = false

            if (sliceStart < sliceEnd) {
              // Normal case: slice doesn't wrap around 0°
              inSlice = pointerAngleInOriginal >= sliceStart && pointerAngleInOriginal < sliceEnd
            } else {
              // Wrap-around case: slice crosses 0° boundary (e.g., 315° to 45°)
              inSlice = pointerAngleInOriginal >= sliceStart || pointerAngleInOriginal < sliceEnd
            }

            if (inSlice) {
              selectedIndex = i
              found = true
              break
            }
          }

          // Fallback: if no slice found (shouldn't happen), find closest slice center
          if (!found) {
            let minDist = Infinity
            for (let i = 0; i < names.length; i++) {
              const sliceCenter = (i * sliceAngle - 90 + sliceAngle / 2 + 360) % 360
              let dist = Math.abs(pointerAngleInOriginal - sliceCenter)
              if (dist > 180) dist = 360 - dist
              if (dist < minDist) {
                minDist = dist
                selectedIndex = i
              }
            }
          }

          // Ensure valid index
          selectedIndex = selectedIndex % names.length
          if (selectedIndex < 0) {
            selectedIndex = (selectedIndex + names.length) % names.length
          }

          const winnerName = names[selectedIndex]
          const winnerColor = colors[selectedIndex % colors.length]

          // Set winner and stop spinning
          setWinner({ name: winnerName, color: winnerColor, index: selectedIndex })
          setIsSpinning(false)

          // Reset ref after processing
          winnerProcessedRef.current = false

          // Grand Finale Confetti (3 bursts!)
          const defaults = { startVelocity: 30, spread: 360, ticks: 60, zIndex: 2000 }

          const randomInRange = (min, max) => Math.random() * (max - min) + min

          // Burst 1: Center
          confetti({ ...defaults, particleCount: 100, origin: { y: 0.6 } })

          // Burst 2: Left (delayed)
          setTimeout(() => confetti({ ...defaults, particleCount: 50, angle: 60, origin: { x: 0, y: 0.7 } }), 200)

          // Burst 3: Right (delayed)
          setTimeout(() => confetti({ ...defaults, particleCount: 50, angle: 120, origin: { x: 1, y: 0.7 } }), 400)

          playFanfare()

          // Wait 1 second after wheel stops, then show pop-up
          // Wheel remains frozen during this time and until pop-up is closed
          setTimeout(() => {
            setShowWinner(true)
          }, 1000)
        }
      }
    }

    // Start animation immediately
    animationFrameRef.current = requestAnimationFrame(animate)
  }, [isSpinning, names, finalRotation, settings.spinTime])

  const handleWheelClick = () => {
    if (!showWinner) {
      spinWheel()
    }
  }

  const handleCloseWinner = () => {
    setShowWinner(false)
    // Unfreeze wheel - slow rotation can resume
    isFrozenRef.current = false
    setWinner(null)
  }

  const handleRemoveWinner = () => {
    if (winner) {
      // Remove winner's name from textarea (live text bar) and names array
      const lines = namesText.split('\n').filter(line => line.trim() !== winner.name)
      setNamesText(lines.join('\n'))
      setNames(names.filter(name => name !== winner.name))

      setShowWinner(false)
      // Unfreeze wheel - slow rotation can resume
      isFrozenRef.current = false
      setWinner(null)
    }
  }

  const clearResults = () => {
    setResults([])
  }

  const sortResults = () => {
    const sorted = [...results].sort((a, b) => {
      return a.localeCompare(b, undefined, { sensitivity: 'base' })
    })
    setResults(sorted)
  }

  const handleNew = () => {
    // Reset everything
    setNames(['Ali', 'Beatriz', 'Charles', 'Diya', 'Eric', 'Fatima', 'Gabriel', 'Hanna'])
    setNamesText('Ali\nBeatriz\nCharles\nDiya\nEric\nFatima\nGabriel\nHanna')
    setResults([])
    setActiveTab('entries')
    setFinalRotation(0)
    setIsSpinning(false)
    setShowWinner(false)
    setWinner(null)
    setIsSidebarHidden(false)
    winnerProcessedRef.current = false
    isFrozenRef.current = false
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

  const colors = ['#efb71d', '#24a643', '#4d7ceb', '#d82135'] // yellow, green, blue, red

  // Helper to determine text color based on background
  const getTextColor = (bgColor) => {
    // Yellow (#efb71d) and Green (#24a643) get black text
    if (bgColor === '#efb71d' || bgColor === '#24a643') return 'black'
    return 'white'
  }

  // Calculate current color under pointer
  const getCurrentPointerColor = () => {
    if (names.length === 0) return '#ffd700' // Default Gold

    const sliceAngle = 360 / names.length
    // Normalize rotation
    const R = ((finalRotation % 360) + 360) % 360
    // Pointer is at 0 (Right). Angle at pointer in wheel context:
    const pointerAngle = (360 - R) % 360

    // Shift by 90 degrees because slice 0 starts at -90 (Top)
    // So relative to slice 0, the pointer is at pointerAngle + 90
    const adjustedAngle = (pointerAngle + 90) % 360

    // Find index
    const index = Math.floor(adjustedAngle / sliceAngle)
    const safeIndex = index % names.length
    return colors[safeIndex % colors.length]
  }

  const pointerColor = getCurrentPointerColor()


  // Fullscreen mode - only show wheel
  if (isFullscreen) {
    return (
      <div className="app fullscreen-mode">
        <div className="fullscreen-wheel-container">
          <button className="fullscreen-minimize-btn" onClick={() => setIsFullscreen(false)} title="Exit fullscreen">
            <FiMaximize className="icon" />
          </button>
          <div className="wheel-container-fullscreen">
            <div className="wheel-wrapper" onClick={handleWheelClick} style={{ cursor: (isSpinning || showWinner) ? 'not-allowed' : 'pointer' }}>
              <div style={{ width: '100%', height: '100%' }}>
                <CanvasWheel
                  names={names}
                  colors={colors}
                  rotation={finalRotation}
                  width={750}
                  height={750}
                />
              </div>
              {/* Fixed arc text overlay - doesn't rotate */}
              {!isSpinning && !showWinner && !winner && (
                <svg
                  className="wheel-text-overlay"
                  viewBox="0 0 750 750"
                  style={{
                    position: 'absolute',
                    top: 0,
                    left: 0,
                    width: '100%',
                    height: '100%',
                    pointerEvents: 'none',
                    zIndex: 5
                  }}
                >
                  <defs>
                    {/* Arc path for "Click to spin" - at the top of center circle */}
                    <path id="arcPath1-fullscreen" d="M 295 295 A 80 80 0 0 1 455 295" fill="none" />
                    {/* Arc path for "or press ctrl+enter" - U-shape: start/end at top, center at bottom */}
                    <path id="arcPath2-fullscreen" d="M 280 470 Q 375 590 470 470" fill="none" />
                  </defs>
                  {/* "Click to spin" text at the top */}
                  <text
                    fill="white"
                    fontSize="42"
                    fontWeight="bold"
                    textAnchor="middle"
                    dominantBaseline="middle"
                    style={{
                      textShadow: '2px 2px 4px rgba(0, 0, 0, 0.8)',
                      pointerEvents: 'none'
                    }}
                  >
                    <textPath href="#arcPath1-fullscreen" startOffset="50%">
                      Click to spin
                    </textPath>
                  </text>
                  {/* "or press ctrl+enter" text at the bottom */}
                  <text
                    fill="white"
                    fontSize="28"
                    textAnchor="middle"
                    dominantBaseline="middle"
                    style={{
                      textShadow: '2px 2px 4px rgba(0, 0, 0, 0.8)',
                      pointerEvents: 'none'
                    }}
                  >
                    <textPath href="#arcPath2-fullscreen" startOffset="50%">
                      or press ctrl+enter
                    </textPath>
                  </text>
                </svg>
              )}
              {/* Golden 3D Pointer for Fullscreen */}
              <svg
                className="wheel-pointer"
                viewBox="0 0 100 100"
                xmlns="http://www.w3.org/2000/svg"
                style={{
                  position: 'absolute',
                  right: 'calc(8% - 54px)', /* Dynamic calculation to touch wheel edge exactly */
                  top: '50%',
                  transform: 'translateY(-50%)',
                  width: '60px',
                  height: '60px',
                  zIndex: 20,
                  filter: 'drop-shadow(0 4px 6px rgba(0,0,0,0.5))',
                  pointerEvents: 'none'
                }}
              >
                <defs>
                  <linearGradient id="dynamicGradientFS" x1="0%" y1="0%" x2="100%" y2="100%">
                    <stop offset="0%" stopColor={pointerColor} style={{ filter: 'brightness(1.5)' }} />
                    <stop offset="50%" stopColor={pointerColor} />
                    <stop offset="100%" stopColor={pointerColor} style={{ filter: 'brightness(0.7)' }} />
                  </linearGradient>
                </defs>
                <path
                  d="M 10 50 L 90 20 L 90 80 Z"
                  fill="url(#dynamicGradientFS)"
                  stroke={pointerColor}
                  strokeWidth="2"
                  filter="url(#bevel)"
                />
                <path
                  d="M 15 50 L 85 24 L 85 76 Z"
                  fill="none"
                  stroke="rgba(255,255,255,0.4)"
                  strokeWidth="2"
                />
              </svg>
            </div>
          </div>
        </div>
      </div>
    )
  }

  return (
    <div className="app">
      {/* Header Navigation Bar */}
      <header className="header">
        <div className="header-right">
          <button className="header-btn" title="Customize" onClick={() => setShowCustomize(true)}>
            <FiSettings className="icon" />
            <span>Customize</span>
          </button>
          <button className="header-btn" title="New" onClick={handleNew}>
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
          <button className="header-btn" title="Fullscreen" onClick={() => setIsFullscreen(true)}>
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
          <div className="wheel-wrapper" onClick={handleWheelClick} style={{ cursor: (isSpinning || showWinner) ? 'not-allowed' : 'pointer' }}>
            <div style={{ width: '100%', height: '100%' }}>
              <CanvasWheel
                names={names}
                colors={colors}
                rotation={finalRotation}
                width={750}
                height={750}
              />
            </div>

            {/* Fixed arc text overlay - doesn't rotate */}
            {!isSpinning && !showWinner && !winner && (
              <svg
                className="wheel-text-overlay"
                viewBox="0 0 750 750"
                style={{
                  position: 'absolute',
                  top: 0,
                  left: 0,
                  width: '100%',
                  height: '100%',
                  pointerEvents: 'none',
                  zIndex: 5
                }}
              >
                <defs>
                  {/* Arc path for "Click to spin" - at the top of center circle */}
                  <path id="arcPath1" d="M 295 295 A 80 80 0 0 1 455 295" fill="none" />
                  {/* Arc path for "or press ctrl+enter" - U-shape: start/end at top, center at bottom */}
                  <path id="arcPath2" d="M 280 470 Q 375 590 470 470" fill="none" />
                </defs>
                {/* "Click to spin" text at the top */}
                <text
                  fill="white"
                  fontSize="42"
                  fontWeight="bold"
                  textAnchor="middle"
                  dominantBaseline="middle"
                  style={{
                    textShadow: '2px 2px 4px rgba(0, 0, 0, 0.8)',
                    pointerEvents: 'none'
                  }}
                >
                  <textPath href="#arcPath1" startOffset="50%">
                    Click to spin
                  </textPath>
                </text>
                {/* "or press ctrl+enter" text at the bottom */}
                <text
                  fill="white"
                  fontSize="28"
                  textAnchor="middle"
                  dominantBaseline="middle"
                  style={{
                    textShadow: '2px 2px 4px rgba(0, 0, 0, 0.8)',
                    pointerEvents: 'none'
                  }}
                >
                  <textPath href="#arcPath2" startOffset="50%">
                    or press ctrl+enter
                  </textPath>
                </text>
              </svg>
            )}
            {/* Golden 3D Pointer */}
            <svg
              className="wheel-pointer"
              viewBox="0 0 100 100"
              xmlns="http://www.w3.org/2000/svg"
              style={{
                position: 'absolute',
                right: 'calc(8% - 54px)', /* Dynamic calculation to touch wheel edge exactly */
                top: '50%',
                transform: 'translateY(-50%)',
                width: '60px', /* Increased size for visibility */
                height: '60px',
                zIndex: 20, /* Ensure it's on top */
                filter: 'drop-shadow(0 4px 6px rgba(0,0,0,0.5))', /* 3D shadow effect */
                pointerEvents: 'none' /* Passthrough clicks */
              }}
            >
              <defs>
                <linearGradient id="dynamicGradient" x1="0%" y1="0%" x2="100%" y2="100%">
                  <stop offset="0%" stopColor={pointerColor} style={{ filter: 'brightness(1.5)' }} />
                  <stop offset="50%" stopColor={pointerColor} />
                  <stop offset="100%" stopColor={pointerColor} style={{ filter: 'brightness(0.7)' }} />
                </linearGradient>
                <filter id="bevel" x="-50%" y="-50%" width="200%" height="200%">
                  <feGaussianBlur in="SourceAlpha" stdDeviation="2" result="blur" />
                  <feOffset in="blur" dx="2" dy="2" result="offsetBlur" />
                  <feSpecularLighting in="blur" surfaceScale="5" specularConstant=".75" specularExponent="20" lightingColor="#bbbbbb" result="specOut">
                    <fePointLight x="-5000" y="-10000" z="20000" />
                  </feSpecularLighting>
                  <feComposite in="specOut" in2="SourceAlpha" operator="in" result="specOut" />
                  <feComposite in="SourceGraphic" in2="specOut" operator="arithmetic" k1="0" k2="1" k3="1" k4="0" result="litPaint" />
                  <feMerge>
                    <feMergeNode in="offsetBlur" />
                    <feMergeNode in="litPaint" />
                  </feMerge>
                </filter>
              </defs>
              {/* Main Arrow Body */}
              <path
                d="M 10 50 L 90 20 L 90 80 Z"
                fill="url(#dynamicGradient)"
                stroke={pointerColor}
                strokeWidth="2"
                filter="url(#bevel)"
              />
              {/* Highlight for extra 3D pop */}
              <path
                d="M 15 50 L 85 24 L 85 76 Z"
                fill="none"
                stroke="rgba(255,255,255,0.4)"
                strokeWidth="2"
              />
            </svg>
          </div>
        </div >

        {/* Right Sidebar - Entries */}
        < div className={`right-sidebar ${isSidebarHidden ? 'sidebar-hidden' : ''}`
        }>
          {
            isSidebarHidden ? (
              <div className="sidebar-header-hidden" >
                <label className="hide-checkbox">
                  <input
                    type="checkbox"
                    checked={isSidebarHidden}
                    onChange={(e) => setIsSidebarHidden(e.target.checked)}
                  />
                  <span>Hide</span>
                </label>
              </div>
            ) : (
              <>
                <div className="sidebar-header">
                  <div className="tabs">
                    <button
                      className={`tab ${activeTab === 'entries' ? 'active' : ''}`}
                      onClick={() => setActiveTab('entries')}
                    >
                      Entries {names.length}
                    </button>
                    <button
                      className={`tab ${activeTab === 'results' ? 'active' : ''}`}
                      onClick={() => setActiveTab('results')}
                    >
                      Results {results.length}
                    </button>
                  </div>
                  <label className="hide-checkbox">
                    <input
                      type="checkbox"
                      checked={isSidebarHidden}
                      onChange={(e) => setIsSidebarHidden(e.target.checked)}
                    />
                    <span>Hide</span>
                  </label>
                </div>

                {activeTab === 'entries' ? (
                  <>
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
                        <textarea
                          placeholder="Type names here, press Enter for new line..."
                          value={namesText}
                          onChange={handleNamesTextChange}
                          style={{
                            width: '100%',
                            height: '100%',
                            backgroundColor: '#1a1a1a',
                            border: '1px solid rgb(255, 255, 255)',
                            color: 'white',
                            padding: '8px 12px',
                            borderRadius: '6px',
                            fontSize: '14px',
                            fontFamily: 'inherit',
                            resize: 'none',
                            boxSizing: 'border-box'
                          }}
                        />
                      </div>
                    </div>
                  </>
                ) : (
                  <>
                    <div className="sidebar-actions">
                      <button className="action-btn" onClick={sortResults} title="Sort">
                        <FiArrowUp className="icon" />
                        <span>Sort</span>
                      </button>
                      <button className="action-btn" onClick={clearResults} title="Clear the list">
                        <span className="icon">×</span>
                        <span>Clear the list</span>
                      </button>
                    </div>

                    <div className="entries-list">
                      <div className="names-container">
                        {results.length === 0 ? (
                          <div style={{ color: '#888', textAlign: 'center', padding: '20px' }}>
                            No results yet
                          </div>
                        ) : (
                          results.map((name, index) => (
                            <div key={index} className="name-item">
                              <span>{name}</span>
                            </div>
                          ))
                        )}
                      </div>
                    </div>
                  </>
                )}
              </>
            )}
        </div >
      </div >

      {/* Winner Pop-up */}
      {
        showWinner && winner && (
          <div className="winner-overlay" onClick={handleCloseWinner}>
            <div className="winner-popup" onClick={(e) => e.stopPropagation()}>
              <div className="winner-header" style={{ backgroundColor: winner.color }}>
                <h2>We have a winner!</h2>
                <button className="winner-close-btn" onClick={handleCloseWinner}>×</button>
              </div>
              <div className="winner-content">
                <div className="winner-name">{winner.name}</div>
                <div className="winner-buttons">
                  <button className="winner-btn close-btn" onClick={handleCloseWinner}>Close</button>
                  <button className="winner-btn remove-btn" onClick={handleRemoveWinner}>Remove</button>
                </div>
              </div>
            </div>
          </div>
        )
      }

      {/* Customize Pop-up */}
      {
        showCustomize && (
          <div className="customize-overlay" onClick={() => setShowCustomize(false)}>
            <div className="customize-popup" onClick={(e) => e.stopPropagation()}>
              <div className="customize-tabs">
                <button
                  className={`customize-tab ${customizeTab === 'during-spin' ? 'active' : ''}`}
                  onClick={() => setCustomizeTab('during-spin')}
                >
                  During spin
                </button>
                <button
                  className={`customize-tab ${customizeTab === 'after-spin' ? 'active' : ''}`}
                  onClick={() => setCustomizeTab('after-spin')}
                >
                  After spin
                </button>
                <button
                  className={`customize-tab ${customizeTab === 'appearance' ? 'active' : ''}`}
                  onClick={() => setCustomizeTab('appearance')}
                >
                  Appearance
                </button>
              </div>

              <div className="customize-content">
                {customizeTab === 'during-spin' && (
                  <div className="customize-section">
                    <div className="customize-field">
                      <label className="customize-label">Sound</label>
                      <div className="customize-sound-controls">
                        <select
                          className="customize-select"
                          value={settings.sound}
                          onChange={(e) => setSettings({ ...settings, sound: e.target.value })}
                        >
                          <option>Ticking sound</option>
                        </select>
                        <button className="customize-icon-btn" title="Play">
                          <FiPlay />
                        </button>
                        <button className="customize-icon-btn" title="Stop">
                          <FiSquare />
                        </button>
                      </div>
                    </div>

                    <div className="customize-field">
                      <label className="customize-label">Volume</label>
                      <div className="customize-slider-container" style={{ '--slider-progress': `${settings.volume}%` }}>
                        <input
                          type="range"
                          min="0"
                          max="100"
                          value={settings.volume}
                          onChange={(e) => setSettings({ ...settings, volume: parseInt(e.target.value) })}
                          className="customize-slider"
                          style={{ '--slider-progress': `${settings.volume}%` }}
                        />
                        <div className="customize-slider-labels">
                          <span>0%</span>
                          <span>25%</span>
                          <span>50%</span>
                          <span>75%</span>
                          <span>100%</span>
                        </div>
                      </div>
                    </div>

                    <div className="customize-checkboxes">
                      <label className="customize-checkbox-label">
                        <input
                          type="checkbox"
                          checked={settings.displayDuplicates}
                          onChange={(e) => setSettings({ ...settings, displayDuplicates: e.target.checked })}
                        />
                        <span>Display duplicates</span>
                        <FiHelpCircle className="customize-help-icon" />
                      </label>
                      <label className="customize-checkbox-label">
                        <input
                          type="checkbox"
                          checked={settings.spinSlowly}
                          onChange={(e) => setSettings({ ...settings, spinSlowly: e.target.checked })}
                        />
                        <span>Spin slowly</span>
                      </label>
                      <label className="customize-checkbox-label">
                        <input
                          type="checkbox"
                          checked={settings.showTitle}
                          onChange={(e) => setSettings({ ...settings, showTitle: e.target.checked })}
                        />
                        <span>Show title</span>
                      </label>
                    </div>

                    <div className="customize-field">
                      <label className="customize-label">Spin time (seconds)</label>
                      <div className="customize-slider-container" style={{ '--slider-progress': `${((settings.spinTime - 1) / 59) * 100}%` }}>
                        <input
                          type="range"
                          min="1"
                          max="60"
                          value={settings.spinTime}
                          onChange={(e) => setSettings({ ...settings, spinTime: parseInt(e.target.value) })}
                          className="customize-slider"
                          style={{ '--slider-progress': `${((settings.spinTime - 1) / 59) * 100}%` }}
                        />
                        <div className="customize-slider-labels">
                          <span>1</span>
                          <span>10</span>
                          <span>20</span>
                          <span>30</span>
                          <span>40</span>
                          <span>50</span>
                          <span>60</span>
                        </div>
                      </div>
                    </div>

                    <div className="customize-field">
                      <label className="customize-label-bold">Max number of names visible on the wheel</label>
                      <p className="customize-description">All names in the text-box have the same chance of winning, regardless of this value.</p>
                      <div className="customize-slider-container" style={{ '--slider-progress': `${((settings.maxNamesVisible - 4) / 996) * 100}%` }}>
                        <input
                          type="range"
                          min="4"
                          max="1000"
                          value={settings.maxNamesVisible}
                          onChange={(e) => setSettings({ ...settings, maxNamesVisible: parseInt(e.target.value) })}
                          className="customize-slider"
                          style={{ '--slider-progress': `${((settings.maxNamesVisible - 4) / 996) * 100}%` }}
                        />
                        <div className="customize-slider-labels">
                          <span>4</span>
                          <span>100</span>
                          <span>200</span>
                          <span>300</span>
                          <span>400</span>
                          <span>500</span>
                          <span>600</span>
                          <span>700</span>
                          <span>800</span>
                          <span>900</span>
                          <span>1000</span>
                        </div>
                      </div>
                    </div>
                  </div>
                )}

                {customizeTab === 'after-spin' && (
                  <div className="customize-section">
                    <div className="customize-field">
                      <label className="customize-label">Sound</label>
                      <div className="customize-sound-controls">
                        <select
                          className="customize-select"
                          value={settings.afterSpinSound}
                          onChange={(e) => setSettings({ ...settings, afterSpinSound: e.target.value })}
                        >
                          <option>Subdued applause</option>
                        </select>
                        <button className="customize-icon-btn" title="Play">
                          <FiPlay />
                        </button>
                        <button className="customize-icon-btn" title="Stop">
                          <FiSquare />
                        </button>
                      </div>
                    </div>

                    <div className="customize-field">
                      <label className="customize-label">Volume</label>
                      <div className="customize-slider-container" style={{ '--slider-progress': `${settings.afterSpinVolume}%` }}>
                        <input
                          type="range"
                          min="0"
                          max="100"
                          value={settings.afterSpinVolume}
                          onChange={(e) => setSettings({ ...settings, afterSpinVolume: parseInt(e.target.value) })}
                          className="customize-slider"
                          style={{ '--slider-progress': `${settings.afterSpinVolume}%` }}
                        />
                        <div className="customize-slider-labels">
                          <span>0%</span>
                          <span>25%</span>
                          <span>50%</span>
                          <span>75%</span>
                          <span>100%</span>
                        </div>
                      </div>
                    </div>

                    <div className="customize-checkboxes">
                      <label className="customize-checkbox-label">
                        <input
                          type="checkbox"
                          checked={settings.animateWinningEntry}
                          onChange={(e) => setSettings({ ...settings, animateWinningEntry: e.target.checked })}
                        />
                        <span>Animate winning entry</span>
                      </label>
                      <label className="customize-checkbox-label">
                        <input
                          type="checkbox"
                          checked={settings.launchConfetti}
                          onChange={(e) => setSettings({ ...settings, launchConfetti: e.target.checked })}
                        />
                        <span>Launch confetti</span>
                      </label>
                      <label className="customize-checkbox-label">
                        <input
                          type="checkbox"
                          checked={settings.autoRemoveWinner}
                          onChange={(e) => setSettings({ ...settings, autoRemoveWinner: e.target.checked })}
                        />
                        <span>Auto-remove winner after 5 seconds</span>
                      </label>
                    </div>

                    <div className="customize-field">
                      <label className="customize-checkbox-label">
                        <input
                          type="checkbox"
                          checked={settings.displayPopup}
                          onChange={(e) => setSettings({ ...settings, displayPopup: e.target.checked })}
                        />
                        <span>Display popup with message:</span>
                      </label>
                      <input
                        type="text"
                        className="customize-text-input"
                        value={settings.popupMessage}
                        onChange={(e) => setSettings({ ...settings, popupMessage: e.target.value })}
                        disabled={!settings.displayPopup}
                      />
                      <div className="customize-indented-checkbox">
                        <label className="customize-checkbox-label">
                          <input
                            type="checkbox"
                            checked={settings.displayRemoveButton}
                            onChange={(e) => setSettings({ ...settings, displayRemoveButton: e.target.checked })}
                            disabled={!settings.displayPopup}
                          />
                          <span>Display the "Remove" button</span>
                        </label>
                      </div>
                    </div>

                    <div className="customize-field">
                      <label className="customize-checkbox-label">
                        <input
                          type="checkbox"
                          checked={settings.playClickSoundOnRemove}
                          onChange={(e) => setSettings({ ...settings, playClickSoundOnRemove: e.target.checked })}
                        />
                        <span>Play a click sound when the winner is removed</span>
                      </label>
                    </div>
                  </div>
                )}

                {customizeTab === 'appearance' && (
                  <div className="customize-section">
                    <div className="customize-field">
                      <div className="customize-toggle-container">
                        <div className={`customize-toggle-option ${!settings.wheelBackgroundImage ? 'active' : ''}`}>
                          <div className="customize-option-icon customize-wheel-icon">
                            <div className="wheel-icon-slice" style={{ backgroundColor: 'rgb(255, 64, 64)' }}></div>
                            <div className="wheel-icon-slice" style={{ backgroundColor: 'rgb(0, 177, 0)' }}></div>
                            <div className="wheel-icon-slice" style={{ backgroundColor: 'rgb(0, 195, 255)' }}></div>
                            <div className="wheel-icon-slice" style={{ backgroundColor: 'rgb(255, 217, 0)' }}></div>
                            <div className="wheel-icon-slice" style={{ backgroundColor: 'rgb(0, 195, 255)' }}></div>
                            <div className="wheel-icon-slice" style={{ backgroundColor: 'rgb(255, 165, 0)' }}></div>
                          </div>
                          <span className="customize-option-text">One color per section</span>
                        </div>
                        <label className="customize-toggle">
                          <input
                            type="checkbox"
                            checked={settings.wheelBackgroundImage}
                            onChange={(e) => setSettings({ ...settings, wheelBackgroundImage: e.target.checked })}
                          />
                          <span className="customize-toggle-slider"></span>
                        </label>
                        <div className={`customize-toggle-option ${settings.wheelBackgroundImage ? 'active' : ''}`}>
                          <div className="customize-option-icon">
                            <div className="cookie-icon">🍪</div>
                          </div>
                          <span className="customize-option-text">Wheel background image</span>
                        </div>
                      </div>
                    </div>

                    {settings.wheelBackgroundImage && (
                      <div className="customize-field">
                        <label className="customize-label">Wheel background image</label>
                        <button className="customize-image-btn">
                          <div className="cookie-icon">🍪</div>
                          <span>Wheel background image</span>
                          <FiChevronDown />
                        </button>
                      </div>
                    )}

                    <div className="customize-field">
                      <button className="customize-theme-btn">
                        <span>Apply a theme</span>
                        <FiChevronDown />
                      </button>
                    </div>

                    <div className="customize-field">
                      <div className="customize-colors-header">
                        <label className="customize-label-bold">Customize colors</label>
                        <FiHelpCircle className="customize-help-icon" />
                      </div>
                      <div className="customize-color-palettes">
                        {[0, 1, 2, 3, 4, 5, 6, 7].map((index) => (
                          <div key={index} className="customize-color-palette-item">
                            <div className="customize-color-palette-icon">
                              <FiDroplet />
                            </div>
                            <label className="customize-checkbox-label">
                              <input
                                type="checkbox"
                                checked={settings.colorPalettes[index]}
                                onChange={(e) => {
                                  const newPalettes = [...settings.colorPalettes]
                                  newPalettes[index] = e.target.checked
                                  setSettings({ ...settings, colorPalettes: newPalettes })
                                }}
                              />
                            </label>
                          </div>
                        ))}
                      </div>
                    </div>

                    <div className="customize-field">
                      <button className="customize-image-btn">
                        <FiImage />
                        <span>Image at the center of the wheel</span>
                        <FiChevronDown />
                      </button>
                    </div>

                    <div className="customize-field">
                      <label className="customize-label">Image size</label>
                      <select
                        className="customize-select"
                        value={settings.imageSize}
                        onChange={(e) => setSettings({ ...settings, imageSize: e.target.value })}
                      >
                        <option>S</option>
                        <option>M</option>
                        <option>L</option>
                      </select>
                    </div>

                    <div className="customize-checkboxes-grid">
                      <label className="customize-checkbox-label">
                        <FiDroplet className="customize-checkbox-icon" />
                        <input
                          type="checkbox"
                          checked={settings.pageBackgroundColor}
                          onChange={(e) => setSettings({ ...settings, pageBackgroundColor: e.target.checked })}
                        />
                        <span>Page background color</span>
                      </label>
                      <label className="customize-checkbox-label">
                        <input
                          type="checkbox"
                          checked={settings.contours}
                          onChange={(e) => setSettings({ ...settings, contours: e.target.checked })}
                        />
                        <span>Contours</span>
                      </label>
                      <label className="customize-checkbox-label">
                        <input
                          type="checkbox"
                          checked={settings.displayColorGradient}
                          onChange={(e) => setSettings({ ...settings, displayColorGradient: e.target.checked })}
                        />
                        <span>Display a color gradient on the page</span>
                      </label>
                      <label className="customize-checkbox-label">
                        <input
                          type="checkbox"
                          checked={settings.wheelShadow}
                          onChange={(e) => setSettings({ ...settings, wheelShadow: e.target.checked })}
                        />
                        <span>Wheel shadow</span>
                      </label>
                      <label className="customize-checkbox-label">
                        <input
                          type="checkbox"
                          checked={settings.pointerChangesColor}
                          onChange={(e) => setSettings({ ...settings, pointerChangesColor: e.target.checked })}
                        />
                        <span>Pointer changes color</span>
                      </label>
                    </div>
                  </div>
                )}
              </div>

              <div className="customize-buttons">
                <button className="customize-btn cancel-btn" onClick={() => setShowCustomize(false)}>
                  Cancel
                </button>
                <button className="customize-btn ok-btn" onClick={() => setShowCustomize(false)}>
                  OK
                </button>
              </div>
            </div>
          </div>
        )
      }
    </div >
  )
}

export default App
