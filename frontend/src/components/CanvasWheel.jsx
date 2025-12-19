import React, { useRef, useEffect, memo } from 'react'

const CanvasWheel = memo(({ names, colors, rotation, width = 800, height = 800, centerImage = null, centerImageSize = 'M', isSpinning = false, showTextDuringSpin = false }) => {
    const canvasRef = useRef(null)
    const centerImageLoadedRef = useRef(null)
    const offscreenCanvasRef = useRef(null) // Cache for static wheel segments
    const wheelCacheRef = useRef({ namesHash: '', radius: 0, valid: false })
    const centerImageCacheRef = useRef(null) // Cache for center image rendering
    const centerImageCacheSizeRef = useRef({ width: 0, height: 0, size: '' })

    useEffect(() => {
        const canvas = canvasRef.current
        // Use optimized context settings for smooth animation
        // IMPORTANT: alpha: true ensures transparent background (critical for mobile)
        const ctx = canvas.getContext('2d', {
            alpha: true, // This is crucial - makes canvas transparent instead of black
            desynchronized: true, // Better performance for animations
            willReadFrequently: false,
            powerPreference: 'high-performance' // Use dedicated GPU if available
        })
        
        // Ensure canvas element itself has no background (extra safety for mobile)
        canvas.style.background = 'transparent'
        canvas.style.backgroundColor = 'transparent'
        
        // Optimize context settings for large lists
        if (names.length > 2000) {
            // Reduce quality for better performance
            ctx.imageSmoothingEnabled = names.length < 3000
            ctx.imageSmoothingQuality = names.length > 3000 ? 'low' : 'medium'
        }
        // Reduce DPR for many entries to improve performance
        const baseDpr = window.devicePixelRatio || 1
        let dpr = baseDpr
        if (names.length > 5000) {
            dpr = 1 // Force 1x for very large lists
        } else if (names.length > 3000) {
            dpr = Math.min(baseDpr, 1.2)
        } else if (names.length > 2000) {
            dpr = Math.min(baseDpr, 1.5)
        }

        // Throttle resize for better performance with many entries
        let resizeTimeout = null
        const handleResize = () => {
            // Clear previous timeout
            if (resizeTimeout) {
                clearTimeout(resizeTimeout)
            }
            
            // Aggressive throttling for very large lists
            let throttleDelay = 0
            if (names.length > 5000) {
                throttleDelay = 150
            } else if (names.length > 3000) {
                throttleDelay = 100
            } else if (names.length > 2000) {
                throttleDelay = 50
            }
            
            resizeTimeout = setTimeout(() => {
                const displayWidth = canvas.clientWidth || width
                const displayHeight = canvas.clientHeight || height

                // CRITICAL MOBILE FIX: Set canvas element style BEFORE setting dimensions
                // Mobile browsers sometimes apply default black background
                canvas.style.background = 'transparent'
                canvas.style.backgroundColor = 'transparent'
                
                // Set actual size in memory (scaled to account for extra pixel density)
                // Note: Setting width/height resets the canvas, so we need to ensure transparency
                canvas.width = displayWidth * dpr
                canvas.height = displayHeight * dpr
                
                // CRITICAL FIX FOR MOBILE: Canvas reset ho gaya hai
                // Mobile browsers mein canvas reset ke baad black background dikh sakta hai
                // Immediately clear entire canvas to transparent (BEFORE scaling)
                // Use actual pixel dimensions (not scaled)
                ctx.clearRect(0, 0, displayWidth * dpr, displayHeight * dpr)
                
                // Normalize coordinate system to use css pixels
                ctx.scale(dpr, dpr)
                
                // MOBILE FIX: Clear again after scaling to ensure transparency
                // Some mobile browsers need this double clear
                ctx.clearRect(0, 0, displayWidth, displayHeight)
                
                // Ensure composite operation allows transparency
                ctx.globalCompositeOperation = 'source-over'
                
                // MOBILE FIX: Re-apply canvas style after reset (some browsers reset styles too)
                canvas.style.background = 'transparent'
                canvas.style.backgroundColor = 'transparent'
                
                // Enable image smoothing for better quality
                ctx.imageSmoothingEnabled = true
                ctx.imageSmoothingQuality = 'high'
                
                // Performance optimizations for many entries
                if (names.length > 3000) {
                    // Reduce quality significantly for very large lists
                    ctx.imageSmoothingQuality = 'low'
                } else if (names.length > 1000) {
                    // Reduce quality slightly for better performance with many entries
                    ctx.imageSmoothingQuality = 'medium'
                }

                const centerX = displayWidth / 2
                const centerY = displayHeight / 2
                // FIXED 20px padding (Matches App.css)
                const radius = Math.min(centerX, centerY) - 20

                drawWheel(centerX, centerY, radius, displayWidth, displayHeight)
            }, throttleDelay)
        }

        const resizeObserver = new ResizeObserver(() => {
            handleResize()
        })
        resizeObserver.observe(canvas)
        
        // Ultra-aggressive throttling for very large entry counts
        let lastDrawTime = 0
        let frameSkipCounter = 0
        let minDrawInterval = 0
        let frameSkipRate = 1 // Draw every frame by default
        
        if (names.length > 5000) {
            minDrawInterval = 50 // ~20fps for 5000+ (more aggressive)
            frameSkipRate = 4 // Skip 3 out of 4 frames
        } else if (names.length > 3000) {
            minDrawInterval = 33 // ~30fps for 3000+ (more aggressive)
            frameSkipRate = 3 // Skip 2 out of 3 frames
        } else if (names.length > 2000) {
            minDrawInterval = 25 // ~40fps for 2000+
            frameSkipRate = 2 // Skip every other frame
        } else if (names.length > 1000) {
            minDrawInterval = 16 // ~60fps for 1000+
            frameSkipRate = 1
        }
        
        // Create offscreen canvas for caching static wheel (for 2000+ entries)
        const useOffscreenCache = names.length > 2000
        if (useOffscreenCache && !offscreenCanvasRef.current) {
            offscreenCanvasRef.current = document.createElement('canvas')
        }
        
        const throttledDraw = () => {
            const now = performance.now()
            frameSkipCounter++
            
            // Skip frames for very large lists
            if (frameSkipCounter % frameSkipRate !== 0 && names.length > 2000) {
                return
            }
            
            if (now - lastDrawTime >= minDrawInterval) {
                const displayWidth = canvas.clientWidth || width
                const displayHeight = canvas.clientHeight || height
                const centerX = displayWidth / 2
                const centerY = displayHeight / 2
                const radius = Math.min(centerX, centerY) - 20
                drawWheel(centerX, centerY, radius, displayWidth, displayHeight)
                lastDrawTime = now
            }
        }
        
        // Initial draw
        throttledDraw()
        
        // Use requestAnimationFrame for smooth updates
        let rafId = null
        const scheduleDraw = () => {
            if (rafId) return
            rafId = requestAnimationFrame(() => {
                throttledDraw()
                rafId = null
            })
        }
        
        // Schedule draw when rotation changes (effect runs when rotation changes)
        scheduleDraw()
        
        // Invalidate cache when names or colors change
        const namesHash = `${names.length}-${colors.slice(0, 10).join(',')}`
        if (wheelCacheRef.current.namesHash !== namesHash) {
            wheelCacheRef.current.valid = false
        }

        // Load center image when it changes
        if (centerImage) {
            // Only load if not already loaded or if URL changed
            if (!centerImageLoadedRef.current || centerImageLoadedRef.current.src !== centerImage) {
                // Invalidate image cache when image changes
                centerImageCacheRef.current = null
                centerImageCacheSizeRef.current = { width: 0, height: 0, size: '' }
                
                const img = new Image()
                img.crossOrigin = 'anonymous'
                img.onload = () => {
                    centerImageLoadedRef.current = img
                    // Invalidate cache to force recreation
                    centerImageCacheRef.current = null
                    // Force immediate redraw after image loads
                    setTimeout(() => {
                        const displayWidth = canvas.clientWidth || width
                        const displayHeight = canvas.clientHeight || height
                        const centerX = displayWidth / 2
                        const centerY = displayHeight / 2
                        const radius = Math.min(centerX, centerY) - 20
                        drawWheel(centerX, centerY, radius, displayWidth, displayHeight)
                    }, 50)
                }
                img.onerror = (error) => {
                    console.error('Failed to load center image:', centerImage, error)
                    centerImageLoadedRef.current = null
                    centerImageCacheRef.current = null
                }
                if (typeof centerImage === 'string') {
                    img.src = centerImage
                }
            } else {
                // Check if image size changed - invalidate cache if needed
                if (centerImageCacheSizeRef.current.size !== centerImageSize) {
                    centerImageCacheRef.current = null
                    centerImageCacheSizeRef.current = { width: 0, height: 0, size: centerImageSize }
                }
            }
        } else {
            centerImageLoadedRef.current = null
            centerImageCacheRef.current = null
            centerImageCacheSizeRef.current = { width: 0, height: 0, size: '' }
        }

        // Initial Draw
        handleResize()

        // Helper to draw the wheel (extracted for reuse)
        function drawWheel(centerX, centerY, radius, displayWidth, displayHeight) {
            // Clear canvas - this should make it transparent with alpha: true
            ctx.clearRect(0, 0, displayWidth, displayHeight)

            const numSegments = names.length
            const sliceAngle = (2 * Math.PI) / numSegments

            // For many entries, use simpler rendering
            const isManyEntries = names.length > 2000
            const isVeryManyEntries = names.length > 5000
            const isExtremelyManyEntries = names.length > 3000
            
            // Cache key for wheel segments (only changes when names/colors/radius change)
            const cacheKey = `${names.length}-${radius}-${colors.slice(0, 10).join(',')}`
            const cacheValid = wheelCacheRef.current.valid && 
                              wheelCacheRef.current.namesHash === cacheKey &&
                              wheelCacheRef.current.radius === radius
            
            // For very many entries, disable expensive operations
            if (isExtremelyManyEntries) {
                ctx.imageSmoothingEnabled = false
            }
            
            // Save context for wheel rotation
            ctx.save()
            ctx.translate(centerX, centerY)
            ctx.rotate((rotation * Math.PI) / 180)

            // Draw Shadow (behind the wheel) - Skip for many entries for performance
            if (names.length < 2000) {
                ctx.save()
                ctx.shadowColor = 'rgba(0, 0, 0, 0.3)'
                ctx.shadowBlur = 15
                ctx.shadowOffsetY = 10
                ctx.beginPath()
                ctx.arc(0, 0, radius, 0, 2 * Math.PI)
                ctx.fillStyle = 'rgba(0,0,0,0)'
                ctx.fill()
                ctx.restore()
            }

            // Aggressive performance optimization for many entries (already declared above)
            
            // Performance optimization: Skip text rendering for very small slices
            const minSliceAngleForText = names.length > 500 ? 0.01 : 0.001
            
            // Show text based on spin state and entry count
            // Hide text during spin (except 5 seconds before stop), show when not spinning
            // Also hide for very large lists (500+) for performance
            const shouldShowText = names.length < 500 && (!isSpinning || showTextDuringSpin)
            
            // Performance: Skip shadow for many entries
            const shouldDrawShadow = names.length < 1000
            
            // Performance: Skip gradient for many entries (more aggressive for smooth spinning)
            // For 3000+, always skip gradients
            const shouldDrawGradient = names.length < 300 && !isExtremelyManyEntries
            
            // For very many entries, skip strokes entirely (more aggressive for smooth spinning)
            // For 3000+, always skip strokes
            const shouldDrawStrokes = names.length < 500 && !isExtremelyManyEntries
            
            // Use cached offscreen canvas for 2000+ entries if cache is valid
            if (useOffscreenCache && cacheValid && offscreenCanvasRef.current) {
                // Just rotate and draw cached wheel
                ctx.drawImage(offscreenCanvasRef.current, -radius - 20, -radius - 20, (radius + 20) * 2, (radius + 20) * 2)
            } else {
                // Draw wheel segments (and cache if needed)
                if (useOffscreenCache && offscreenCanvasRef.current) {
                    // Draw to offscreen canvas first
                    const offscreenCtx = offscreenCanvasRef.current.getContext('2d', {
                        alpha: true,
                        desynchronized: true,
                        willReadFrequently: false
                    })
                    const cacheSize = (radius + 20) * 2
                    offscreenCanvasRef.current.width = cacheSize
                    offscreenCanvasRef.current.height = cacheSize
                    // Immediately clear to transparent after reset (important for mobile)
                    offscreenCtx.clearRect(0, 0, cacheSize, cacheSize)
                    // Ensure offscreen canvas also has transparent background
                    offscreenCanvasRef.current.style.background = 'transparent'
                    offscreenCanvasRef.current.style.backgroundColor = 'transparent'
                    offscreenCtx.translate(cacheSize / 2, cacheSize / 2)
                    
                    // Draw segments to cache
                    if (isExtremelyManyEntries) {
                        // Ultra-fast path: Just draw filled arcs without any extras
                        names.forEach((name, index) => {
                            const startAngle = index * sliceAngle - Math.PI / 2
                            const endAngle = startAngle + sliceAngle
                            offscreenCtx.beginPath()
                            offscreenCtx.moveTo(0, 0)
                            offscreenCtx.arc(0, 0, radius, startAngle, endAngle)
                            offscreenCtx.closePath()
                            offscreenCtx.fillStyle = colors[index % colors.length]
                            offscreenCtx.fill()
                        })
                    } else {
                        // Standard path with some optimizations
                        names.forEach((name, index) => {
                            const startAngle = index * sliceAngle - Math.PI / 2
                            const endAngle = startAngle + sliceAngle
                            offscreenCtx.beginPath()
                            offscreenCtx.moveTo(0, 0)
                            offscreenCtx.arc(0, 0, radius, startAngle, endAngle)
                            offscreenCtx.closePath()
                            offscreenCtx.fillStyle = colors[index % colors.length]
                            offscreenCtx.fill()
                        })
                    }
                    
                    // Reset transform
                    offscreenCtx.setTransform(1, 0, 0, 1, 0, 0)
                    
                    // Update cache
                    wheelCacheRef.current = {
                        namesHash: cacheKey,
                        radius: radius,
                        valid: true
                    }
                    
                    // Draw cached wheel to main canvas (already in rotation context)
                    ctx.drawImage(offscreenCanvasRef.current, -cacheSize / 2, -cacheSize / 2)
                } else {
                    // Draw directly (for smaller lists or when caching disabled)
                    // Batch draw segments for better performance
                    // For very large lists, skip expensive operations
                    // Use optimized batch drawing for 3000+ entries
                    if (isExtremelyManyEntries) {
                        // Ultra-fast path: Just draw filled arcs without any extras
                        names.forEach((name, index) => {
                            const startAngle = index * sliceAngle - Math.PI / 2
                            const endAngle = startAngle + sliceAngle
                            ctx.beginPath()
                            ctx.moveTo(0, 0)
                            ctx.arc(0, 0, radius, startAngle, endAngle)
                            ctx.closePath()
                            ctx.fillStyle = colors[index % colors.length]
                            ctx.fill()
                        })
                    } else {
                        names.forEach((name, index) => {
                            // 0 degrees in standard canvas is 3 o'clock. 
                            // We want index 0 to start at -90 degrees (12 o'clock)
                            const startAngle = index * sliceAngle - Math.PI / 2
                            const endAngle = startAngle + sliceAngle

                            // Draw Segment - optimized path (minimal operations)
                            ctx.beginPath()
                            ctx.moveTo(0, 0)
                            ctx.arc(0, 0, radius, startAngle, endAngle)
                            ctx.closePath()

                            ctx.fillStyle = colors[index % colors.length]
                            ctx.fill()

                            // Add "Shine" / Gradient Depth (skip for very large lists to improve performance)
                            if (shouldDrawGradient && !isManyEntries) {
                                const gradient = ctx.createRadialGradient(0, 0, 0, 0, 0, radius)
                                gradient.addColorStop(0, 'rgba(255, 255, 255, 0.1)')
                                gradient.addColorStop(0.6, 'rgba(255, 255, 255, 0)')
                                gradient.addColorStop(1, 'rgba(0, 0, 0, 0.1)')
                                ctx.fillStyle = gradient
                                ctx.fill()
                            }

                            // Adjust stroke width based on number of segments for better visibility
                            // For many entries, skip strokes entirely for performance
                            if (shouldDrawStrokes) {
                                const strokeWidth = names.length > 500 ? 0.5 : 1
                                ctx.lineWidth = strokeWidth
                                ctx.strokeStyle = names.length > 500 ? 'rgba(0,0,0,0.05)' : 'rgba(0,0,0,0.1)'
                                ctx.stroke()
                            }

                            // Draw Text only if slice is large enough and we should show text
                            if (shouldShowText && sliceAngle >= minSliceAngleForText) {
                                ctx.save()
                                const midAngle = startAngle + sliceAngle / 2
                                ctx.rotate(midAngle)

                                ctx.textAlign = 'right'
                                ctx.textBaseline = 'middle'

                                const bgColor = colors[index % colors.length]
                                if (bgColor === '#efb71d' || bgColor === '#24a643') {
                                    ctx.fillStyle = '#000000'
                                } else {
                                    ctx.fillStyle = '#FFFFFF'
                                }

                                // Dynamic font sizing
                                const textRadius = radius - 20
                                const arcLength = textRadius * sliceAngle
                                const isMobile = window.innerWidth < 768
                                let computedSize = arcLength / (isMobile ? 4.5 : 6)
                                const minSize = isMobile ? 8 : 10 // Smaller min size for large lists
                                const maxSize = isMobile ? 42 : 40
                                let fontSize = Math.max(minSize, Math.min(maxSize, computedSize))

                                ctx.font = `500 ${fontSize}px "Montserrat", sans-serif`

                                ctx.shadowColor = 'rgba(0,0,0,0.2)'
                                ctx.shadowBlur = 2
                                ctx.shadowOffsetX = 1
                                ctx.shadowOffsetY = 1

                                // Truncate long names for very small slices
                                let displayName = name
                                if (names.length > 500 && name.length > 10) {
                                    displayName = name.substring(0, 10) + '...'
                                }

                                ctx.fillText(displayName, radius - 25, 0)
                                ctx.restore()
                            }
                        })
                    }
                }
            }

            // Draw Center Hub and Image INSIDE the rotation context (so image rotates with wheel)
            const isMobile = window.innerWidth < 768
            // Increased hub radius for bigger center circle
            const hubRadius = isMobile ? 35 : 70

            // Draw Center Circle (Hub) - Smaller on Mobile
            ctx.beginPath()
            ctx.arc(0, 0, hubRadius, 0, 2 * Math.PI)
            ctx.fillStyle = 'white'
            // Skip shadow for very large lists to improve performance
            if (!isExtremelyManyEntries) {
                ctx.shadowColor = 'rgba(0,0,0,0.2)'
                ctx.shadowBlur = 5
            }
            ctx.fill()
            
            // Draw center image if provided and loaded (INSIDE rotation context so it rotates with wheel)
            // Always show image - optimize rendering quality for large lists instead of hiding
            const shouldDrawImage = centerImageLoadedRef.current && 
                centerImageLoadedRef.current.complete && 
                centerImageLoadedRef.current.naturalWidth > 0
            
            if (shouldDrawImage) {
                try {
                    // Calculate image size based on size setting
                    // Increased image size to match bigger center circle
                    let imageRadius
                    if (centerImageSize === 'S') {
                        imageRadius = hubRadius * 0.7 // Small (increased from 0.6)
                    } else if (centerImageSize === 'L') {
                        imageRadius = hubRadius * 1.3 // Large (increased from 1.2)
                    } else {
                        imageRadius = hubRadius * 1.0 // Medium (increased from 0.9 to fill circle better)
                    }
                    
                    // Cache image rendering for better performance (only recreate if size changed)
                    const cacheKey = `${imageRadius}-${hubRadius}-${centerImageSize}`
                    const imageCacheValid = centerImageCacheRef.current && 
                                          centerImageCacheSizeRef.current.width === imageRadius * 2 &&
                                          centerImageCacheSizeRef.current.size === centerImageSize
                    
                    // Use cached image for large lists to improve performance
                    if (names.length > 2000 && imageCacheValid && centerImageCacheRef.current) {
                        // Draw cached image (much faster - no clip operation needed)
                        ctx.drawImage(
                            centerImageCacheRef.current,
                            -imageRadius,
                            -imageRadius,
                            imageRadius * 2,
                            imageRadius * 2
                        )
                    } else {
                        // Draw image directly (for smaller lists or when cache invalid)
                        ctx.save()
                        
                        // Optimize image smoothing for large lists
                        if (names.length > 3000) {
                            ctx.imageSmoothingEnabled = false
                        } else if (names.length > 2000) {
                            ctx.imageSmoothingEnabled = true
                            ctx.imageSmoothingQuality = 'low'
                        } else {
                            ctx.imageSmoothingEnabled = true
                            ctx.imageSmoothingQuality = 'high'
                        }
                        
                        // Skip clip for very large lists to improve performance
                        if (names.length < 3000) {
                            ctx.beginPath()
                            ctx.arc(0, 0, imageRadius, 0, 2 * Math.PI)
                            ctx.clip()
                        }
                        
                        // Draw image centered
                        ctx.drawImage(
                            centerImageLoadedRef.current, 
                            -imageRadius, 
                            -imageRadius, 
                            imageRadius * 2, 
                            imageRadius * 2
                        )
                        ctx.restore()
                        
                        // Cache the image for future frames (for large lists)
                        if (names.length > 2000 && !imageCacheValid) {
                            // Create offscreen canvas for image cache
                            if (!centerImageCacheRef.current) {
                                centerImageCacheRef.current = document.createElement('canvas')
                            }
                            const cacheCtx = centerImageCacheRef.current.getContext('2d', {
                                alpha: true,
                                desynchronized: true
                            })
                            const cacheSize = imageRadius * 2
                            centerImageCacheRef.current.width = cacheSize
                            centerImageCacheRef.current.height = cacheSize
                            
                            // Draw image to cache
                            cacheCtx.save()
                            cacheCtx.beginPath()
                            cacheCtx.arc(imageRadius, imageRadius, imageRadius, 0, 2 * Math.PI)
                            cacheCtx.clip()
                            cacheCtx.drawImage(
                                centerImageLoadedRef.current,
                                0,
                                0,
                                cacheSize,
                                cacheSize
                            )
                            cacheCtx.restore()
                            
                            // Update cache info
                            centerImageCacheSizeRef.current = {
                                width: cacheSize,
                                height: cacheSize,
                                size: centerImageSize
                            }
                        }
                    }
                } catch (error) {
                    console.error('Error drawing center image:', error)
                }
            }

            ctx.restore()
        }

        return () => {
            resizeObserver.disconnect()
            if (resizeTimeout) {
                clearTimeout(resizeTimeout)
            }
            if (rafId) {
                cancelAnimationFrame(rafId)
            }
            // Clean up image cache on unmount
            centerImageCacheRef.current = null
        }
    }, [names, colors, rotation, width, height, centerImage, centerImageSize, isSpinning, showTextDuringSpin])

    return (
        <canvas
            ref={canvasRef}
            style={{
                width: '100%',
                height: '100%',
                touchAction: 'none',
                background: 'transparent',
                backgroundColor: 'transparent',
                // GPU acceleration for better performance
                willChange: names.length > 2000 ? 'transform' : 'auto',
                transform: 'translateZ(0)',
                WebkitBackfaceVisibility: 'hidden',
                backfaceVisibility: 'hidden',
                WebkitPerspective: '1000px',
                perspective: '1000px'
            }}
        />
    )
})

CanvasWheel.displayName = 'CanvasWheel'

export default CanvasWheel
