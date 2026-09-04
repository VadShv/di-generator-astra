'use client'

interface CoverageRingProps {
  percent: number
  size?: number
  strokeWidth?: number
  showLabel?: boolean
}

export function CoverageRing({ percent, size = 36, strokeWidth = 3, showLabel = true }: CoverageRingProps) {
  const clamped = Math.max(0, Math.min(100, percent))
  const radius = (size - strokeWidth) / 2
  const circumference = 2 * Math.PI * radius
  const offset = circumference - (clamped / 100) * circumference

  const color =
    clamped >= 80 ? '#10b981' :
    clamped >= 50 ? '#f59e0b' :
    clamped >= 25 ? '#f97316' : '#ef4444'

  return (
    <div className="relative inline-flex items-center justify-center" style={{ width: size, height: size }}>
      <svg width={size} height={size} className="transform -rotate-90">
        <circle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          fill="none"
          stroke="currentColor"
          strokeWidth={strokeWidth}
          className="text-muted/30"
        />
        <circle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          fill="none"
          stroke={color}
          strokeWidth={strokeWidth}
          strokeDasharray={circumference}
          strokeDashoffset={offset}
          strokeLinecap="round"
          className="transition-all duration-500"
        />
      </svg>
      {showLabel && (
        <span className="absolute text-[9px] font-bold" style={{ color }}>
          {clamped}%
        </span>
      )}
    </div>
  )
}
