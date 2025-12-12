import React, { useRef, useEffect } from 'react'

const CanvasWheel = ({ names, colors, rotation, width = 800, height = 800 }) => {
    const canvasRef = useRef(null)

    useEffect(() => {
        const canvas = canvasRef.current
        const ctx = canvas.getContext('2d')
        const dpr = window.devicePixelRatio || 1

        const handleResize = () => {
            const displayWidth = canvas.clientWidth || width
            const displayHeight = canvas.clientHeight || height

            // Set actual size in memory (scaled to account for extra pixel density)
            canvas.width = displayWidth * dpr
            canvas.height = displayHeight * dpr

            // Normalize coordinate system to use css pixels
            ctx.scale(dpr, dpr)

            const centerX = displayWidth / 2
            const centerY = displayHeight / 2
            // FIXED 20px padding (Matches App.css)
            const radius = Math.min(centerX, centerY) - 20

            drawWheel(centerX, centerY, radius, displayWidth, displayHeight)
        }

        const resizeObserver = new ResizeObserver(() => {
            handleResize()
        })
        resizeObserver.observe(canvas)

        // Initial Draw
        handleResize()

        // Helper to draw the wheel (extracted for reuse)
        function drawWheel(centerX, centerY, radius, displayWidth, displayHeight) {
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
                const gradient = ctx.createRadialGradient(0, 0, 0, 0, 0, radius)
                gradient.addColorStop(0, 'rgba(255, 255, 255, 0.1)')
                gradient.addColorStop(0.6, 'rgba(255, 255, 255, 0)')
                gradient.addColorStop(1, 'rgba(0, 0, 0, 0.1)')

                ctx.fillStyle = gradient
                ctx.fill()

                ctx.lineWidth = 1
                ctx.strokeStyle = 'rgba(0,0,0,0.1)'
                ctx.stroke()

                // Draw Text
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
                const minSize = isMobile ? 20 : 20
                const maxSize = isMobile ? 42 : 40
                let fontSize = Math.max(minSize, Math.min(maxSize, computedSize))

                ctx.font = `500 ${fontSize}px "Montserrat", sans-serif`

                ctx.shadowColor = 'rgba(0,0,0,0.2)'
                ctx.shadowBlur = 2
                ctx.shadowOffsetX = 1
                ctx.shadowOffsetY = 1

                ctx.fillText(name, radius - 25, 0)
                ctx.restore()
            })

            ctx.restore()

            // Draw Center Hub
            ctx.save()
            ctx.translate(centerX, centerY)



            // Draw Center Circle (Hub) - Smaller on Mobile
            const isMobile = window.innerWidth < 768
            const hubRadius = isMobile ? 25 : 50

            ctx.beginPath()
            ctx.arc(0, 0, hubRadius, 0, 2 * Math.PI)
            ctx.fillStyle = 'white'
            ctx.shadowColor = 'rgba(0,0,0,0.2)'
            ctx.shadowBlur = 5
            ctx.fill()
            ctx.restore()
        }

        return () => {
            resizeObserver.disconnect()
        }
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
