import React from 'react'

export interface ThinStatCardProps {
  label: string
  value: number | string
  accentColor: string
  badge?: string
  onClick?: () => void
  selected?: boolean
}

export const ThinStatCard: React.FC<ThinStatCardProps> = ({
  label,
  value,
  accentColor,
  badge,
  onClick,
  selected,
}) => {
  return (
    <div
      onClick={onClick}
      style={{
        background: '#ffffff',
        borderRadius: '8px',
        border: selected ? `2px solid ${accentColor}` : '1px solid #e2e8f0',
        borderLeft: `4px solid ${accentColor}`,
        padding: '8px 14px',
        boxShadow: selected ? `0 2px 6px ${accentColor}25` : '0 1px 2px rgba(0,0,0,0.03)',
        display: 'flex',
        flexDirection: 'column',
        justifyContent: 'center',
        alignItems: 'center',
        minHeight: '64px',
        position: 'relative',
        cursor: onClick ? 'pointer' : 'default',
        transition: 'all 0.15s ease-in-out',
        width: '100%',
      }}
    >
      {badge && (
        <span
          style={{
            position: 'absolute',
            top: '4px',
            right: '6px',
            fontSize: '9px',
            fontWeight: 700,
            textTransform: 'uppercase',
            background: accentColor,
            color: '#ffffff',
            padding: '1px 5px',
            borderRadius: '10px',
            lineHeight: '13px',
            letterSpacing: '0.04em',
          }}
        >
          {badge}
        </span>
      )}
      <div
        style={{
          fontSize: '22px',
          fontWeight: 800,
          color: accentColor,
          lineHeight: 1.15,
          fontFamily: 'Inter, system-ui, -apple-system, sans-serif',
        }}
      >
        {typeof value === 'number' ? value.toLocaleString() : value}
      </div>
      <div
        style={{
          fontSize: '11px',
          fontWeight: 700,
          color: '#64748b',
          textTransform: 'uppercase',
          letterSpacing: '0.05em',
          marginTop: '3px',
          textAlign: 'center',
          whiteSpace: 'nowrap',
          overflow: 'hidden',
          textOverflow: 'ellipsis',
          maxWidth: '100%',
        }}
      >
        {label}
      </div>
    </div>
  )
}

export default ThinStatCard
