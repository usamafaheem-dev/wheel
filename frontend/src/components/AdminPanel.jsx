import { useState, useRef, useEffect } from 'react'
import { FiUpload, FiX, FiFile, FiImage, FiCheck, FiAlertCircle, FiSearch, FiSend, FiLogOut, FiShuffle, FiRefreshCw } from 'react-icons/fi'
import { parseExcelFile, imageToBase64 } from '../utils/excelParser'
import { getStoredFiles, saveFile, deleteFile, getFileById, getActiveFiles, toggleFileActive, checkPassword as checkPasswordLocal, setPassword as setPasswordLocal } from '../utils/storage'

const AdminPanel = ({ onClose, onFileUploaded, onGoToWheel }) => {
  const [password, setPassword] = useState('')
  const [filename, setFilename] = useState('')
  const [excelFile, setExcelFile] = useState(null)
  const [pictureFile, setPictureFile] = useState(null)
  const [isAuthenticated, setIsAuthenticated] = useState(false)
  const [isUploading, setIsUploading] = useState(false)
  const [error, setError] = useState('')
  const [success, setSuccess] = useState('')
  const [passwordError, setPasswordError] = useState('')
  const [showOverwriteConfirm, setShowOverwriteConfirm] = useState(false)
  const [pendingUpload, setPendingUpload] = useState(null)
  
  // New states for comprehensive admin panel
  const [entries, setEntries] = useState([])
  const [publishedEntries, setPublishedEntries] = useState([])
  const [searchQuery, setSearchQuery] = useState('')
  const [spinMode, setSpinMode] = useState('natural') // 'natural' or 'fixed' (legacy)
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
  const [selectedWinners, setSelectedWinners] = useState([]) // Array of winner IDs mapped to spin numbers: [{spin: 1, winnerId: '...'}, ...]
  const [fixedWinnerSearch, setFixedWinnerSearch] = useState('') // Search query for fixed winners
  const [isPublishing, setIsPublishing] = useState(false)
  const [isLoadingEntries, setIsLoadingEntries] = useState(false)
  const [maxSpinNumber, setMaxSpinNumber] = useState(5) // Maximum spin number to configure
  const [currentSpinCount, setCurrentSpinCount] = useState(() => {
    return parseInt(localStorage.getItem('spinCount') || '0', 10)
  })
  
  // Password change states
  const [showPasswordChangeModal, setShowPasswordChangeModal] = useState(false)
  const [oldPassword, setOldPassword] = useState('')
  const [newPassword, setNewPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [passwordChangeError, setPasswordChangeError] = useState('')
  const [passwordChangeSuccess, setPasswordChangeSuccess] = useState('')
  const [isChangingPassword, setIsChangingPassword] = useState(false)
  
  const excelInputRef = useRef(null)
  const pictureInputRef = useRef(null)
  const panelRef = useRef(null)

  // Slide-in animation on mount
  useEffect(() => {
    if (isAuthenticated && panelRef.current) {
      panelRef.current.style.transform = 'translateX(0)'
    }
  }, [isAuthenticated])

  // Load entries when authenticated
  useEffect(() => {
    if (isAuthenticated) {
      loadEntries()
      // Load spin mode settings from localStorage
      const savedSpinModes = localStorage.getItem('spinModes')
      if (savedSpinModes) {
        try {
          setSpinModes(JSON.parse(savedSpinModes))
        } catch (e) {
          console.error('Failed to parse spinModes:', e)
        }
      }
      // Load current spin count
      const savedCount = localStorage.getItem('spinCount')
      setCurrentSpinCount(savedCount ? parseInt(savedCount, 10) : 0)
      
      // Load selected winners from localStorage
      const savedWinners = localStorage.getItem('selectedWinners')
      if (savedWinners) {
        try {
          const winners = JSON.parse(savedWinners)
          // Filter out removed entries from selected winners
          const removedEntries = getRemovedEntries()
          const filteredWinners = winners.filter(w => {
            const wName = normalize(w.name || '')
            const wTicket = normalize(w.ticketNumber || '')
            return !removedEntries.some(removed => {
              const removedName = normalize(removed.name || removed.originalName)
              const removedTicket = normalize(removed.ticket || removed.originalTicket)
              return wName === removedName || wTicket === removedTicket
            })
          })
          setSelectedWinners(filteredWinners)
          if (filteredWinners.length !== winners.length) {
            localStorage.setItem('selectedWinners', JSON.stringify(filteredWinners))
          }
        } catch (e) {
          console.error('Failed to parse selectedWinners:', e)
        }
      }
    }
  }, [isAuthenticated])
  
  // Listen for spin count updates
  useEffect(() => {
    const handleSpinCountUpdate = () => {
      const savedCount = localStorage.getItem('spinCount')
      setCurrentSpinCount(savedCount ? parseInt(savedCount, 10) : 0)
    }
    
    window.addEventListener('spinCountReset', handleSpinCountUpdate)
    // Also check periodically (in case updated from another tab/window)
    const interval = setInterval(() => {
      const savedCount = localStorage.getItem('spinCount')
      const count = savedCount ? parseInt(savedCount, 10) : 0
      if (count !== currentSpinCount) {
        setCurrentSpinCount(count)
      }
    }, 1000)
    
    return () => {
      window.removeEventListener('spinCountReset', handleSpinCountUpdate)
      clearInterval(interval)
    }
  }, [currentSpinCount])
  
  // Helper function to normalize strings
  const normalize = (str) => String(str || '').trim().toLowerCase()
  
  // Helper function to get/set removed entries from localStorage
  const getRemovedEntries = () => {
    try {
      const removed = localStorage.getItem('removedEntries')
      return removed ? JSON.parse(removed) : []
    } catch (e) {
      return []
    }
  }
  
  const addToRemovedEntries = (winnerName, winnerTicket) => {
    const removed = getRemovedEntries()
    const newRemoved = {
      name: normalize(winnerName),
      ticket: normalize(winnerTicket),
      originalName: winnerName,
      originalTicket: winnerTicket
    }
    // Check if already removed
    const exists = removed.some(r => 
      r.name === newRemoved.name || r.ticket === newRemoved.ticket
    )
    if (!exists) {
      removed.push(newRemoved)
      localStorage.setItem('removedEntries', JSON.stringify(removed))
    }
  }
  
  // Listen for winner removal events and update entries list
  useEffect(() => {
    const handleWinnerRemoved = (event) => {
      console.log('AdminPanel: winnerRemoved event received', event.detail)
      const { winnerName, winnerTicket } = event.detail || {}
      
      // MUST have ticket number to remove (don't use name as fallback)
      if (!winnerTicket) {
        console.warn('AdminPanel: No ticket number in event, cannot remove entry')
        return
      }
      
      // Add to removed entries list in localStorage (persistent)
      addToRemovedEntries(winnerName, winnerTicket)
      
      // Normalize strings for comparison (trim and lowercase)
      const normalizedWinnerName = normalize(winnerName)
      const normalizedWinnerTicket = normalize(winnerTicket)
      
      console.log('AdminPanel: Removing winner', { 
        winnerName, 
        winnerTicket, 
        normalizedWinnerName, 
        normalizedWinnerTicket 
      })
      
      // Remove winner from entries list (this updates both data preview and dropdown)
      // Remove ONLY by ticket number (not by name, because same name can have multiple entries)
      setEntries(prevEntries => {
        console.log('AdminPanel: Current entries count before removal:', prevEntries.length)
        
        // If no ticket number, cannot remove (need ticket to identify unique entry)
        if (!normalizedWinnerTicket || normalizedWinnerTicket === '') {
          console.warn('AdminPanel: No ticket number provided, cannot remove entry')
          return prevEntries
        }
        
        const filtered = prevEntries.filter(entry => {
          // CRITICAL: Only match by ticket number if ticket exists and is different from name
          // Don't match by name - this prevents removing all entries with same name
          const entryTicket = entry.ticketNumber ? normalize(entry.ticketNumber) : null
          
          // Only match if ticket exists, is different from name, and matches winner ticket
          if (entryTicket && entryTicket !== normalize(entry.name) && entryTicket === normalizedWinnerTicket) {
            console.log('AdminPanel: Removing entry from list by ticket', { 
              entryName: entry.name,
              entryTicket, 
              entryId: entry.id,
              winnerTicket: normalizedWinnerTicket
            })
            return false // Remove this entry
          }
          
          // Keep entry if:
          // - No ticket number
          // - Ticket equals name (can't safely match)
          // - Ticket doesn't match winner ticket
          return true
        })
        const removedCount = prevEntries.length - filtered.length
        console.log('AdminPanel: Entries count after removal:', filtered.length, 'removed:', removedCount)
        
        if (removedCount > 0) {
          setSuccess(`Removed ${removedCount} entry/entries for ${winnerName}`)
          setTimeout(() => setSuccess(''), 3000)
        }
        
        // Force re-render by returning new array
        return [...filtered]
      })
      
      // Also remove from selectedWinners if it was selected (by ticket number only)
      setSelectedWinners(prevWinners => {
        // If no ticket number, cannot remove
        if (!normalizedWinnerTicket || normalizedWinnerTicket === '') {
          return prevWinners
        }
        
        const updated = prevWinners.filter(w => {
          // CRITICAL: Only match by ticket number if ticket exists and is different from name
          // Don't match by name - this prevents removing all entries with same name
          const wTicket = w.ticketNumber ? normalize(w.ticketNumber) : null
          
          // Only match if ticket exists, is different from name, and matches winner ticket
          if (wTicket && wTicket !== normalize(w.name) && wTicket === normalizedWinnerTicket) {
            console.log('AdminPanel: Removing from selectedWinners by ticket', { 
              wName: w.name,
              wTicket, 
              spin: w.spin,
              winnerTicket: normalizedWinnerTicket
            })
            return false // Remove this winner
          }
          
          // Keep winner if:
          // - No ticket number
          // - Ticket equals name (can't safely match)
          // - Ticket doesn't match winner ticket
          return true
        })
        
        // Update localStorage
        localStorage.setItem('selectedWinners', JSON.stringify(updated))
        console.log('AdminPanel: Updated selectedWinners count:', updated.length, 'removed:', prevWinners.length - updated.length)
        
        // Force re-render
        return [...updated]
      })
    }
    
    console.log('AdminPanel: Setting up winnerRemoved event listener')
    
    // Listen on window
    window.addEventListener('winnerRemoved', handleWinnerRemoved)
    
    // Also listen for the event on document for better compatibility
    document.addEventListener('winnerRemoved', handleWinnerRemoved)
    
    // Also add a test listener to verify events are working
    const testHandler = () => {
      console.log('AdminPanel: Test event received - event system is working')
    }
    window.addEventListener('testEvent', testHandler)
    
    return () => {
      console.log('AdminPanel: Removing winnerRemoved event listener')
      window.removeEventListener('winnerRemoved', handleWinnerRemoved)
      document.removeEventListener('winnerRemoved', handleWinnerRemoved)
      window.removeEventListener('testEvent', testHandler)
    }
  }, [])

  const loadEntries = async () => {
    setIsLoadingEntries(true)
    setError('')
    try {
      // Load files from localStorage instead of backend
      const files = getStoredFiles()
      
      if (!files || files.length === 0) {
        setError('No files found. Please upload an Excel file.')
        setIsLoadingEntries(false)
        return
      }
      
      // Log files loaded from localStorage
      console.log('📥 Files loaded from localStorage:', {
        totalFiles: files.length,
        filesInfo: files.map(f => ({
          id: f.id,
          filename: f.filename || f.name,
          jsonContentLength: f.json_content?.length || 0,
          hasJsonContent: !!f.json_content,
          isArray: Array.isArray(f.json_content)
        }))
      })
      
      // Get removed entries from localStorage
      const removedEntries = getRemovedEntries()
      const normalize = (str) => String(str || '').trim().toLowerCase()
      
      // Extract all entries from all files - NO LIMITS, process ALL entries
      const allEntries = []
      let totalEntriesInFiles = 0
      files.forEach(file => {
        if (file.json_content && Array.isArray(file.json_content)) {
          const fileEntriesCount = file.json_content.length
          totalEntriesInFiles += fileEntriesCount
          console.log(`📊 Processing file "${file.filename || file.name}": ${fileEntriesCount} entries`)
          
          // Process ALL entries - no slice, no limit
          file.json_content.forEach((item, idx) => {
            const firstName = item['First Name'] || item['first name'] || item['firstName'] || ''
            const lastName = item['Last Name'] || item['last name'] || item['lastName'] || ''
            const ticketNumber = item['Ticket Number'] || item['ticket number'] || item['ticketNumber'] || ''
            const email = item['Email'] || item['email'] || ''
            
            let name = ''
            if (firstName && lastName) {
              name = `${firstName} ${lastName}`.trim()
            } else if (firstName) {
              name = String(firstName).trim()
            } else if (lastName) {
              name = String(lastName).trim()
            } else if (ticketNumber) {
              name = String(ticketNumber).trim()
            } else {
              // Fallback to first available value
              const keys = Object.keys(item)
              if (keys.length > 0) {
                name = String(item[keys[0]]).trim()
              }
            }
            
            // CRITICAL: Only filter by ticket number if ticket exists and is different from name
            // Don't filter by name - this prevents removing all entries with same name
            const entryTicket = ticketNumber ? normalize(ticketNumber) : null
            
            // Check if this entry is in the removed list BY TICKET NUMBER ONLY (not by name)
            let isRemoved = false
            if (entryTicket && entryTicket !== normalize(name)) {
              // Only check removal if ticket exists and is different from name
              isRemoved = removedEntries.some(removed => {
                const removedTicket = normalize(removed.ticket || removed.originalTicket)
                // Match ONLY by ticket number (not by name, because same name can have multiple entries)
                // Both tickets must exist and match exactly
                return removedTicket && removedTicket !== '' && entryTicket === removedTicket
              })
            }
            // If no ticket or ticket equals name, don't filter (can't safely match by ticket)
            
            // Only add if not removed
            if (!isRemoved) {
              allEntries.push({
                id: `${file.id}-${idx}`,
                name: name || `Entry ${idx + 1}`,
                ticketNumber: ticketNumber || '',
                email: email || '',
                fileId: file.id,
                originalData: item
              })
            } else {
              console.log('Filtering out removed entry by ticket:', { name, ticketNumber, entryTicket })
            }
          })
        }
      })
      console.log('AdminPanel: Loaded entries, filtered removed:', { 
        totalInFiles: totalEntriesInFiles,
        totalAfterFilter: allEntries.length, 
        removedCount: removedEntries.length,
        filesProcessed: files.length,
        entriesPerFile: files.map(f => ({ 
          fileId: f.id, 
          filename: f.filename || f.name, 
          entries: f.json_content?.length || 0 
        }))
      })
      setEntries(allEntries)
      setPublishedEntries([])
    } catch (error) {
      console.error('Failed to load entries:', error)
      setError('Failed to load entries')
    } finally {
      setIsLoadingEntries(false)
    }
  }

  const handlePasswordSubmit = async (e) => {
    e.preventDefault()
    setPasswordError('')
    
    try {
      // Client-side password check (default: "admin")
      const isValid = checkPasswordLocal(password)
      if (isValid) {
        setIsAuthenticated(true)
        setError('')
        setPassword('') // Clear password field after successful login
      } else {
        setPasswordError('Invalid password. Default password is "admin"')
      }
    } catch (error) {
      console.error('Password check error:', error)
      setPasswordError('Failed to verify password')
    }
  }

  const handleExcelChange = (e) => {
    const file = e.target.files[0]
    if (file) {
      if (file.type === 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' || 
          file.type === 'application/vnd.ms-excel' ||
          file.name.endsWith('.xlsx') || 
          file.name.endsWith('.xls')) {
        setExcelFile(file)
        setError('')
        if (!filename) {
          setFilename(file.name.replace(/\.(xlsx|xls)$/i, ''))
        }
      } else {
        setError('Please upload a valid Excel file (.xlsx or .xls)')
        setExcelFile(null)
      }
    }
  }

  const handlePictureChange = (e) => {
    const file = e.target.files[0]
    if (file) {
      if (file.type.startsWith('image/')) {
        setPictureFile(file)
        setError('')
      } else {
        setError('Please upload a valid image file')
        setPictureFile(null)
      }
    }
  }

  const handleUpload = async (e) => {
    e.preventDefault()
    setError('')
    setSuccess('')

    if (!filename.trim()) {
      setError('Please enter a filename')
      return
    }

    if (!excelFile) {
      setError('Please select an Excel file')
      return
    }

    setIsUploading(true)

    try {
      // Parse Excel file client-side
      const jsonContent = await parseExcelFile(excelFile)
      
      // Convert picture to Base64 if provided
      let pictureBase64 = null
      if (pictureFile) {
        pictureBase64 = await imageToBase64(pictureFile)
      }
      
      // Create file object
      const fileData = {
        filename: filename.trim(),
        json_content: jsonContent,
        picture: pictureBase64,
        active: true,
        createdAt: new Date().toISOString()
      }
      
      // Check if file with same name exists
      const existingFiles = getStoredFiles()
      const existingFile = existingFiles.find(f => f.filename === fileData.filename)
      
      if (existingFile) {
        // Show overwrite confirmation
        setShowOverwriteConfirm(true)
        setPendingUpload({ filename, excelFile, pictureFile, fileData })
        setIsUploading(false)
        return
      }
      
      // Save to localStorage
      const savedFile = saveFile(fileData)
      
      setSuccess('File uploaded successfully!')
      
      // Reload entries
      await loadEntries()
      
      // Notify parent component about the uploaded file
      if (onFileUploaded && savedFile) {
        onFileUploaded(savedFile)
      }
      
      // Reset form
      setFilename('')
      setExcelFile(null)
      setPictureFile(null)
      if (excelInputRef.current) excelInputRef.current.value = ''
      if (pictureInputRef.current) pictureInputRef.current.value = ''

    } catch (error) {
      setError(error.message || 'Failed to upload file')
    } finally {
      setIsUploading(false)
    }
  }

  const handlePublishToWheel = async () => {
    if (entries.length === 0) {
      setError('No entries available to publish')
      return
    }
    
    setIsPublishing(true)
    setError('')
    setSuccess('')
    
    try {
      // Publish all entries to wheel
      setPublishedEntries([...entries])
      
      // Store spin mode settings and selected winners in localStorage
      localStorage.setItem('spinModes', JSON.stringify(spinModes))
      localStorage.setItem('selectedWinners', JSON.stringify(selectedWinners))
      
      // If fixed winners are selected, show success message
      const fixedSpins = Object.keys(spinModes).filter(s => spinModes[s] === 'fixed')
      if (fixedSpins.length > 0 && selectedWinners.length > 0) {
        const winnerIds = selectedWinners.map(w => w.winnerId)
        const winnerEntries = entries.filter(e => winnerIds.includes(e.id))
        if (winnerEntries.length > 0) {
          const winnerNames = winnerEntries.map(e => e.name).join(', ')
          setSuccess(`${entries.length} entries published! Fixed winners: ${winnerNames}`)
        } else {
          setSuccess(`${entries.length} entries published!`)
        }
      } else {
        setSuccess(`${entries.length} entries published to wheel!`)
      }
      
      // Trigger a reload of settings in parent
      window.dispatchEvent(new Event('spinModeUpdated'))
      
      if (onFileUploaded) {
        // Get the file ID from entries (assuming all entries are from same file or get first file)
        const fileIds = [...new Set(entries.map(e => e.fileId).filter(Boolean))]
        if (fileIds.length > 0) {
          // Load the file from localStorage and pass it to wheel
          try {
            const files = getStoredFiles()
            // Find the file(s) that contain these entries
            const relevantFiles = files.filter(f => fileIds.includes(f.id))
            if (relevantFiles.length > 0) {
              // Use the first file (or combine if multiple)
              const fileToLoad = relevantFiles[0]
              console.log('Publishing file to wheel:', {
                fileId: fileToLoad.id,
                filename: fileToLoad.filename || fileToLoad.name,
                entriesCount: fileToLoad.json_content?.length || 0
              })
              onFileUploaded(fileToLoad)
              setSuccess(`${entries.length} entries published to wheel! File loaded.`)
            } else {
              console.error('No matching files found for fileIds:', fileIds)
              setError('Failed to find file to load. Please try selecting the file manually.')
            }
          } catch (err) {
            console.error('Failed to load file for wheel:', err)
            setError('Failed to load file: ' + (err.message || 'Unknown error'))
          }
        } else {
          console.error('No file IDs found in entries')
          setError('No file IDs found. Please upload a file first.')
        }
      } else {
        console.warn('onFileUploaded callback not provided')
        setError('Cannot publish: onFileUploaded callback missing')
      }
    } catch (err) {
      setError('Failed to publish entries')
    } finally {
      setIsPublishing(false)
    }
  }

  const handleLogout = () => {
    setIsAuthenticated(false)
    setPassword('')
    setEntries([])
    setPublishedEntries([])
    setSearchQuery('')
    setSpinMode('natural')
    setSpinModes({})
    setSelectedWinners([])
    setFixedWinnerSearch('')
    // Clear password change form
    setOldPassword('')
    setNewPassword('')
    setConfirmPassword('')
    setPasswordChangeError('')
    setPasswordChangeSuccess('')
  }

  const handleChangePassword = async (e) => {
    e.preventDefault()
    setPasswordChangeError('')
    setPasswordChangeSuccess('')
    
    // Validation
    if (!oldPassword.trim()) {
      setPasswordChangeError('Please enter your current password')
      return
    }
    
    if (!newPassword.trim()) {
      setPasswordChangeError('Please enter a new password')
      return
    }
    
    if (newPassword.length < 4) {
      setPasswordChangeError('New password must be at least 4 characters long')
      return
    }
    
    if (newPassword !== confirmPassword) {
      setPasswordChangeError('New password and confirm password do not match')
      return
    }
    
    // Verify old password
    if (!checkPasswordLocal(oldPassword)) {
      setPasswordChangeError('Current password is incorrect')
      return
    }
    
    setIsChangingPassword(true)
    
    try {
      // Set new password
      setPasswordLocal(newPassword)
      setPasswordChangeSuccess('Password changed successfully!')
      
      // Clear form
      setOldPassword('')
      setNewPassword('')
      setConfirmPassword('')
      
      // Close modal after 2 seconds
      setTimeout(() => {
        setPasswordChangeSuccess('')
        setShowPasswordChangeModal(false)
      }, 2000)
    } catch (error) {
      setPasswordChangeError('Failed to change password: ' + error.message)
    } finally {
      setIsChangingPassword(false)
    }
  }

  const handleClosePasswordModal = () => {
    setShowPasswordChangeModal(false)
    setOldPassword('')
    setNewPassword('')
    setConfirmPassword('')
    setPasswordChangeError('')
    setPasswordChangeSuccess('')
  }

  const handleResetAll = () => {
    const confirmMessage = `Are you sure you want to reset everything?\n\nThis will:\n- Clear all winners list\n- Clear all selected winners\n- Reset spin count to 0\n- Clear removed entries\n- Reset all spin modes\n- Clear wheel data\n\nThis action cannot be undone!`
    
    if (window.confirm(confirmMessage)) {
      // Clear winners list from localStorage
      localStorage.removeItem('winnersList')
      
      // Clear selected winners
      localStorage.removeItem('selectedWinners')
      setSelectedWinners([])
      
      // Reset spin count
      localStorage.setItem('spinCount', '0')
      setCurrentSpinCount(0)
      window.dispatchEvent(new Event('spinCountReset'))
      
      // Clear removed entries
      localStorage.removeItem('removedEntries')
      
      // Reset spin modes
      localStorage.removeItem('spinModes')
      setSpinModes({})
      window.dispatchEvent(new Event('spinModeUpdated'))
      
      // Dispatch event to clear winners list in App.jsx
      window.dispatchEvent(new CustomEvent('resetAllWinners'))
      document.dispatchEvent(new CustomEvent('resetAllWinners'))
      
      // Dispatch event to reset wheel
      window.dispatchEvent(new CustomEvent('resetWheel'))
      document.dispatchEvent(new CustomEvent('resetWheel'))
      
      setSuccess('All data has been reset successfully!')
      setTimeout(() => setSuccess(''), 5000)
    }
  }

  // Filter entries based on search
  const filteredEntries = entries.filter(entry => {
    if (!searchQuery) return true
    const query = searchQuery.toLowerCase()
    const name = String(entry.name || '').toLowerCase()
    const ticketNumber = String(entry.ticketNumber || '').toLowerCase()
    const email = String(entry.email || '').toLowerCase()
    return (
      name.includes(query) ||
      ticketNumber.includes(query) ||
      email.includes(query)
    )
  })
  
  // Filter fixed winners based on search
  const filteredFixedWinners = entries.filter(entry => {
    if (!fixedWinnerSearch) return true
    const query = fixedWinnerSearch.toLowerCase()
    const name = String(entry.name || '').toLowerCase()
    const ticketNumber = String(entry.ticketNumber || '').toLowerCase()
    const email = String(entry.email || '').toLowerCase()
    return (
      name.includes(query) ||
      ticketNumber.includes(query) ||
      email.includes(query)
    )
  })

  // Password login screen
  if (!isAuthenticated) {
    return (
      <div className="admin-overlay" onClick={onClose}>
        <div className="admin-panel admin-panel-login" onClick={(e) => e.stopPropagation()}>
          <div className="admin-header">
            <h2>Admin Login</h2>
            <button className="admin-close-btn" onClick={onClose}>
              <FiX />
            </button>
          </div>
          <div className="admin-content">
            <form onSubmit={handlePasswordSubmit}>
              <div className="admin-field">
                <label>Password</label>
                <input
                  type="password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="Enter admin password"
                  required
                  autoFocus
                />
                {passwordError && (
                  <div className="admin-error" style={{ color: '#d82135', marginTop: '8px', fontSize: '14px' }}>
                    <FiAlertCircle style={{ marginRight: '4px', verticalAlign: 'middle' }} />
                    {passwordError}
                  </div>
                )}
              </div>
              <button type="submit" className="admin-submit-btn">
                Login
              </button>
            </form>
          </div>
        </div>
      </div>
    )
  }

  return (
    <div className="admin-overlay" onClick={onClose}>
      <div 
        ref={panelRef}
        className="admin-panel admin-panel-slide" 
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="admin-header">
          <h2 style={{ color: '#d82135' }}>Admin Panel</h2>
          <button className="admin-logout-btn" onClick={handleLogout}>
            <FiLogOut /> Logout
          </button>
        </div>

        <div className="admin-content-scroll">
          {/* Upload Excel Files Section */}
          <div className="admin-section">
            <h3 className="admin-section-title" style={{ color: '#d82135' }}>Upload Excel Files</h3>
            <div className="admin-upload-controls">
              <button 
                className="admin-choose-btn"
                onClick={() => excelInputRef.current?.click()}
              >
                Choose Files
              </button>
              <span className="admin-file-name">
                {excelFile ? excelFile.name : 'No file chosen'}
              </span>
            </div>
            <input
              ref={excelInputRef}
              type="file"
              accept=".xlsx,.xls,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet,application/vnd.ms-excel"
              onChange={handleExcelChange}
              style={{ display: 'none' }}
            />
            <div className="admin-field">
              <label>File Name</label>
              <input
                type="text"
                value={filename}
                onChange={(e) => setFilename(e.target.value)}
                placeholder="Enter filename"
                required
              />
            </div>
            <button 
              className="admin-upload-btn"
              onClick={handleUpload}
              disabled={isUploading || !excelFile}
            >
              {isUploading ? 'Uploading...' : 'Upload Files'}
            </button>
          </div>

          {/* Go to Spin Wheel Button */}
          {publishedEntries.length > 0 && (
            <div className="admin-section">
              <button 
                className="admin-goto-wheel-btn"
                onClick={() => {
                  if (onGoToWheel) {
                    onGoToWheel()
                  }
                  onClose()
                }}
              >
                Go to Spin Wheel
              </button>
            </div>
          )}

          {/* Publish to Wheel Section */}
          <div className="admin-section admin-section-card">
            <div className="admin-section-header">
              <FiSend style={{ color: '#d82135', marginRight: '8px' }} />
              <h3 className="admin-section-title" style={{ color: '#d82135' }}>Publish to Wheel</h3>
            </div>
            <div className="admin-status-box">
              <span>{publishedEntries.length} entries ready to publish</span>
            </div>
            <button 
              className="admin-publish-btn"
              onClick={handlePublishToWheel}
              disabled={isPublishing || entries.length === 0}
            >
              <FiSend style={{ marginRight: '8px' }} />
              Publish to Wheel
            </button>
          </div>

          {/* Spin Controls Section */}
          <div className="admin-section admin-section-card">
            <div className="admin-section-header">
              <FiShuffle style={{ color: '#d82135', marginRight: '8px' }} />
              <h3 className="admin-section-title" style={{ color: '#d82135' }}>Spin Controls</h3>
            </div>
            
            {/* Reset All Button */}
            <div style={{ 
              marginBottom: '16px',
              padding: '12px',
              backgroundColor: '#fff3cd',
              border: '2px solid #ffc107',
              borderRadius: '4px'
            }}>
              <div style={{ 
                display: 'flex', 
                justifyContent: 'space-between', 
                alignItems: 'center',
                marginBottom: '8px'
              }}>
                <div>
                  <strong style={{ color: '#856404', fontSize: '14px' }}>Reset All Data</strong>
                  <div style={{ fontSize: '12px', color: '#856404', marginTop: '4px' }}>
                    Clear all winners, spin count, entries, and wheel data
                  </div>
                </div>
                <button
                  onClick={handleResetAll}
                  style={{
                    backgroundColor: '#dc3545',
                    color: 'white',
                    border: 'none',
                    padding: '8px 16px',
                    borderRadius: '4px',
                    cursor: 'pointer',
                    display: 'flex',
                    alignItems: 'center',
                    gap: '6px',
                    fontSize: '13px',
                    fontWeight: '600',
                    transition: 'background-color 0.2s',
                    whiteSpace: 'nowrap'
                  }}
                  onMouseEnter={(e) => e.target.style.backgroundColor = '#c82333'}
                  onMouseLeave={(e) => e.target.style.backgroundColor = '#dc3545'}
                  title="Reset all data including winners, spin count, entries, and wheel"
                >
                  <FiRefreshCw style={{ fontSize: '14px' }} />
                  Reset All
                </button>
              </div>
            </div>
            {/* Change Password Button */}
            <div style={{ 
              marginBottom: '16px',
              padding: '12px',
              backgroundColor: '#e7f3ff',
              border: '2px solid #0066cc',
              borderRadius: '4px'
            }}>
              <div style={{ 
                display: 'flex', 
                justifyContent: 'space-between', 
                alignItems: 'center'
              }}>
                <div>
                  <strong style={{ color: '#004085', fontSize: '14px' }}>Change Admin Password</strong>
                  <div style={{ fontSize: '12px', color: '#004085', marginTop: '4px' }}>
                    Update your admin panel password
                  </div>
                </div>
                <button
                  onClick={() => setShowPasswordChangeModal(true)}
                  style={{
                    backgroundColor: '#0066cc',
                    color: 'white',
                    border: 'none',
                    padding: '8px 16px',
                    borderRadius: '4px',
                    cursor: 'pointer',
                    display: 'flex',
                    alignItems: 'center',
                    gap: '6px',
                    fontSize: '13px',
                    fontWeight: '600',
                    transition: 'background-color 0.2s',
                    whiteSpace: 'nowrap'
                  }}
                  onMouseEnter={(e) => e.target.style.backgroundColor = '#0052a3'}
                  onMouseLeave={(e) => e.target.style.backgroundColor = '#0066cc'}
                  title="Change admin password"
                >
                  <FiCheck style={{ fontSize: '14px' }} />
                  Change Password
                </button>
              </div>
            </div>
            
            <div className="admin-status-box" style={{ 
              backgroundColor: '#d1ecf1',
              borderColor: '#0c5460',
              color: '#0c5460',
              marginBottom: '16px',
              padding: '12px',
              borderRadius: '4px'
            }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <div>
                  <strong>Current Spin Count:</strong> {currentSpinCount}
                </div>
                <button
                  onClick={() => {
                    if (window.confirm('Are you sure you want to reset the spin count to 0? This will start counting from the beginning.')) {
                      localStorage.setItem('spinCount', '0')
                      setCurrentSpinCount(0)
                      // Dispatch event to update App.jsx state
                      window.dispatchEvent(new Event('spinCountReset'))
                      setSuccess('Spin count reset to 0')
                      setTimeout(() => setSuccess(''), 3000)
                    }
                  }}
                  style={{
                    backgroundColor: '#d82135',
                    color: 'white',
                    border: 'none',
                    padding: '6px 12px',
                    borderRadius: '4px',
                    cursor: 'pointer',
                    display: 'flex',
                    alignItems: 'center',
                    gap: '6px',
                    fontSize: '13px',
                    fontWeight: '500',
                    transition: 'background-color 0.2s'
                  }}
                  onMouseEnter={(e) => e.target.style.backgroundColor = '#b01e2e'}
                  onMouseLeave={(e) => e.target.style.backgroundColor = '#d82135'}
                  title="Reset spin count to 0"
                >
                  <FiRefreshCw style={{ fontSize: '14px' }} />
                  Reset Count
                </button>
              </div>
            </div>
            
            <div style={{ marginBottom: '16px' }}>
              <label style={{ display: 'block', marginBottom: '8px', fontWeight: '600', color: '#000', fontSize: '14px' }}>
                Configure Spin Modes (Set mode for each spin):
              </label>
              <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap', marginBottom: '12px' }}>
                {[1, 2, 3, 4, 5, 6, 7, 8, 9, 10].map(spinNum => (
                  <div key={spinNum} style={{ 
                    border: '1px solid #ddd', 
                    borderRadius: '4px', 
                    padding: '8px',
                    minWidth: '120px',
                    backgroundColor: '#fff'
                  }}>
                    <div style={{ fontSize: '13px', fontWeight: '600', marginBottom: '6px', color: '#000' }}>
                      {spinNum === 1 ? '1st' : spinNum === 2 ? '2nd' : spinNum === 3 ? '3rd' : `${spinNum}th`} Spin
                    </div>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                      <label style={{ display: 'flex', alignItems: 'center', cursor: 'pointer', fontSize: '13px' }}>
                        <input
                          type="radio"
                          name={`spinMode${spinNum}`}
                          value="random"
                          checked={spinModes[spinNum] === 'random' || !spinModes[spinNum]}
                          onChange={() => {
                            const newModes = { ...spinModes, [spinNum]: 'random' }
                            setSpinModes(newModes)
                            localStorage.setItem('spinModes', JSON.stringify(newModes))
                            window.dispatchEvent(new Event('spinModeUpdated'))
                          }}
                          style={{ marginRight: '6px', cursor: 'pointer' }}
                        />
                        <span style={{ color: '#000', fontWeight: '500' }}>Random</span>
                      </label>
                      <label style={{ display: 'flex', alignItems: 'center', cursor: 'pointer', fontSize: '13px' }}>
                        <input
                          type="radio"
                          name={`spinMode${spinNum}`}
                          value="fixed"
                          checked={spinModes[spinNum] === 'fixed'}
                          onChange={() => {
                            const newModes = { ...spinModes, [spinNum]: 'fixed' }
                            setSpinModes(newModes)
                            localStorage.setItem('spinModes', JSON.stringify(newModes))
                            window.dispatchEvent(new Event('spinModeUpdated'))
                          }}
                          style={{ marginRight: '6px', cursor: 'pointer' }}
                        />
                        <span style={{ color: '#000', fontWeight: '500' }}>Fixed</span>
                      </label>
                    </div>
                  </div>
                ))}
              </div>
            </div>
            
            {/* Show fixed winner selection for spins that are set to fixed */}
            {Object.keys(spinModes).some(spin => spinModes[spin] === 'fixed') && (
              <div className="admin-winner-select" style={{ marginTop: '16px' }}>
                <label style={{ display: 'block', marginBottom: '12px', fontWeight: '600', color: '#d82135', fontSize: '15px' }}>
                  Select Winners for Fixed Spins:
                </label>
                
                {/* Search box for filtering fixed winners - placed at top */}
                <div className="admin-search-box" style={{ 
                  marginBottom: '16px', 
                  marginTop: '8px',
                  backgroundColor: '#fff',
                  border: '2px solid #d82135',
                  borderRadius: '6px',
                  padding: '10px 12px'
                }}>
                  <FiSearch style={{ marginRight: '10px', color: '#d82135', fontSize: '18px' }} />
                  <input
                    type="text"
                    placeholder="Search winners by name, ticket number, or email..."
                    value={fixedWinnerSearch}
                    onChange={(e) => setFixedWinnerSearch(e.target.value)}
                    className="admin-search-input"
                    style={{ 
                      color: '#000', 
                      fontWeight: '500',
                      fontSize: '14px',
                      width: '100%',
                      border: 'none',
                      outline: 'none',
                      backgroundColor: 'transparent'
                    }}
                  />
                  {fixedWinnerSearch && (
                    <button
                      onClick={() => setFixedWinnerSearch('')}
                      style={{
                        background: 'none',
                        border: 'none',
                        color: '#888',
                        cursor: 'pointer',
                        padding: '0',
                        marginLeft: '8px',
                        fontSize: '18px',
                        display: 'flex',
                        alignItems: 'center'
                      }}
                      title="Clear search"
                    >
                      <FiX />
                    </button>
                  )}
                </div>
                
                {/* Show separate dropdown for each fixed spin - only for upcoming spins (not completed) */}
                {Object.keys(spinModes)
                  .filter(spin => {
                    const spinNum = Number(spin)
                    // Only show dropdowns for fixed spins that haven't been completed yet
                    return spinModes[spin] === 'fixed' && spinNum > currentSpinCount
                  })
                  .map(Number)
                  .sort((a, b) => a - b)
                  .map(spinNum => {
                    const spinLabel = spinNum === 1 ? '1st' : spinNum === 2 ? '2nd' : spinNum === 3 ? '3rd' : `${spinNum}th`
                    const selectedWinnerForSpin = selectedWinners.find(w => w.spin === spinNum)
                    
                    // Get all selected winner IDs (excluding current spin's selection)
                    const otherSelectedWinnerIds = selectedWinners
                      .filter(w => w.spin !== spinNum)
                      .map(w => w.winnerId)
                    
                    // Filter entries to exclude already selected winners (but include current selection)
                    const availableEntries = filteredFixedWinners.filter(entry => {
                      // Include if not selected for any other spin, OR if it's the current selection for this spin
                      return !otherSelectedWinnerIds.includes(entry.id) || 
                             (selectedWinnerForSpin && entry.id === selectedWinnerForSpin.winnerId)
                    })
                    
                    return (
                      <div key={spinNum} style={{ marginBottom: '16px' }}>
                        <label style={{ display: 'block', marginBottom: '6px', fontSize: '14px', fontWeight: '600', color: '#d82135' }}>
                          {spinLabel} Spin Winner:
                        </label>
                        <select
                          value={selectedWinnerForSpin ? selectedWinnerForSpin.winnerId : ''}
                          onChange={(e) => {
                            const winnerId = e.target.value
                            if (winnerId) {
                              // Find the entry
                              const entry = entries.find(e => e.id === winnerId)
                              if (entry) {
                                // Remove any existing winner for this spin
                                const updated = selectedWinners.filter(w => w.spin !== spinNum)
                                // Add new winner for this spin
                                updated.push({ 
                                  spin: spinNum, 
                                  winnerId: entry.id, 
                                  name: entry.name, 
                                  ticketNumber: entry.ticketNumber 
                                })
                                setSelectedWinners(updated)
                                localStorage.setItem('selectedWinners', JSON.stringify(updated))
                              }
                            } else {
                              // Remove winner for this spin
                              const updated = selectedWinners.filter(w => w.spin !== spinNum)
                              setSelectedWinners(updated)
                              localStorage.setItem('selectedWinners', JSON.stringify(updated))
                            }
                          }}
                          style={{
                            width: '100%',
                            padding: '10px 12px',
                            backgroundColor: '#fff',
                            border: '2px solid #ddd',
                            borderRadius: '4px',
                            color: '#000',
                            fontSize: '14px',
                            fontWeight: '500',
                            cursor: 'pointer'
                          }}
                        >
                          <option value="">-- Select Winner --</option>
                          {availableEntries
                            .filter(entry => {
                              // Filter by search if provided
                              if (fixedWinnerSearch) {
                                const searchLower = fixedWinnerSearch.toLowerCase()
                                const name = String(entry.name || '').toLowerCase()
                                const ticketNumber = String(entry.ticketNumber || '').toLowerCase()
                                const email = String(entry.email || '').toLowerCase()
                                return (
                                  name.includes(searchLower) ||
                                  ticketNumber.includes(searchLower) ||
                                  email.includes(searchLower)
                                )
                              }
                              return true
                            })
                            .map(entry => (
                              <option key={entry.id} value={entry.id} style={{ color: '#000', fontWeight: '500', backgroundColor: '#fff' }}>
                                {entry.name} {entry.ticketNumber ? `(${entry.ticketNumber})` : ''}
                              </option>
                            ))}
                        </select>
                        {selectedWinnerForSpin && (
                          <div style={{ marginTop: '6px', fontSize: '13px', color: '#000', fontWeight: '500', padding: '6px', backgroundColor: '#f0f0f0', borderRadius: '4px' }}>
                            Selected: <strong>{selectedWinnerForSpin.name}</strong> {selectedWinnerForSpin.ticketNumber ? `(${selectedWinnerForSpin.ticketNumber})` : ''}
                          </div>
                        )}
                      </div>
                    )
                  })}
                
                {/* Selected Winners Summary */}
                {selectedWinners.length > 0 && (() => {
                  // Count unique winners (by winnerId)
                  const uniqueWinnerIds = [...new Set(selectedWinners.map(w => w.winnerId))]
                  const uniqueCount = uniqueWinnerIds.length
                  
                  // Group selected winners by spin number
                  const winnersBySpin = {}
                  selectedWinners.forEach(w => {
                    if (!winnersBySpin[w.spin]) {
                      winnersBySpin[w.spin] = []
                    }
                    // Avoid duplicates
                    if (!winnersBySpin[w.spin].some(existing => existing.winnerId === w.winnerId)) {
                      winnersBySpin[w.spin].push(w)
                    }
                  })
                  
                  return (
                    <div style={{ marginTop: '12px' }}>
                      <div style={{ fontSize: '15px', color: '#000', marginBottom: '10px', fontWeight: '600' }}>
                        {uniqueCount} winner{uniqueCount > 1 ? 's' : ''} selected:
                      </div>
                      <div style={{ 
                        border: '1px solid #ddd', 
                        borderRadius: '4px', 
                        padding: '8px',
                        backgroundColor: '#f9f9f9',
                        maxHeight: '150px',
                        overflowY: 'auto'
                      }}>
                        {Object.keys(winnersBySpin).sort((a, b) => Number(a) - Number(b)).map(spinNum => {
                          const spinLabel = spinNum === '1' ? '1st' : spinNum === '2' ? '2nd' : spinNum === '3' ? '3rd' : `${spinNum}th`
                          return (
                            <div key={spinNum} style={{ marginBottom: '8px' }}>
                              <div style={{ fontSize: '14px', fontWeight: '700', color: '#000', marginBottom: '6px' }}>
                                {spinLabel} Spin:
                              </div>
                              {winnersBySpin[spinNum].map((winner, idx) => (
                                <div key={idx} style={{ 
                                  fontSize: '13px', 
                                  color: '#000', 
                                  fontWeight: '500',
                                  padding: '6px 10px',
                                  marginLeft: '12px',
                                  backgroundColor: '#fff',
                                  borderRadius: '4px',
                                  marginBottom: '4px',
                                  border: '1px solid #ddd'
                                }}>
                                  {winner.name} {winner.ticketNumber ? `(${winner.ticketNumber})` : ''}
                                </div>
                              ))}
                            </div>
                          )
                        })}
                      </div>
                    </div>
                  )
                })()}
              </div>
            )}
          </div>

          {/* Data Preview Section */}
          <div className="admin-section">
            <h3 className="admin-section-title" style={{ color: '#d82135' }}>
              Data Preview ({entries.length} entries)
            </h3>
            <div className="admin-search-box">
              <FiSearch style={{ marginRight: '8px', color: '#888' }} />
              <input
                type="text"
                placeholder="Search by name, ticket, or email..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="admin-search-input"
              />
            </div>
            <div className="admin-entries-list">
              {isLoadingEntries ? (
                <div className="admin-loading">Loading entries...</div>
              ) : filteredEntries.length === 0 ? (
                <div className="admin-no-entries">No entries found</div>
              ) : (
                filteredEntries.map(entry => (
                  <div key={entry.id} className="admin-entry-item">
                    <div className="admin-entry-name">{entry.name}</div>
                    {entry.ticketNumber && (
                      <div className="admin-entry-ticket">Ticket: {entry.ticketNumber}</div>
                    )}
                    {entry.email && (
                      <div className="admin-entry-email">{entry.email}</div>
                    )}
                  </div>
                ))
              )}
            </div>
          </div>

          {/* Error/Success Messages */}
          {error && (
            <div className="admin-error-message">
              <FiAlertCircle /> {error}
            </div>
          )}
          {success && (
            <div className="admin-success-message">
              <FiCheck /> {success}
            </div>
          )}
        </div>

        {/* Overwrite Confirmation Dialog */}
        {showOverwriteConfirm && (
          <div className="overwrite-confirm-dialog">
            <div className="overwrite-dialog-content">
              <h3>File Already Exists</h3>
              <p>A file with the name "{pendingUpload?.filename}" already exists. Do you want to overwrite it?</p>
              <div className="overwrite-dialog-buttons">
                <button className="admin-cancel-btn" onClick={() => {
                  setShowOverwriteConfirm(false)
                  setPendingUpload(null)
                  setError('')
                }}>
                  Cancel
                </button>
                <button className="admin-submit-btn" onClick={async () => {
                  if (!pendingUpload) return
                  setIsUploading(true)
                  setShowOverwriteConfirm(false)
                  try {
                    // Delete existing file if exists
                    const files = getStoredFiles()
                    const existingFile = files.find(f => f.filename === pendingUpload.filename)
                    if (existingFile) {
                      deleteFile(existingFile.id)
                    }
                    
                    // Parse and save new file
                    const jsonContent = await parseExcelFile(pendingUpload.excelFile)
                    let pictureBase64 = null
                    if (pendingUpload.pictureFile) {
                      pictureBase64 = await imageToBase64(pendingUpload.pictureFile)
                    }
                    
                    const fileData = {
                      filename: pendingUpload.filename.trim(),
                      json_content: jsonContent,
                      picture: pictureBase64,
                      active: true,
                      createdAt: new Date().toISOString()
                    }
                    
                    saveFile(fileData)
                    setSuccess('File uploaded successfully!')
                    await loadEntries()
                    setPendingUpload(null)
                    
                    // Notify parent component
                    if (onFileUploaded) {
                      onFileUploaded(fileData)
                    }
                  } catch (err) {
                    setError(err.message || 'Failed to upload file')
                  } finally {
                    setIsUploading(false)
                  }
                }}>
                  Overwrite
                </button>
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Password Change Modal */}
      {showPasswordChangeModal && (
        <div style={{
          position: 'fixed',
          top: 0,
          left: 0,
          right: 0,
          bottom: 0,
          backgroundColor: 'rgba(0, 0, 0, 0.7)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          zIndex: 10000,
          padding: '20px'
        }} onClick={handleClosePasswordModal}>
          <div style={{
            backgroundColor: '#fff',
            borderRadius: '8px',
            padding: '24px',
            maxWidth: '500px',
            width: '100%',
            maxHeight: '90vh',
            overflowY: 'auto',
            boxShadow: '0 4px 20px rgba(0, 0, 0, 0.3)'
          }} onClick={(e) => e.stopPropagation()}>
            {/* Modal Header */}
            <div style={{
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'center',
              marginBottom: '20px',
              paddingBottom: '12px',
              borderBottom: '2px solid #d82135'
            }}>
              <h3 style={{ 
                color: '#d82135', 
                fontSize: '20px', 
                fontWeight: '700',
                margin: 0,
                display: 'flex',
                alignItems: 'center',
                gap: '8px'
              }}>
                <FiCheck />
                Change Password
              </h3>
              <button
                onClick={handleClosePasswordModal}
                style={{
                  background: 'none',
                  border: 'none',
                  fontSize: '24px',
                  color: '#666',
                  cursor: 'pointer',
                  padding: '0',
                  width: '30px',
                  height: '30px',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  borderRadius: '4px',
                  transition: 'background-color 0.2s'
                }}
                onMouseEnter={(e) => e.target.style.backgroundColor = '#f0f0f0'}
                onMouseLeave={(e) => e.target.style.backgroundColor = 'transparent'}
                title="Close"
              >
                <FiX />
              </button>
            </div>

            {/* Modal Form */}
            <form onSubmit={handleChangePassword}>
              <div className="admin-field" style={{ marginBottom: '16px' }}>
                <label style={{ display: 'block', marginBottom: '8px', fontWeight: '600', color: '#000', fontSize: '14px' }}>
                  Current Password
                </label>
                <input
                  type="password"
                  value={oldPassword}
                  onChange={(e) => setOldPassword(e.target.value)}
                  placeholder="Enter current password"
                  style={{
                    width: '100%',
                    padding: '10px 14px',
                    border: '1px solid #ddd',
                    borderRadius: '4px',
                    fontSize: '14px',
                    color: '#000',
                    backgroundColor: '#fff',
                    boxSizing: 'border-box'
                  }}
                />
              </div>
              
              <div className="admin-field" style={{ marginBottom: '16px' }}>
                <label style={{ display: 'block', marginBottom: '8px', fontWeight: '600', color: '#000', fontSize: '14px' }}>
                  New Password
                </label>
                <input
                  type="password"
                  value={newPassword}
                  onChange={(e) => setNewPassword(e.target.value)}
                  placeholder="Enter new password (min 4 characters)"
                  style={{
                    width: '100%',
                    padding: '10px 14px',
                    border: '1px solid #ddd',
                    borderRadius: '4px',
                    fontSize: '14px',
                    color: '#000',
                    backgroundColor: '#fff',
                    boxSizing: 'border-box'
                  }}
                />
              </div>
              
              <div className="admin-field" style={{ marginBottom: '16px' }}>
                <label style={{ display: 'block', marginBottom: '8px', fontWeight: '600', color: '#000', fontSize: '14px' }}>
                  Confirm New Password
                </label>
                <input
                  type="password"
                  value={confirmPassword}
                  onChange={(e) => setConfirmPassword(e.target.value)}
                  placeholder="Confirm new password"
                  style={{
                    width: '100%',
                    padding: '10px 14px',
                    border: '1px solid #ddd',
                    borderRadius: '4px',
                    fontSize: '14px',
                    color: '#000',
                    backgroundColor: '#fff',
                    boxSizing: 'border-box'
                  }}
                />
              </div>
              
              {passwordChangeError && (
                <div style={{
                  marginBottom: '16px',
                  padding: '10px 14px',
                  backgroundColor: '#f8d7da',
                  border: '1px solid #f5c6cb',
                  borderRadius: '4px',
                  color: '#721c24',
                  fontSize: '13px',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '8px'
                }}>
                  <FiAlertCircle />
                  {passwordChangeError}
                </div>
              )}
              
              {passwordChangeSuccess && (
                <div style={{
                  marginBottom: '16px',
                  padding: '10px 14px',
                  backgroundColor: '#d4edda',
                  border: '1px solid #c3e6cb',
                  borderRadius: '4px',
                  color: '#155724',
                  fontSize: '13px',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '8px'
                }}>
                  <FiCheck />
                  {passwordChangeSuccess}
                </div>
              )}
              
              {/* Modal Buttons */}
              <div style={{
                display: 'flex',
                gap: '12px',
                justifyContent: 'flex-end',
                marginTop: '24px',
                paddingTop: '16px',
                borderTop: '1px solid #eee'
              }}>
                <button
                  type="button"
                  onClick={handleClosePasswordModal}
                  style={{
                    backgroundColor: '#6c757d',
                    color: 'white',
                    border: 'none',
                    padding: '10px 20px',
                    borderRadius: '4px',
                    fontSize: '14px',
                    fontWeight: '600',
                    cursor: 'pointer',
                    transition: 'background-color 0.2s'
                  }}
                  onMouseEnter={(e) => e.target.style.backgroundColor = '#5a6268'}
                  onMouseLeave={(e) => e.target.style.backgroundColor = '#6c757d'}
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={isChangingPassword}
                  style={{
                    backgroundColor: '#d82135',
                    color: 'white',
                    border: 'none',
                    padding: '10px 20px',
                    borderRadius: '4px',
                    fontSize: '14px',
                    fontWeight: '600',
                    cursor: isChangingPassword ? 'not-allowed' : 'pointer',
                    opacity: isChangingPassword ? 0.6 : 1,
                    transition: 'background-color 0.2s',
                    display: 'flex',
                    alignItems: 'center',
                    gap: '8px'
                  }}
                  onMouseEnter={(e) => {
                    if (!isChangingPassword) {
                      e.target.style.backgroundColor = '#b01e2e'
                    }
                  }}
                  onMouseLeave={(e) => {
                    if (!isChangingPassword) {
                      e.target.style.backgroundColor = '#d82135'
                    }
                  }}
                >
                  {isChangingPassword ? (
                    <>
                      <FiRefreshCw style={{ animation: 'spin 1s linear infinite' }} />
                      Changing...
                    </>
                  ) : (
                    <>
                      <FiCheck />
                      Change Password
                    </>
                  )}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  )
}

export default AdminPanel
