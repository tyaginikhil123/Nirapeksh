type NirpekshMeterProps = {
  value: number
  rated: boolean
  size?: 'sm' | 'lg'
  label?: string
}

export function NirpekshMeter({
  value,
  rated,
  size = 'sm',
  label,
}: NirpekshMeterProps) {
  const pct = rated ? Math.min(1, Math.max(0, value / 5)) : 0
  const display = rated ? value.toFixed(1) : '—'
  const dim = size === 'lg' ? 160 : 72
  const stroke = size === 'lg' ? 11 : 7
  const height = dim * 0.62
  const cx = dim / 2
  const cy = dim * 0.58
  const r = dim / 2 - stroke - 2
  const arc = `M ${cx - r} ${cy} A ${r} ${r} 0 0 1 ${cx + r} ${cy}`

  return (
    <div
      className={`nirpeksh-meter nirpeksh-meter--${size}`}
      role="img"
      aria-label={rated ? `Nirpeksh Meter ${display} out of 5` : 'Nirpeksh Meter not rated yet'}
    >
      <svg
        viewBox={`0 0 ${dim} ${height}`}
        width={dim}
        height={height}
        aria-hidden="true"
      >
        <path
          d={arc}
          className="nirpeksh-meter__track"
          fill="none"
          strokeWidth={stroke}
          strokeLinecap="round"
        />
        <path
          d={arc}
          className="nirpeksh-meter__fill"
          fill="none"
          strokeWidth={stroke}
          strokeLinecap="round"
          pathLength={100}
          strokeDasharray={`${pct * 100} 100`}
        />
        <text
          className="nirpeksh-meter__value"
          x={cx}
          y={cy - (size === 'lg' ? 8 : 3)}
          textAnchor="middle"
          fontSize={size === 'lg' ? 28 : 15}
        >
          {display}
        </text>
      </svg>
      {label ? <span className="nirpeksh-meter__label">{label}</span> : null}
    </div>
  )
}
