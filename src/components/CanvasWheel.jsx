import React, { useRef, useEffect } from 'react'

const CanvasWheel = ({ names, colors, rotation, width = 800, height = 800 }) => {
    const canvasRef = useRef(null)

    useEffect(() => {
        const canvas = canvasRef.current
        const ctx = canvas.getContext('2d')

        // Handle High DPI displays
        const dpr = window.devicePixelRatio || 1
        // Use container dimensions if provided, otherwise client dimensions
        // We rely on the parent container sizing usually, but since we are replacing an SVG 
        // that had viewBox="0 0 750 750", we want a high res internal buffer.
        const displayWidth = canvas.clientWidth || width
        const displayHeight = canvas.clientHeight || height

        // Set actual size in memory (scaled to account for extra pixel density)
        canvas.width = displayWidth * dpr
        canvas.height = displayHeight * dpr

        // Normalize coordinate system to use css pixels
        ctx.scale(dpr, dpr)

        const centerX = displayWidth / 2
        const centerY = displayHeight / 2
        // Radius should fit within the smallest dimension
        const radius = Math.min(centerX, centerY) - 20

        // Clear canvas
        ctx.clearRect(0, 0, displayWidth, displayHeight)

        const numSegments = names.length
        const sliceAngle = (2 * Math.PI) / numSegments

        // Save context for wheel rotation
        ctx.save()
        ctx.translate(centerX, centerY)
        ctx.rotate((rotation * Math.PI) / 180)

        // Draw Shadow (behind the wheel)
        ctx.save()
        ctx.shadowColor = 'rgba(0, 0, 0, 0.3)'
        ctx.shadowBlur = 15
        ctx.shadowOffsetY = 10
        ctx.beginPath()
        ctx.arc(0, 0, radius, 0, 2 * Math.PI)
        ctx.fillStyle = 'rgba(0,0,0,0)'
        ctx.fill()
        ctx.restore()

        names.forEach((name, index) => {
            // 0 degrees in standard canvas is 3 o'clock. 
            // We want index 0 to start at -90 degrees (12 o'clock)
            const startAngle = index * sliceAngle - Math.PI / 2
            const endAngle = startAngle + sliceAngle

            // Draw Segment
            ctx.beginPath()
            ctx.moveTo(0, 0)
            ctx.arc(0, 0, radius, startAngle, endAngle)
            ctx.closePath()

            ctx.fillStyle = colors[index % colors.length]
            ctx.fill()

            // Add "Shine" / Gradient Depth
            // Create a radial gradient that overlays the segment color
            // This gives it the "3D" look seen in the reference
            const gradient = ctx.createRadialGradient(0, 0, 0, 0, 0, radius)
            // Center is lighter (shine), outer is transparent or slightly darker
            // Image 1 shows a sort of highlight near the center
            // Ultra HD: Reduced opacity to 0.1 so colors pop
            gradient.addColorStop(0, 'rgba(255, 255, 255, 0.1)')
            gradient.addColorStop(0.6, 'rgba(255, 255, 255, 0)')
            gradient.addColorStop(1, 'rgba(0, 0, 0, 0.1)') // Slight shadow at rim

            ctx.fillStyle = gradient
            ctx.fill()

            ctx.lineWidth = 1
            ctx.strokeStyle = 'rgba(0,0,0,0.1)'
            ctx.stroke()

            // Draw Text
            ctx.save()
            // Rotate to the middle of the segment
            const midAngle = startAngle + sliceAngle / 2
            ctx.rotate(midAngle)

            // Configure Text
            ctx.textAlign = 'right'
            ctx.textBaseline = 'middle'

            const bgColor = colors[index % colors.length]
            // Contrast check: if yellow (#efb71d) or green (#24a643), use black, else white.
            if (bgColor === '#efb71d' || bgColor === '#24a643') {
                ctx.fillStyle = '#000000'
            } else {
                ctx.fillStyle = '#FFFFFF'
            }

            // Dynamic font sizing
            const textRadius = radius - 20
            const arcLength = textRadius * sliceAngle

            // High Fidelity Polish for Mobile
            const isMobile = window.innerWidth < 768

            // Text Sizing: Even more conservative for mobile to look "better visually"
            // The "so so big" comment suggests it was crowding the segment.
            let computedSize = arcLength / (isMobile ? 4.5 : 6)

            // Clamp size:
            // Mobile: Min 20px, Max 32px (Reduced max again)
            // Desktop: Min 20px, Max 40px
            const minSize = isMobile ? 20 : 20
            const maxSize = isMobile ? 42 : 40

            let fontSize = Math.max(minSize, Math.min(maxSize, computedSize))

            // "Not bold": ensure font weight is 400 (normal) or 500 (medium), not bold
            // Using Montserrat as requested
            ctx.font = `500 ${fontSize}px "Montserrat", sans-serif`

            // Shadow for text readability
            ctx.shadowColor = 'rgba(0, 0, 0, 0.5)'
            ctx.shadowBlur = 4
            ctx.shadowOffsetX = 1
            ctx.shadowOffsetY = 1

            // Position: Align right, near the outer edge
            // radius - 20px padding
            ctx.fillText(name, radius - 20, 0)

            ctx.restore()
        })

        // Glossy Overlay (Plastic/Glass Shine) - Top Half
        // This adds that extra "shinner" look requested
        ctx.save()
        const glossGradient = ctx.createLinearGradient(0, -radius, 0, 0)
        // Ultra HD: Reduced gloss opacity to 0.15 for subtle shine
        glossGradient.addColorStop(0, 'rgba(255, 255, 255, 0.15)')
        glossGradient.addColorStop(1, 'rgba(255, 255, 255, 0.05)')

        ctx.beginPath()
        // Arc from 180 to 360 degrees (top half)
        ctx.arc(0, 0, radius, Math.PI, 2 * Math.PI)
        ctx.fillStyle = glossGradient
        ctx.fill()
        ctx.restore()

        // Draw Center Circle (Hub) - Smaller on Mobile
        const isMobile = window.innerWidth < 768
        // Default was 50. Make it significantly smaller on mobile (e.g., 25) to match request ("more short")
        const hubRadius = isMobile ? 25 : 50

        ctx.beginPath()
        ctx.arc(0, 0, hubRadius, 0, 2 * Math.PI)
        ctx.fillStyle = 'white'
        ctx.shadowColor = 'rgba(0,0,0,0.2)'
        ctx.shadowBlur = 5
        ctx.fill()

        // Restore context (undo rotation/translation)
        ctx.restore()

    }, [names, colors, rotation, width, height])

    return (
        <canvas
            ref={canvasRef}
            style={{
                width: '100%',
                height: '100%',
                touchAction: 'none'
            }}
        />
    )
}

export default CanvasWheel
