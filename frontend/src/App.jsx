import { useState, useEffect, useRef, useCallback, useMemo } from 'react'
import confetti from 'canvas-confetti'
import { FiSettings, FiFile, FiFolder, FiSave, FiShare2, FiSearch, FiMaximize, FiChevronDown, FiGlobe, FiShuffle, FiArrowUp, FiArrowDown, FiPlay, FiSquare, FiHelpCircle, FiImage, FiDroplet, FiUpload, FiAward, FiX } from 'react-icons/fi'
import './App.css'
import CanvasWheel from './components/CanvasWheel'
import AdminPanel from './components/AdminPanel'
import { getActiveFiles, getStoredFiles } from './utils/storage'
import { getWheelData, saveWheelData, resetWheel } from './services/wheelApi'

function App() {
  // Get wheelId from URL or use default
  const wheelId = useMemo(() => {
    const path = window.location.pathname
    const match = path.match(/\/wheel\/([^/]+)/)
    return match ? match[1] : 'default-wheel'
  }, [])
  const [names, setNames] = useState([
    'Ali', 'Beatriz', 'Charles', 'Diya', 'Eric', 'Fatima', 'Gabriel', 'Hanna'
  ])
  const [results, setResults] = useState([])
  const [activeTab, setActiveTab] = useState('entries')
  const [namesText, setNamesText] = useState('Ali\nBeatriz\nCharles\nDiya\nEric\nFatima\nGabriel\nHanna')
  const [showAdvanced, setShowAdvanced] = useState(false)
  const [spinFiles, setSpinFiles] = useState([])
  const [selectedSpinFile, setSelectedSpinFile] = useState(null)
  const [showOpenDropdown, setShowOpenDropdown] = useState(false)
  const [loadingSpinFiles, setLoadingSpinFiles] = useState(false)
  const [showAdminPanel, setShowAdminPanel] = useState(false)
  const [nameToTicketMap, setNameToTicketMap] = useState({}) // Map names to ticket numbers for backend matching
  const [nameToIndexMap, setNameToIndexMap] = useState({}) // Map names to their index in the names array
  const [ticketToNameMap, setTicketToNameMap] = useState({}) // Map ticket numbers to names
  const [ticketToIndexMap, setTicketToIndexMap] = useState({}) // Map ticket numbers to index in names array (for fast removal)
  const [currentPage, setCurrentPage] = useState('admin') // 'admin' or 'wheel'
  const [spinCount, setSpinCount] = useState(() => {
    // Load from localStorage if available
    const saved = localStorage.getItem('spinCount')
    return saved ? parseInt(saved, 10) : 0
  }) // Track number of spins
  const [winners, setWinners] = useState(() => {
    // Load winners from localStorage on mount
    try {
      const saved = localStorage.getItem('winnersList')
      return saved ? JSON.parse(saved) : []
    } catch (e) {
      return []
    }
  }) // Winners ladder - stores all winners with spin number
  const [showWinnersList, setShowWinnersList] = useState(false) // Show winners list modal
  const [allSpinFiles, setAllSpinFiles] = useState([]) // All available spin files
  const [currentFileIndex, setCurrentFileIndex] = useState(0) // Current file being used
  const [showEndScreen, setShowEndScreen] = useState(false) // End screen flag
  const [hardcodedWinners, setHardcodedWinners] = useState(['', '']) // Hardcoded winners for spin 1-2
  const [finalRotation, setFinalRotation] = useState(0) // Single rotation value - the only source of truth
  const [isSpinning, setIsSpinning] = useState(false)
  const [isSidebarHidden, setIsSidebarHidden] = useState(false)
  const [showWinner, setShowWinner] = useState(false)
  const [winner, setWinner] = useState(null)
  const [showTextDuringSpin, setShowTextDuringSpin] = useState(false) // Show text 5 seconds before stop
  const [textOpacity, setTextOpacity] = useState(1) // Opacity for fade animation
  const [spinMode, setSpinMode] = useState(() => localStorage.getItem('spinMode') || 'random') // 'random' or 'fixed' (legacy)
  const [spinModes, setSpinModes] = useState(() => {
    // Per-spin mode configuration: { 1: 'random', 2: 'fixed', 3: 'random', ... }
    const saved = localStorage.getItem('spinModes')
    if (saved) {
      try {
        return JSON.parse(saved)
      } catch (e) {
        return {}
      }
    }
    return {}
  })
  const [showCustomize, setShowCustomize] = useState(false)
  const [customizeTab, setCustomizeTab] = useState('during-spin')
  const [isFullscreen, setIsFullscreen] = useState(false)
  const [centerImage, setCenterImage] = useState(() => {
    // Load from localStorage if available
    const saved = localStorage.getItem('centerImage')
    return saved || null
  })
  const [centerImageSize, setCenterImageSize] = useState(() => {
    const saved = localStorage.getItem('centerImageSize')
    return saved || 'M'
  })
  const centerImageInputRef = useRef(null)
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
  const textTimeoutRef = useRef(null) // Track timeout for showing text during spin

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

  // Debounce timer for textarea updates
  const textareaUpdateTimerRef = useRef(null)

  // Update names array in real-time as user types in textarea (with debouncing for large lists)
  const handleNamesTextChange = (e) => {
    const text = e.target.value
    setNamesText(text)

    // Clear previous timer
    if (textareaUpdateTimerRef.current) {
      clearTimeout(textareaUpdateTimerRef.current)
    }

    // Parse textarea content into names array (split by newlines, filter empty lines)
    const lines = text.split('\n').map(line => line.trim()).filter(line => line.length > 0)
    
    // Aggressive debouncing for very large lists to improve performance
    if (lines.length > 3000) {
      // Longer debounce for 3000+ entries
      if (textareaUpdateTimerRef.current) {
        clearTimeout(textareaUpdateTimerRef.current)
      }
      textareaUpdateTimerRef.current = setTimeout(() => {
        setNames(lines)
      }, 500) // 500ms delay for very large lists
    } else if (lines.length > 500) {
      // Debounce for large lists (>500 entries)
      if (textareaUpdateTimerRef.current) {
        clearTimeout(textareaUpdateTimerRef.current)
      }
      textareaUpdateTimerRef.current = setTimeout(() => {
        setNames(lines)
      }, 300) // 300ms delay
    } else {
      // Immediate update for small lists
      if (textareaUpdateTimerRef.current) {
        clearTimeout(textareaUpdateTimerRef.current)
      }
      setNames(lines)
    }
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

  const spinWheel = useCallback(async () => {
    if (isSpinning || names.length === 0) return
    
    // Removed warning dialog - optimizations handle large lists now

    // Cancel any existing animation
    if (animationFrameRef.current) {
      cancelAnimationFrame(animationFrameRef.current)
      animationFrameRef.current = null
    }

    // Clear frozen state when starting new spin
    isFrozenRef.current = false
    animationCompletedRef.current = false
    winnerProcessedRef.current = false

    // Show text immediately when admin clicks (with smooth fade in transition)
    setShowTextDuringSpin(true)
    setTextOpacity(0) // Start invisible for fade in
    setTimeout(() => {
      setTextOpacity(1) // Fade in smoothly
    }, 10)
    
    setIsSpinning(true)

    // Get current rotation - this is the ONLY rotation value
    const startRotation = finalRotation
    let lastTickRotation = startRotation // Track last rotation for sound sync

    // Duration: 8000ms (8s) - Total spin duration
    const duration = 6000

    // Clear any existing text timeout
    if (textTimeoutRef.current) {
      clearTimeout(textTimeoutRef.current)
      textTimeoutRef.current = null
    }

    // Hide text after 1 second (with smooth fade out transition)
    setTimeout(() => {
      setTextOpacity(0) // Start fade out smoothly
      setTimeout(() => {
        setShowTextDuringSpin(false) // Hide after fade completes
      }, 500) // 500ms fade out transition
    }, 1000) // Hide after 1 second

    // Show text again 4 seconds before stop (at 4 seconds into the 8 second spin) with smooth fade in
    textTimeoutRef.current = setTimeout(() => {
      setShowTextDuringSpin(true)
      setTextOpacity(0) // Start invisible
      // Smooth fade in animation
      setTimeout(() => {
        setTextOpacity(1) // Fade in smoothly
      }, 10)
    }, 3000) // 4 seconds = 4 seconds before 8 second stop (last 4 seconds)

    // Calculate total rotation: 5-8 full rotations (1800-2880 degrees)
    const minRotations = 5
    const maxRotations = 8
    const spins = minRotations + Math.random() * (maxRotations - minRotations)
    const totalRotationDegrees = spins * 360

    // Increment spin count
    const currentSpinNumber = spinCount + 1
    setSpinCount(currentSpinNumber)
    
    // Reload spinModes from localStorage to ensure we have latest values
    const savedSpinModes = localStorage.getItem('spinModes')
    let currentSpinModes = {}
    if (savedSpinModes) {
      try {
        currentSpinModes = JSON.parse(savedSpinModes)
      } catch (e) {
        currentSpinModes = spinModes // Fallback to state
      }
    } else {
      currentSpinModes = spinModes // Use state if localStorage is empty
    }
    
    // Determine mode for this spin
    // Check per-spin mode first (try both string and number keys), then fall back to global mode
    // spinModes keys are stored as strings in localStorage, so try both formats
    const modeForThisSpin = currentSpinModes[String(currentSpinNumber)] || 
                            currentSpinModes[currentSpinNumber] || 
                            spinMode || 
                            'random'
    const shouldUseFixedWinner = modeForThisSpin === 'fixed'
    
    // Get fixed winner from localStorage for this specific spin
    let targetWinnerIndex = null
    let fixedWinnerForSpin = null
    let winnerForThisSpin = null // Declare in outer scope so it's accessible in animate function
    
    if (shouldUseFixedWinner) {
      // Get selected winners from localStorage
      const savedSelectedWinners = localStorage.getItem('selectedWinners')
      if (savedSelectedWinners) {
        try {
          const selectedWinners = JSON.parse(savedSelectedWinners)
          // Find winner for this specific spin number (handle both string and number comparisons)
          winnerForThisSpin = selectedWinners.find(w => 
            w.spin === currentSpinNumber || 
            Number(w.spin) === currentSpinNumber ||
            String(w.spin) === String(currentSpinNumber)
          )
          
          if (winnerForThisSpin) {
            fixedWinnerForSpin = winnerForThisSpin.winnerId || winnerForThisSpin.name || winnerForThisSpin.ticketNumber
            
            // Find the index of this winner in the names array
            // Try multiple matching strategies - prioritize exact matches
            
            for (let i = 0; i < names.length; i++) {
              const name = names[i]
              const ticketNumber = nameToTicketMap[name] // Get ticket from mapping (can be undefined)
              
              // Match by winnerId first (most reliable - this is the entry ID)
              if (winnerForThisSpin.winnerId) {
                // winnerId can be entry.id format like "file-id-123"
                // Try to match by entry ID format first
                const entryId = `${selectedSpinFile?.id || ''}-${i}`
                if (entryId === winnerForThisSpin.winnerId) {
                  targetWinnerIndex = i
                  break
                }
                // Also try matching by name or ticket if winnerId is stored as name/ticket
                if (name === winnerForThisSpin.winnerId || 
                    ticketNumber === winnerForThisSpin.winnerId ||
                    String(name) === String(winnerForThisSpin.winnerId) ||
                    String(ticketNumber) === String(winnerForThisSpin.winnerId)) {
                  targetWinnerIndex = i
                  break
                }
              }
              
              // Match by ticket number FIRST (most reliable for unique identification)
              // Ticket number is unique, so if it matches, that's the correct entry
              if (winnerForThisSpin.ticketNumber && ticketNumber !== undefined && ticketNumber !== null && ticketNumber !== '') {
                const normalizedTicket = String(ticketNumber).trim()
                const normalizedWinnerTicket = String(winnerForThisSpin.ticketNumber).trim()
                const ticketMatch = normalizedTicket === normalizedWinnerTicket
                
                if (ticketMatch) {
                  // Ticket matches - this is the correct entry (ticket is unique)
                  // Also verify name matches if both are available (for extra safety, but ticket is primary)
                  if (winnerForThisSpin.name && name) {
                    const nameMatch = String(name).trim().toLowerCase() === String(winnerForThisSpin.name).trim().toLowerCase()
                    if (nameMatch) {
                      // Both ticket and name match - perfect match
                      targetWinnerIndex = i
                      break
                    } else {
                      // Ticket matches but name differs - still use it (ticket is unique identifier)
                      targetWinnerIndex = i
                      break
                    }
                  } else {
                    // Only ticket available - use it (ticket is unique)
                    targetWinnerIndex = i
                    break
                  }
                }
              }
              
              // Fallback: If no ticket, match by name (but this is less reliable and may match multiple entries)
              if (targetWinnerIndex === null && winnerForThisSpin.name && name && !winnerForThisSpin.ticketNumber) {
                const nameMatch = String(name).trim().toLowerCase() === String(winnerForThisSpin.name).trim().toLowerCase()
                if (nameMatch) {
                  // Only use if no ticket was provided (fallback case)
                  targetWinnerIndex = i
                  // Don't break here - continue to find better match with ticket
                }
              }
              
              // Fallback: match by fixedWinnerForSpin string
              if (fixedWinnerForSpin) {
                if (String(name) === String(fixedWinnerForSpin) ||
                    String(ticketNumber) === String(fixedWinnerForSpin)) {
                  targetWinnerIndex = i
                  break
                }
              }
            }
            
            // If still not found, try backend API as fallback (but prioritize frontend selection)
            // Only use backend if frontend localStorage doesn't have a selection
            if (targetWinnerIndex === null && selectedSpinFile && selectedSpinFile.id) {
      try {
        const result = await spinWheelAPI(selectedSpinFile.id)
                const backendWinner = result.winner
                
                if (backendWinner) {
                  // Try to match backend winner by ticket number first
                  for (let i = 0; i < names.length; i++) {
                    const name = names[i]
                    const ticketNumber = nameToTicketMap[name]
                    
                    // Match by ticket number (most reliable)
                    if (ticketNumber && String(ticketNumber).trim() === String(backendWinner).trim()) {
                      targetWinnerIndex = i
                      break
                    }
                  }
                  
                  // If ticket match failed, try by name
                  if (targetWinnerIndex === null) {
                    const winnerName = ticketToNameMap[backendWinner] || backendWinner
                    for (let i = 0; i < names.length; i++) {
                      const name = names[i]
                      if (String(name).trim().toLowerCase() === String(winnerName).trim().toLowerCase()) {
                        targetWinnerIndex = i
                        break
                      }
                    }
                  }
                  
                  // Last resort: use index map
                  if (targetWinnerIndex === null) {
                    const winnerName = ticketToNameMap[backendWinner] || backendWinner
                    if (nameToIndexMap[winnerName] !== undefined) {
                      targetWinnerIndex = nameToIndexMap[winnerName]
                    }
                  }
                }
      } catch (error) {
                // Continue without backend winner - use localStorage winner only
              }
            }
          }
        } catch (error) {
          // Failed to parse selected winners
        }
      }
    }
    
    // Calculate final rotation
    let endRotation
    if (targetWinnerIndex !== null && targetWinnerIndex >= 0 && shouldUseFixedWinner) {
      // Calculate rotation to land on the fixed winner
      const sliceAngle = 360 / names.length
      
      // Pointer is at 0° (right side, pointing right)
      // In canvas, slices start at -90° (top), so slice i starts at: i * sliceAngle - 90°
      // Slice i center is at: (i * sliceAngle - 90 + sliceAngle/2) degrees
      // We want the center of the target slice to align with the pointer (0°)
      
      // Calculate the center angle of the target slice in the original wheel (before rotation)
      // Slices start at -90° (top), so slice i center is at: (i * sliceAngle - 90 + sliceAngle/2)
      const sliceCenterAngle = (targetWinnerIndex * sliceAngle - 90 + sliceAngle / 2 + 360) % 360
      
      // When wheel rotates clockwise by R degrees:
      // - What was at angle A in original wheel is now at angle (A - R) mod 360
      // - Pointer is at 0° (right side)
      // - We want slice center to be at pointer: (sliceCenterAngle - endRotation) mod 360 = 0
      // - So: endRotation mod 360 = sliceCenterAngle
      
      // We want: endRotation = startRotation + totalRotationDegrees + adjustment
      // where (endRotation mod 360) = sliceCenterAngle
      
      // Calculate what the end rotation would be without adjustment
      const baseEndRotation = startRotation + totalRotationDegrees
      const baseEndRotationMod = ((baseEndRotation % 360) + 360) % 360
      
      // Calculate adjustment needed to align slice center with pointer
      // We want: (baseEndRotation + adjustment) mod 360 = sliceCenterAngle
      // So: adjustment = (sliceCenterAngle - baseEndRotationMod + 360) mod 360
      // But prefer the shorter path (adjustment between -180 and 180)
      let adjustment = sliceCenterAngle - baseEndRotationMod
      
      // Normalize adjustment to shortest path
      if (adjustment > 180) {
        adjustment -= 360
      } else if (adjustment < -180) {
        adjustment += 360
      }
      
      endRotation = baseEndRotation + adjustment
      
      // Verify: endRotation mod 360 should equal sliceCenterAngle
      const verifyMod = ((endRotation % 360) + 360) % 360
      const diff = Math.abs(verifyMod - sliceCenterAngle)
    } else {
      // Random spin
      const randomAngle = Math.random() * 360
      endRotation = startRotation + totalRotationDegrees + randomAngle
    }

    const startTime = performance.now()

    // Custom Easing: "Power Start + Friction Stop"
    // Goals: 
    const ease = (t) => {
      // Matched Derivative Piecewise Easing
      // Guarantees smooth velocity transition from Acceleration to Deceleration.

      // Configuration
      const t1 = 0.20 // Acceleration for 20% of time (approx 2s). Gives a heavy "heave".
      const p1 = 3    // Cubic acceleration (Heavy start)
      const p2 = 5    // Quintic deceleration (Extra soft final slowdown)

      // Calculate split point (Y) where curves meet to ensure velocity continuity
      // Derivation: V1(t1) = V2(t1) -> solve for Y
      // Y represents the portion of distance covered during the Deceleration phase (relative to 1)
      const Y = (p1 * (1 - t1)) / (p2 * t1 + p1 * (1 - t1))

      // X_Split is the distance covered at time t1
      const x_split = 1 - Y

      // Scaling coefficients
      const k = x_split / Math.pow(t1, p1)      // Accel scaler
      const A = Y / Math.pow(1 - t1, p2)        // Decel scaler

      if (t < t1) {
        // Phase 1: Acceleration
        return k * Math.pow(t, p1)
      } else {
        // Phase 2: Deceleration
        // Standard decay curve shifted to match peak velocity
        return 1 - A * Math.pow(1 - t, p2)
      }
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
        
        // Ultra-aggressive throttling for very large entry counts
        // Update every frame for smooth animation, but skip more frames for very large lists
        let shouldUpdate = false
        if (names.length < 2000) {
            // Update every frame for smooth animation
            shouldUpdate = true
        } else if (names.length < 3000) {
            // Update every other frame for 2000-3000 entries
            shouldUpdate = Math.floor(progress * 100) % 2 === 0
        } else if (names.length < 5000) {
            // Update every 4th frame for 3000-5000 entries (more aggressive)
            shouldUpdate = Math.floor(progress * 100) % 4 === 0
        } else {
            // Update every 5th frame for 5000+ entries (very aggressive)
            shouldUpdate = Math.floor(progress * 100) % 5 === 0
        }
        
        if (shouldUpdate) {
            setFinalRotation(current)
        } else {
            // Still update occasionally to prevent lag (every 15th frame for very large lists)
            const fallbackRate = names.length > 5000 ? 15 : 10
            if (Math.floor(progress * 100) % fallbackRate === 0) {
                setFinalRotation(current)
            }
        }
        
        // Robust sync: Play sound every 25 degrees (throttle sound for many entries)
        if (names.length < 2000 && Math.abs(current - lastTickRotation) >= 25) {
          playClickSound()
          lastTickRotation = current
        }

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

        // Clear text timeout and reset text state
        if (textTimeoutRef.current) {
          clearTimeout(textTimeoutRef.current)
          textTimeoutRef.current = null
        }
        setShowTextDuringSpin(false)
        setTextOpacity(1) // Reset opacity for next spin

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

          // Use fixed winner if available, otherwise use calculated winner
          let winnerName, winnerColor, winnerTicket, finalWinnerIndex
          
          if (shouldUseFixedWinner && targetWinnerIndex !== null && targetWinnerIndex >= 0 && targetWinnerIndex < names.length) {
            // ALWAYS use the fixed winner index - don't recalculate from rotation
            finalWinnerIndex = targetWinnerIndex
            winnerName = names[finalWinnerIndex]
            
            // Get ticket from mapping - prioritize winnerForThisSpin.ticketNumber
            if (winnerForThisSpin && winnerForThisSpin.ticketNumber) {
              winnerTicket = String(winnerForThisSpin.ticketNumber).trim()
            } else {
              // Fallback to nameToTicketMap
              winnerTicket = nameToTicketMap[winnerName]
              if (winnerTicket) {
                winnerTicket = String(winnerTicket).trim()
              }
            }
            
            // If still no ticket, leave it undefined (don't use name as fallback)
            winnerColor = colors[finalWinnerIndex % colors.length]
            } else {
            // Random spin or fixed winner not found - use calculated winner
            finalWinnerIndex = selectedIndex
            winnerName = names[finalWinnerIndex]
            // Get ticket from mapping - ONLY use actual ticket number, never fallback to name
            winnerTicket = nameToTicketMap[winnerName]
            // Don't use name as fallback - if no ticket, leave undefined
            winnerColor = colors[finalWinnerIndex % colors.length]
            
            if (shouldUseFixedWinner) {
              // Fixed winner mode but targetWinnerIndex not found
            }
          }

          // Set winner and stop spinning
          const winnerObj = { 
            name: winnerName, 
            color: winnerColor, 
            index: finalWinnerIndex,
            ticket: winnerTicket,
            spinNumber: currentSpinNumber,
            timestamp: new Date().toISOString()
          }
          setWinner(winnerObj)
          setIsSpinning(false)
          
          // Add winner to winners list
          setWinners(prevWinners => {
            const updated = [...prevWinners, winnerObj]
            // Save to localStorage
            localStorage.setItem('winnersList', JSON.stringify(updated))
            return updated
          })
          
          // Update spin count in localStorage
          localStorage.setItem('spinCount', currentSpinNumber.toString())

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
  }, [isSpinning, names, finalRotation, settings.spinTime, selectedSpinFile, spinMode, spinModes, spinCount])

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
    // Reset text state
    setShowTextDuringSpin(false)
    setTextOpacity(1) // Reset opacity
    if (textTimeoutRef.current) {
      clearTimeout(textTimeoutRef.current)
      textTimeoutRef.current = null
    }
  }

  const handleRemoveWinner = () => {
    if (winner) {
      // Remove winner by TICKET NUMBER if available, otherwise by name (if unique)
      const winnerTicket = winner.ticket
      const winnerName = winner.name
      
      // Check if ticket exists and is valid
      const hasValidTicket = winnerTicket && 
                            winnerTicket !== winnerName && 
                            String(winnerTicket).trim() !== String(winnerName).trim() &&
                            String(winnerTicket).trim() !== ''
      
      // If no valid ticket, check if name is unique (for dummy/manual data)
      if (!hasValidTicket) {
        // Count how many times this name appears
        const nameCount = names.filter(name => {
          // Extract base name if in "Name (Ticket)" format
          const baseNameMatch = name.match(/^(.+?)\s*\(\d+\)$/)
          const baseName = baseNameMatch ? baseNameMatch[1].trim() : name.trim()
          const winnerBaseName = winnerName.match(/^(.+?)\s*\(\d+\)$/)
            ? winnerName.match(/^(.+?)\s*\(\d+\)$/)[1].trim()
            : winnerName.trim()
          return baseName.toLowerCase() === winnerBaseName.toLowerCase()
        }).length
        
        // If name appears only once, safe to remove by name
        if (nameCount === 1) {
          const updatedNames = names.filter(name => {
            const baseNameMatch = name.match(/^(.+?)\s*\(\d+\)$/)
            const baseName = baseNameMatch ? baseNameMatch[1].trim() : name.trim()
            const winnerBaseName = winnerName.match(/^(.+?)\s*\(\d+\)$/)
              ? winnerName.match(/^(.+?)\s*\(\d+\)$/)[1].trim()
              : winnerName.trim()
            return baseName.toLowerCase() !== winnerBaseName.toLowerCase()
          })
          setNames(updatedNames)
          
          // Update textarea
          const lines = namesText.split('\n').filter(line => {
            const lineName = line.trim()
            if (!lineName) return true
            const baseNameMatch = lineName.match(/^(.+?)\s*\(\d+\)$/)
            const baseName = baseNameMatch ? baseNameMatch[1].trim() : lineName.trim()
            const winnerBaseName = winnerName.match(/^(.+?)\s*\(\d+\)$/)
              ? winnerName.match(/^(.+?)\s*\(\d+\)$/)[1].trim()
              : winnerName.trim()
            return baseName.toLowerCase() !== winnerBaseName.toLowerCase()
          })
      setNamesText(lines.join('\n'))
          
          // Dispatch event for admin panel
          window.dispatchEvent(new CustomEvent('winnerRemoved', {
            detail: { winnerName, winnerTicket: null }
          }))
          
          setShowWinner(false)
          setWinner(null)
          return
        } else {
          // Name appears multiple times - can't safely remove without ticket
          alert(`Cannot remove winner: This name appears ${nameCount} times. Ticket number is required to remove a specific entry.`)
          return
        }
      }
      
      const normalizedWinnerTicket = String(winnerTicket).trim()
      
      
      // Remove from names array by matching ticket number ONLY
      let removedCount = 0
      
      const updatedNames = names.filter((name, index) => {
        // First try to get ticket from mapping
        let nameTicket = nameToTicketMap[name]
        
        // If no mapping, try to extract ticket from "Name (Ticket)" format
        if (!nameTicket || nameTicket === name) {
          const ticketMatch = name.match(/^(.+?)\s*\((\d+)\)$/)
          if (ticketMatch) {
            nameTicket = ticketMatch[2]
          }
        }
        
        // Only remove if ticket number exists and matches exactly
        // Don't use name as fallback - this prevents removing all entries with same name
        if (nameTicket && nameTicket !== name && String(nameTicket).trim() !== String(name).trim()) {
          const normalizedNameTicket = String(nameTicket).trim()
          const matches = normalizedNameTicket === normalizedWinnerTicket
          if (matches) {
            removedCount++
            return false // Remove this entry
          }
        }
        
        // If no ticket mapping exists OR ticket equals name, keep the entry (don't remove by name)
        return true
      })
      
      
      if (removedCount === 0) {
        // Fast lookup: Use ticketToIndexMap for O(1) removal
        const ticketIndex = ticketToIndexMap[normalizedWinnerTicket]
        if (ticketIndex !== undefined && ticketIndex >= 0 && ticketIndex < names.length) {
          const finalUpdatedNames = names.filter((name, idx) => idx !== ticketIndex)
          setNames(finalUpdatedNames)
          removedCount = 1
        } else {
          // Last resort: Try exact name match
          const exactNameMatch = names.findIndex(name => name === winner.name)
          if (exactNameMatch !== -1) {
            const finalUpdatedNames = names.filter((name, idx) => idx !== exactNameMatch)
            setNames(finalUpdatedNames)
            removedCount = 1
          } else {
            alert(`Cannot remove winner: Ticket number "${normalizedWinnerTicket}" not found in entries.`)
            return
          }
        }
      }
      
      setNames(updatedNames)
      
      // Update textarea - remove lines that match the ticket ONLY
      let textareaRemovedCount = 0
      const lines = namesText.split('\n').filter(line => {
        const lineName = line.trim()
        if (!lineName) return true // Keep empty lines
        
        const lineTicket = nameToTicketMap[lineName]
        
        // Only remove if ticket number exists, is different from name, and matches exactly
        if (lineTicket && lineTicket !== lineName && String(lineTicket).trim() !== String(lineName).trim()) {
          const normalizedLineTicket = String(lineTicket).trim()
          const shouldRemove = normalizedLineTicket === normalizedWinnerTicket
          if (shouldRemove) {
            textareaRemovedCount++
          }
          return !shouldRemove // Keep if ticket doesn't match
        }
        
        // If no ticket mapping OR ticket equals name, keep the line (don't remove by name)
        return true
      })
      
      setNamesText(lines.join('\n'))
      
      // Update ticket mapping - remove entries with matching ticket
      const updatedMap = { ...nameToTicketMap }
      Object.keys(updatedMap).forEach(name => {
        const ticket = String(updatedMap[name]).trim()
        if (ticket === normalizedWinnerTicket) {
          delete updatedMap[name]
        }
      })
      setNameToTicketMap(updatedMap)

      // Dispatch event to notify AdminPanel to remove winner from entries list
      // Create event with proper detail - ONLY send ticket number (not name as fallback)
      const eventDetail = { 
        winnerName: winner.name,
        winnerTicket: winner.ticket // ONLY ticket number, no fallback to name
      }
      
      if (!eventDetail.winnerTicket) {
        return
      }
      
      // Dispatch on window
      const windowEvent = new CustomEvent('winnerRemoved', { 
        detail: eventDetail,
        bubbles: true,
        cancelable: true
      })
      window.dispatchEvent(windowEvent)
      
      // Also dispatch on document
      const docEvent = new CustomEvent('winnerRemoved', { 
        detail: eventDetail,
        bubbles: true,
        cancelable: true
      })
      document.dispatchEvent(docEvent)
      

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
    setSelectedSpinFile(null)
    setNameToTicketMap({})
    winnerProcessedRef.current = false
    isFrozenRef.current = false
    setShowTextDuringSpin(false)
    setTextOpacity(1) // Reset opacity
    if (textTimeoutRef.current) {
      clearTimeout(textTimeoutRef.current)
      textTimeoutRef.current = null
    }
    setSpinCount(0)
    setSpinMode('random')
    setSpinModes({})
  }

  // Load spin files from localStorage on mount
  useEffect(() => {
    const loadSpinFiles = () => {
      try {
        setLoadingSpinFiles(true)
        const files = getActiveFiles() // Get active files from localStorage
        setSpinFiles(files)
      } catch (error) {
      } finally {
        setLoadingSpinFiles(false)
      }
    }
    loadSpinFiles()
  }, [])
  
  // Listen for reset all events from admin panel
  useEffect(() => {
    const handleResetAllWinners = () => {
      setWinners([])
      localStorage.removeItem('winnersList')
    }
    
    const handleResetWheel = async () => {
      // Reset names to default
      setNames(['Ali', 'Beatriz', 'Charles', 'Diya', 'Eric', 'Fatima', 'Gabriel', 'Hanna'])
      setNamesText('Ali\nBeatriz\nCharles\nDiya\nEric\nFatima\nGabriel\nHanna')
      setResults([])
      setSelectedSpinFile(null)
      setNameToTicketMap({})
      setNameToIndexMap({})
      setTicketToNameMap({})
      setFinalRotation(0)
      setIsSpinning(false)
      setShowWinner(false)
      setWinner(null)
      setIsSidebarHidden(false)
      setSpinCount(0)
      localStorage.setItem('spinCount', '0')
      setShowTextDuringSpin(false)
      setTextOpacity(1) // Reset opacity
      if (textTimeoutRef.current) {
        clearTimeout(textTimeoutRef.current)
        textTimeoutRef.current = null
      }
      // Reset MongoDB data
      try {
        await resetWheel(wheelId)
      } catch (err) {
        console.error('Failed to reset MongoDB:', err)
      }
    }
    
    window.addEventListener('resetAllWinners', handleResetAllWinners)
    document.addEventListener('resetAllWinners', handleResetAllWinners)
    window.addEventListener('resetWheel', handleResetWheel)
    document.addEventListener('resetWheel', handleResetWheel)
    
    return () => {
      window.removeEventListener('resetAllWinners', handleResetAllWinners)
      document.removeEventListener('resetAllWinners', handleResetAllWinners)
      window.removeEventListener('resetWheel', handleResetWheel)
      document.removeEventListener('resetWheel', handleResetWheel)
    }
  }, [])

  // Track if data is being loaded to prevent auto-save from overwriting
  const isLoadingDataRef = useRef(false)
  
  // Load wheel data from MongoDB on mount
  useEffect(() => {
    const loadWheelData = async () => {
      isLoadingDataRef.current = true
      try {
        const data = await getWheelData(wheelId)
        if (data && data.entries && data.entries.length > 0) {
          setNames(data.entries)
          setNameToTicketMap(data.nameToTicketMap || {})
          setTicketToNameMap(data.ticketToNameMap || {})
          setNameToIndexMap(data.nameToIndexMap || {})
          setTicketToIndexMap(data.ticketToIndexMap || {})
          setNamesText(data.entries.join('\n'))
          if (data.settings) {
            setSettings(prev => ({ ...prev, ...data.settings }))
          }
        }
      } catch (err) {
        // Log error for debugging
        console.error('Failed to load wheel data from backend:', err.message)
        // Wheel not found - use default data (only if it's a 404, not a network error)
        if (err.message === 'Wheel not found') {
          // This is expected for new wheels
        } else {
          // Network or other error - show warning but continue
          console.warn('Could not load data from backend, using local state')
        }
      } finally {
        // Allow auto-save after loading is complete
        setTimeout(() => {
          isLoadingDataRef.current = false
        }, 3000) // Wait 3 seconds after load before allowing auto-save
      }
    }
    loadWheelData()
  }, [wheelId])

  // Auto-save to MongoDB when names change (debounced)
  useEffect(() => {
    // Don't auto-save if we're currently loading data or if it's default data
    if (isLoadingDataRef.current) {
      return // Skip auto-save while loading
    }
    
    if (names.length > 0 && names[0] !== 'Ali') { // Don't save default data
      const saveTimeout = setTimeout(() => {
        saveWheelData(wheelId, {
          entries: names,
          nameToTicketMap,
          ticketToNameMap,
          nameToIndexMap,
          ticketToIndexMap,
          settings
        }).catch(err => {
          console.error('Auto-save failed:', err)
        })
      }, 2000) // Save after 2 seconds

      return () => clearTimeout(saveTimeout)
    }
  }, [names, nameToTicketMap, ticketToNameMap, nameToIndexMap, ticketToIndexMap, settings, wheelId])

  // Listen for spin mode updates from admin panel
  useEffect(() => {
    const handleSpinModeUpdate = () => {
      const savedSpinModes = localStorage.getItem('spinModes')
      if (savedSpinModes) {
        try {
          setSpinModes(JSON.parse(savedSpinModes))
        } catch (e) {
        }
      }
    }
    
    // Listen for spin count reset
    const handleSpinCountReset = () => {
      const savedCount = localStorage.getItem('spinCount')
      setSpinCount(savedCount ? parseInt(savedCount, 10) : 0)
    }
    
    window.addEventListener('spinModeUpdated', handleSpinModeUpdate)
    window.addEventListener('spinCountReset', handleSpinCountReset)
    return () => {
      window.removeEventListener('spinModeUpdated', handleSpinModeUpdate)
      window.removeEventListener('spinCountReset', handleSpinCountReset)
    }
  }, [])

  // Close dropdown when clicking outside
  useEffect(() => {
    const handleClickOutside = (event) => {
      if (showOpenDropdown && !event.target.closest('.header-btn-dropdown-container')) {
        setShowOpenDropdown(false)
      }
    }
    document.addEventListener('mousedown', handleClickOutside)
    return () => document.removeEventListener('mousedown', handleClickOutside)
  }, [showOpenDropdown])

  // Handle spin file selection
  const handleSelectSpinFile = (spinFile) => {
    setSelectedSpinFile(spinFile)
    // Extract names from json_content and store mapping for winner matching
    if (spinFile.json_content && Array.isArray(spinFile.json_content)) {
      // Warn if too many entries
      if (spinFile.json_content.length > 2000) {
        alert(`Warning: This file has ${spinFile.json_content.length} entries. For best performance, consider limiting to 2000 entries.`)
      }
      
      // Debug: Log first item to see structure
      if (spinFile.json_content.length > 0) {
      }
      
      // Process ALL entries (no limit) - user wants all entries from Excel
      const contentToProcess = spinFile.json_content
      
      // Performance: Only log if needed (disabled for production)
      // console.log('📊 Processing Excel file:', { totalEntries: contentToProcess.length })
      
      // Get removed entries from localStorage to filter them out
      const getRemovedEntries = () => {
        try {
          const removed = localStorage.getItem('removedEntries')
          return removed ? JSON.parse(removed) : []
        } catch (e) {
          return []
        }
      }
      const normalize = (str) => String(str || '').trim().toLowerCase()
      const removedEntries = getRemovedEntries()
      
      // Performance: Only log if needed
      // console.log('🗑️ Removed entries count:', removedEntries.length)
      
      // Extract names keeping ALL entries (including duplicates), keeping track of original items
      const nameToOriginalItemMap = {} // Map name+index to original item (handles duplicates)
      const extractedNames = contentToProcess.map((item, index) => {
        // If item is already a string, check if it's in "Name (Ticket)" format
        if (typeof item === 'string') {
          let name = item.trim()
          // If name is empty, use index to ensure ALL entries are included
          if (!name || name.length === 0) {
            name = `Entry ${index + 1}`
          }
          // Check if already in "Name (Ticket)" format
          const ticketMatch = name.match(/^(.+?)\s*\((\d+)\)$/)
          if (ticketMatch) {
            const uniqueKey = `${name}-${index}`
            nameToOriginalItemMap[uniqueKey] = item
            return name // Already formatted
          }
          // Use index to handle duplicates - each entry gets unique mapping key
          const uniqueKey = `${name}-${index}`
          nameToOriginalItemMap[uniqueKey] = item
          return name
        }
        
        // If item is an object, try to find a meaningful value
        if (typeof item === 'object' && item !== null) {
          // Get ticket number first - try multiple field names
          const ticketNumber = item['Ticket Number'] || item['ticket number'] || item['ticketNumber'] || item['Ticket Number'] || item['Ticket'] || item['ticket'] || ''
          
          // Debug: Log ticket number extraction for first few items
          if (index < 5) {
            console.log('🎫 Ticket extraction:', {
              index,
              ticketNumber,
              itemKeys: Object.keys(item),
              firstName: item['First Name'] || item['first name'] || '',
              lastName: item['Last Name'] || item['last name'] || ''
            })
          }
          
          // Check for "First Name" and "Last Name" combination
          const firstName = item['First Name'] || item['first name'] || item['firstName'] || item['First Name'] || ''
          const lastName = item['Last Name'] || item['last name'] || item['lastName'] || item['Last Name'] || ''
          
          let displayName = ''
          
          // If both first and last name exist, combine them
          if (firstName && lastName) {
            displayName = `${firstName} ${lastName}`.trim()
          } else if (firstName) {
            displayName = String(firstName).trim()
          } else if (lastName) {
            displayName = String(lastName).trim()
          }
          
          // Format as "Name (Ticket)" if ticket exists, otherwise just name
          let formattedName = displayName
          if (ticketNumber && String(ticketNumber).trim() !== '') {
            if (displayName) {
              formattedName = `${displayName} (${String(ticketNumber).trim()})`
            } else {
              // If no name, use ticket as name
              formattedName = String(ticketNumber).trim()
            }
          } else if (!displayName) {
            // If no name and no ticket, use index as fallback to ensure ALL entries are included
            // This ensures every row from Excel is processed, even if empty
            formattedName = `Entry ${index + 1}`
          }
          
          // CRITICAL: Ensure formattedName is never empty - use index as last resort
          if (!formattedName || formattedName.trim().length === 0) {
            formattedName = `Entry ${index + 1}`
          }
          
          // Use index to handle duplicates - each entry gets unique mapping key
          const uniqueKey = `${formattedName}-${index}`
          nameToOriginalItemMap[uniqueKey] = item
          return formattedName
        }
        
        // Last resort: if item is not string or object
        let name = String(item).trim()
        // If name is empty, use index to ensure ALL entries are included
        if (!name || name.length === 0) {
          name = `Entry ${index + 1}`
        }
        const uniqueKey = `${name}-${index}`
        nameToOriginalItemMap[uniqueKey] = item
        return name
      })
      // REMOVED: Don't filter out empty names - use index as fallback instead
      // This ensures ALL entries from Excel are processed
      
      // Create mappings: name -> ticket number, name -> index, ticket -> name, ticket -> index
      const ticketMap = {}
      const indexMap = {}
      const ticketNameMap = {}
      const ticketIndexMap = {} // Fast lookup: ticket -> index in names array
      
      extractedNames.forEach((name, idx) => {
        // Use index-based unique key to get original item (handles duplicates)
        const uniqueKey = `${name}-${idx}`
        const originalItem = nameToOriginalItemMap[uniqueKey] || nameToOriginalItemMap[name]
        
        if (originalItem && typeof originalItem === 'object') {
          // CRITICAL: Extract ticket number from ORIGINAL ITEM, not from formatted name
          // The formatted name "Name (324)" might have a different number than actual ticket
          // Try multiple field names to find the actual ticket number
          const ticketNumber = originalItem['Ticket Number'] || 
                               originalItem['ticket number'] || 
                               originalItem['ticketNumber'] || 
                               originalItem['Ticket Number'] || 
                               originalItem['Ticket'] || 
                               originalItem['ticket'] ||
                               originalItem['Ticket No'] ||
                               originalItem['ticket no'] ||
                               originalItem['TicketNo'] ||
                               ''
          
          // Debug: Log ticket mapping for entries that match winner name pattern
          const nameMatch = name.match(/^(.+?)\s*\((\d+)\)$/)
          
          // ONLY store ticket if it exists and is different from name
          // Don't use name as ticket fallback - this prevents removing all entries with same name
          if (ticketNumber && String(ticketNumber).trim() !== '' && String(ticketNumber).trim() !== String(name).trim()) {
            const ticket = String(ticketNumber).trim()
            ticketMap[name] = ticket
            ticketNameMap[ticket] = name
            ticketIndexMap[ticket] = idx // Fast lookup for removal
          } else {
            // No ticket in original item - try to extract from formatted name as fallback
            const ticketMatch = name.match(/^(.+?)\s*\((\d+)\)$/)
            if (ticketMatch) {
              const extractedTicket = ticketMatch[2]
              // Only use extracted ticket if no actual ticket number found in original item
              if (!ticketMap[name]) {
                ticketMap[name] = extractedTicket
                ticketNameMap[extractedTicket] = name
                ticketIndexMap[extractedTicket] = idx // Fast lookup for removal
              }
            }
          }
          // Always store index mapping
          indexMap[name] = idx
        } else {
          // No original item - try to extract ticket from "Name (Ticket)" format
          const ticketMatch = name.match(/^(.+?)\s*\((\d+)\)$/)
          if (ticketMatch) {
            const extractedTicket = ticketMatch[2]
            ticketMap[name] = extractedTicket
            ticketNameMap[extractedTicket] = name
            ticketIndexMap[extractedTicket] = idx // Fast lookup for removal
          }
          indexMap[name] = idx
        }
      })
      
      // Store ticket-to-index map for fast removal
      setTicketToIndexMap(ticketIndexMap)
      
      // Now filter out removed entries AFTER we have ticket mappings
      // Filter BY TICKET NUMBER ONLY (not by name, because same name can have multiple entries)
      const finalNames = extractedNames.filter((name, idx) => {
        const ticketNumber = ticketMap[name]
        
        // Only check removal if ticket number exists and is different from name
        // Don't use name as fallback - this prevents removing all entries with same name
        if (!ticketNumber || ticketNumber === name) {
          // If no ticket mapping or ticket equals name, keep the entry (can't match by ticket)
          return true
        }
        
        const normalizedTicket = normalize(ticketNumber)
        
        // Check if this entry is in the removed list BY TICKET NUMBER ONLY
        const isRemoved = removedEntries.some(removed => {
          const removedTicket = normalize(removed.ticket || removed.originalTicket)
          // Match ONLY by ticket number (not by name)
          return normalizedTicket && removedTicket && normalizedTicket === removedTicket
        })
        
        if (isRemoved) {
          return false
        }
        
        return true
      })
      
      // Update mappings to only include non-removed entries
      const finalTicketMap = {}
      const finalIndexMap = {}
      const finalTicketNameMap = {}
      
      finalNames.forEach((name, idx) => {
        // ONLY store ticket if it exists and is different from name
        // Don't use name as fallback - this prevents removing all entries with same name
        const ticket = ticketMap[name]
        if (ticket && ticket !== name) {
          finalTicketMap[name] = ticket
          finalTicketNameMap[ticket] = name
        }
        // Always store index mapping
        finalIndexMap[name] = idx
      })
      
      console.log('✅ Final entries processed:', {
        totalInExcel: contentToProcess.length,
        extractedEntries: extractedNames.length,
        removedEntries: removedEntries.length,
        finalEntriesOnWheel: finalNames.length,
        ticketMappings: Object.keys(finalTicketMap).length,
        sampleEntries: finalNames.slice(0, 5),
        difference: contentToProcess.length - finalNames.length,
        differenceReason: removedEntries.length > 0 ? `${removedEntries.length} removed entries` : 'none'
      })
      
      // Alert if significant difference
      if (contentToProcess.length !== finalNames.length && removedEntries.length === 0) {
        console.warn('⚠️ Entry count mismatch:', {
          excelEntries: contentToProcess.length,
          wheelEntries: finalNames.length,
          difference: contentToProcess.length - finalNames.length,
          possibleCause: 'Empty entries or filtering issue'
        })
      }
      
      setNameToTicketMap(finalTicketMap)
      setNameToIndexMap(finalIndexMap)
      setTicketToNameMap(finalTicketNameMap)
      
      // CRITICAL: Update state to show entries on wheel
      if (finalNames.length > 0) {
        setNames(finalNames)
        // Use setTimeout to avoid blocking UI for very large lists
        if (finalNames.length > 1000) {
          setTimeout(() => {
            setNamesText(finalNames.join('\n'))
          }, 0)
        } else {
          setNamesText(finalNames.join('\n'))
        }
        
        // Save to MongoDB instead of localStorage
        // Mark that we're saving user data (not loading)
        isLoadingDataRef.current = false
        saveWheelData(wheelId, {
          entries: finalNames,
          nameToTicketMap: finalTicketMap,
          ticketToNameMap: finalTicketNameMap,
          nameToIndexMap: finalIndexMap,
          ticketToIndexMap: ticketIndexMap,
          settings: settings
        }).then(() => {
          console.log('✅ Wheel data saved successfully to backend')
        }).catch(err => {
          console.error('❌ Failed to save to MongoDB:', err)
          alert('Warning: Failed to save data to backend. Please try again.')
        })
      } else {
        alert('Warning: No entries to display. All entries may have been filtered out.')
      }
      
      // Load spin mode settings from localStorage (keep for now)
      const savedSpinModes = localStorage.getItem('spinModes')
      if (savedSpinModes) {
        try {
          setSpinModes(JSON.parse(savedSpinModes))
        } catch (e) {
        }
      }
    } else {
      console.error('❌ File missing json_content or json_content is not an array:', {
        fileId: spinFile?.id,
        filename: spinFile?.filename || spinFile?.name,
        hasJsonContent: !!spinFile?.json_content,
        jsonContentType: typeof spinFile?.json_content,
        isArray: Array.isArray(spinFile?.json_content)
      })
      alert('Error: File does not contain valid data. Please check the file and try again.')
    }
    setShowOpenDropdown(false)
  }

  // Handle file uploaded from admin panel
  const handleFileUploaded = async (uploadedFile) => {
    console.log('handleFileUploaded called with:', {
      fileId: uploadedFile?.id,
      filename: uploadedFile?.filename || uploadedFile?.name,
      hasJsonContent: !!uploadedFile?.json_content,
      jsonContentLength: uploadedFile?.json_content?.length || 0
    })
    
    // Reload files list for the dropdown
    try {
      const files = getActiveFiles() // Get active files from localStorage
      setSpinFiles(files)
    } catch (error) {
      // Continue even if reload fails
    }
      
      // Auto-select the uploaded file and load its data onto the wheel
      if (uploadedFile) {
      // Check if file has json_content (required for loading entries)
      if (uploadedFile.json_content && Array.isArray(uploadedFile.json_content)) {
        console.log('Loading file directly to wheel:', {
          fileId: uploadedFile.id,
          entriesCount: uploadedFile.json_content.length,
          firstEntry: uploadedFile.json_content[0],
          fileKeys: Object.keys(uploadedFile)
        })
        // Use the file directly - it already has json_content from AdminPanel
        // Force immediate state update
        handleSelectSpinFile(uploadedFile)
        console.log('handleSelectSpinFile called, waiting for state update...')
      } else if (uploadedFile.id) {
        // File doesn't have json_content, try to find it in admin files list (which has json_content)
        try {
          console.log('File missing json_content, fetching from admin API...')
          const adminFiles = getStoredFiles()
          const fileToLoad = adminFiles.find(f => f.id === uploadedFile.id)
          if (fileToLoad && fileToLoad.json_content && Array.isArray(fileToLoad.json_content)) {
            console.log('Found file in admin list, loading:', {
              fileId: fileToLoad.id,
              entriesCount: fileToLoad.json_content.length
            })
            handleSelectSpinFile(fileToLoad)
          } else {
            alert('Failed to load file: File data not available. Please try selecting the file manually from the dropdown.')
          }
        } catch (error) {
          console.error('Failed to load file from admin API:', error)
          alert('Failed to load file. Please try selecting the file manually from the dropdown.')
        }
      } else {
        console.error('Invalid file object:', uploadedFile)
        alert('Invalid file data. Please try selecting the file manually from the dropdown.')
      }
    } else {
      console.warn('No file provided to handleFileUploaded')
    }
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
    // Arrow color always fixed - never changes
    return '#ffd700' // Fixed Gold color
  }

  // Use fixed gold color for better visibility (or dynamic if setting enabled)
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
                  centerImage={centerImage}
                  centerImageSize={centerImageSize}
                />
                {/* Fixed Arrow Pointer at 3 o'clock (right side) - Does NOT rotate with wheel */}
                <svg
                  className="wheel-pointer"
                  viewBox="0 0 100 100"
                  xmlns="http://www.w3.org/2000/svg"
                  style={{
                    pointerEvents: 'none',
                    transform: 'translateY(-50%)' // Center vertically, pointing right (3 o'clock)
                  }}
                >
                  <defs>
                    <linearGradient id="dynamicGradientFS" x1="0%" y1="0%" x2="100%" y2="100%">
                      <stop offset="0%" stopColor={pointerColor} style={{ filter: 'brightness(1.5)' }} />
                      <stop offset="50%" stopColor={pointerColor} />
                      <stop offset="100%" stopColor={pointerColor} style={{ filter: 'brightness(0.7)' }} />
                    </linearGradient>
                    <filter id="bevelFS" x="-50%" y="-50%" width="200%" height="200%">
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
                  {/* Arrow pointing right (3 o'clock position) */}
                  <path
                    d="M 10 50 L 90 20 L 90 80 Z"
                    fill="url(#dynamicGradientFS)"
                    stroke={pointerColor}
                    strokeWidth="2"
                    filter="url(#bevelFS)"
                  />
                  <path
                    d="M 15 50 L 85 24 L 85 76 Z"
                    fill="none"
                    stroke="rgba(255,255,255,0.4)"
                    strokeWidth="2"
                  />
                </svg>
              </div>
              {/* Fixed arc text overlay - doesn't rotate */}
              {((!isSpinning && !showWinner && !winner) || (isSpinning && showTextDuringSpin)) && (
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
                    zIndex: 5,
                    opacity: textOpacity,
                    transition: 'opacity 0.3s ease-in-out'
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
              {/* Arrow is now drawn inside CanvasWheel and rotates with the wheel */}
            </div>
          </div>
        </div>
      </div>
    )
  }

  return (
    <div className="app">
      {/* Hidden file input for center image - always available */}
      <input
        ref={centerImageInputRef}
        type="file"
        accept="image/*"
        style={{ display: 'none' }}
        onChange={(e) => {
          const file = e.target.files[0]
          if (file) {
            // Convert to base64 for persistence
            const reader = new FileReader()
            reader.onload = (event) => {
              const base64Image = event.target.result
              setCenterImage(base64Image)
              // Save to localStorage
              localStorage.setItem('centerImage', base64Image)
            }
            reader.onerror = () => {
            }
            reader.readAsDataURL(file)
          }
        }}
      />
      {/* Header Navigation Bar */}
      <header className="header">
        <div className="header-right">
          <button className="header-btn" title="Customize" onClick={() => setShowCustomize(true)}>
            <FiSettings className="icon" />
            <span>Customize</span>
          </button>
          <button className="header-btn" title="Admin Panel" onClick={() => setShowAdminPanel(true)}>
            <FiUpload className="icon" />
            <span>Admin</span>
          </button>
          <button 
            className="header-btn" 
            title="Winner List" 
            onClick={() => setShowWinnersList(true)}
            style={{ 
              backgroundColor: winners.length > 0 ? '#4CAF50' : undefined,
              color: winners.length > 0 ? 'white' : undefined
            }}
          >
            <FiAward className="icon" />
            <span>Winner List {winners.length > 0 && `(${winners.length})`}</span>
          </button>
          <button className="header-btn" title="New" onClick={handleNew}>
            <FiFile className="icon" />
            <span>New</span>
          </button>
          <div className="header-btn-dropdown-container" style={{ position: 'relative' }}>
            <button 
              className="header-btn" 
              title="Open"
              onClick={() => setShowOpenDropdown(!showOpenDropdown)}
            >
              <FiFolder className="icon" />
              <span>Open</span>
              <FiChevronDown className="icon" style={{ marginLeft: '4px', fontSize: '12px' }} />
            </button>
            {showOpenDropdown && (
              <div 
                className="open-dropdown"
                style={{
                  position: 'absolute',
                  top: '100%',
                  left: 0,
                  backgroundColor: 'white',
                  border: '1px solid #ddd',
                  borderRadius: '4px',
                  boxShadow: '0 2px 8px rgba(0,0,0,0.15)',
                  minWidth: '200px',
                  maxHeight: '300px',
                  overflowY: 'auto',
                  zIndex: 1000,
                  marginTop: '4px'
                }}
              >
                {loadingSpinFiles ? (
                  <div style={{ padding: '12px', textAlign: 'center', color: '#888' }}>
                    Loading...
                  </div>
                ) : spinFiles.length === 0 ? (
                  <div style={{ padding: '12px', textAlign: 'center', color: '#888' }}>
                    No spin files available
                  </div>
                ) : (
                  <>
                    {spinFiles.map((file) => (
                      <div
                        key={file.id}
                        onClick={() => handleSelectSpinFile(file)}
                        style={{
                          padding: '12px',
                          cursor: 'pointer',
                          borderBottom: '1px solid #eee',
                          backgroundColor: selectedSpinFile?.id === file.id ? '#f0f0f0' : 'white'
                        }}
                        onMouseEnter={(e) => e.target.style.backgroundColor = '#f5f5f5'}
                        onMouseLeave={(e) => e.target.style.backgroundColor = selectedSpinFile?.id === file.id ? '#f0f0f0' : 'white'}
                      >
                        <div style={{ fontWeight: selectedSpinFile?.id === file.id ? 'bold' : 'normal' }}>
                          {file.filename}
                        </div>
                        {file.picture && (
                          <img 
                            src={file.picture} 
                            alt={file.filename}
                            style={{ width: '40px', height: '40px', objectFit: 'cover', marginTop: '4px', borderRadius: '4px' }}
                          />
                        )}
                      </div>
                    ))}
                  </>
                )}
              </div>
            )}
          </div>
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
                centerImage={centerImage}
                centerImageSize={centerImageSize}
                isSpinning={isSpinning}
                showTextDuringSpin={showTextDuringSpin}
              />
            </div>

            {/* Fixed arc text overlay - doesn't rotate */}
            {((!isSpinning && !showWinner && !winner) || (isSpinning && showTextDuringSpin)) && (
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
                  zIndex: 5,
                  opacity: textOpacity,
                  transition: 'opacity 0.5s ease-in-out'
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
            {/* Fixed Arrow Pointer at 3 o'clock (right side) - Does NOT rotate with wheel */}
            <svg
              className="wheel-pointer"
              viewBox="0 0 100 100"
              xmlns="http://www.w3.org/2000/svg"
              style={{
                pointerEvents: 'none',
                transform: 'translateY(-50%)' // Center vertically, pointing right (3 o'clock)
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
              {/* Arrow pointing right (3 o'clock position) */}
              <path
                d="M 10 50 L 90 20 L 90 80 Z"
                fill="url(#dynamicGradient)"
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
                      <button 
                        className="action-btn dropdown" 
                        title="Add image"
                        onClick={() => {
                          if (centerImageInputRef.current) {
                            centerImageInputRef.current.click()
                          }
                        }}
                      >
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
                          className="entries-textarea"
                          placeholder="Type names here, press Enter for new line..."
                          value={namesText}
                          onChange={handleNamesTextChange}
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

      {/* Winners List Modal */}
      {showWinnersList && (
        <div 
          className="winner-overlay" 
          onClick={() => setShowWinnersList(false)}
          style={{
            position: 'fixed',
            top: 0,
            left: 0,
            width: '100%',
            height: '100%',
            backgroundColor: 'rgba(0, 0, 0, 0.7)',
            display: 'flex',
            justifyContent: 'center',
            alignItems: 'center',
            zIndex: 2000
          }}
        >
          <div 
            className="winners-list-modal"
            onClick={(e) => e.stopPropagation()}
            style={{
              backgroundColor: '#1a1a1a',
              borderRadius: '16px',
              width: '90%',
              maxWidth: '800px',
              maxHeight: '80vh',
              overflow: 'hidden',
              boxShadow: '0 10px 40px rgba(0, 0, 0, 0.5)',
              display: 'flex',
              flexDirection: 'column'
            }}
          >
            {/* Modal Header */}
            <div style={{
              backgroundColor: '#2a2a2a',
              padding: '20px 24px',
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'center',
              borderBottom: '2px solid #333'
            }}>
              <h2 style={{
                margin: 0,
                color: '#fff',
                fontSize: '24px',
                fontWeight: '600',
                display: 'flex',
                alignItems: 'center',
                gap: '10px'
              }}>
                <FiAward style={{ color: '#FFD700' }} />
                Winners List ({winners.length})
              </h2>
              <button
                onClick={() => setShowWinnersList(false)}
                style={{
                  background: 'transparent',
                  border: 'none',
                  color: '#fff',
                  fontSize: '28px',
                  cursor: 'pointer',
                  padding: '0',
                  width: '32px',
                  height: '32px',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  borderRadius: '4px',
                  transition: 'background-color 0.2s'
                }}
                onMouseEnter={(e) => e.target.style.backgroundColor = '#444'}
                onMouseLeave={(e) => e.target.style.backgroundColor = 'transparent'}
                title="Close"
              >
                <FiX />
              </button>
            </div>
            
            {/* Modal Content */}
            <div style={{
              padding: '20px',
              overflowY: 'auto',
              flex: 1
            }}>
              {winners.length === 0 ? (
                <div style={{
                  textAlign: 'center',
                  padding: '60px 20px',
                  color: '#888'
                }}>
                  <FiAward style={{ fontSize: '64px', marginBottom: '16px', opacity: 0.3 }} />
                  <p style={{ fontSize: '18px', margin: 0 }}>No winners yet</p>
                  <p style={{ fontSize: '14px', margin: '8px 0 0 0' }}>Spin the wheel to see winners here!</p>
                </div>
              ) : (
                <div style={{
                  display: 'flex',
                  flexDirection: 'column',
                  gap: '12px'
                }}>
                  {winners.map((winner, index) => (
                    <div
                      key={index}
                      style={{
                        backgroundColor: '#2a2a2a',
                        borderRadius: '12px',
                        padding: '16px 20px',
                        border: `2px solid ${winner.color || '#4CAF50'}`,
                        boxShadow: '0 4px 12px rgba(0, 0, 0, 0.3)',
                        transition: 'transform 0.2s, box-shadow 0.2s'
                      }}
                      onMouseEnter={(e) => {
                        e.currentTarget.style.transform = 'translateY(-2px)'
                        e.currentTarget.style.boxShadow = '0 6px 16px rgba(0, 0, 0, 0.4)'
                      }}
                      onMouseLeave={(e) => {
                        e.currentTarget.style.transform = 'translateY(0)'
                        e.currentTarget.style.boxShadow = '0 4px 12px rgba(0, 0, 0, 0.3)'
                      }}
                    >
                      <div style={{
                        display: 'flex',
                        justifyContent: 'space-between',
                        alignItems: 'center',
                        flexWrap: 'wrap',
                        gap: '12px'
                      }}>
                        <div style={{ flex: 1 }}>
                          <div style={{
                            display: 'flex',
                            alignItems: 'center',
                            gap: '12px',
                            marginBottom: '8px'
                          }}>
                            <div style={{
                              width: '40px',
                              height: '40px',
                              borderRadius: '50%',
                              backgroundColor: winner.color || '#4CAF50',
                              display: 'flex',
                              alignItems: 'center',
                              justifyContent: 'center',
                              color: '#fff',
                              fontWeight: 'bold',
                              fontSize: '18px',
                              flexShrink: 0
                            }}>
                              {winner.spinNumber || index + 1}
                            </div>
                            <div>
                              <div style={{
                                color: '#fff',
                                fontSize: '20px',
                                fontWeight: '600',
                                marginBottom: '4px'
                              }}>
                                {winner.name}
                              </div>
                              {winner.ticket && winner.ticket !== winner.name && (
                                <div style={{
                                  color: '#aaa',
                                  fontSize: '14px'
                                }}>
                                  Ticket: {winner.ticket}
                                </div>
                              )}
                            </div>
                          </div>
                        </div>
                        <div style={{
                          color: '#888',
                          fontSize: '12px',
                          textAlign: 'right'
                        }}>
                          {winner.timestamp && new Date(winner.timestamp).toLocaleString()}
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        </div>
      )}

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
                {winner.ticket && winner.ticket !== winner.name && (
                  <div className="winner-ticket" style={{ 
                    marginTop: '8px', 
                    fontSize: '18px', 
                    color: '#666',
                    fontWeight: '500'
                  }}>
                    Ticket: {winner.ticket}
                  </div>
                )}
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
                      <label className="customize-label">Image at the center of the wheel</label>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '12px' }}>
                        <button 
                          className="customize-image-btn"
                          onClick={() => centerImageInputRef.current?.click()}
                          style={{ flex: 1 }}
                        >
                        <FiImage />
                          <span>{centerImage ? 'Change Image' : 'Select Image'}</span>
                        <FiChevronDown />
                      </button>
                        {centerImage && (
                          <button
                            className="customize-btn cancel-btn"
                            onClick={() => {
                              setCenterImage(null)
                              localStorage.removeItem('centerImage')
                              if (centerImageInputRef.current) {
                                centerImageInputRef.current.value = ''
                              }
                            }}
                            style={{ padding: '8px 16px' }}
                          >
                            Remove
                          </button>
                        )}
                      </div>
                      {centerImage && (
                        <div style={{ marginTop: '12px', textAlign: 'center' }}>
                          <img 
                            src={centerImage} 
                            alt="Center preview" 
                            style={{ 
                              maxWidth: '150px', 
                              maxHeight: '150px', 
                              borderRadius: '8px',
                              border: '2px solid #ddd'
                            }} 
                          />
                        </div>
                      )}
                    </div>

                    <div className="customize-field">
                      <label className="customize-label">Image size</label>
                      <select
                        className="customize-select"
                        value={centerImageSize}
                        onChange={(e) => {
                          setCenterImageSize(e.target.value)
                          localStorage.setItem('centerImageSize', e.target.value)
                        }}
                        disabled={!centerImage}
                      >
                        <option value="S">Small</option>
                        <option value="M">Medium</option>
                        <option value="L">Large</option>
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

      {/* Admin Panel */}
      {showAdminPanel && (
        <AdminPanel 
          onClose={() => setShowAdminPanel(false)} 
          onFileUploaded={handleFileUploaded}
        />
      )}
    </div >
  )
}

export default App
