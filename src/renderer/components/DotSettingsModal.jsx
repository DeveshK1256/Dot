import React, { useState } from 'react';
import { RotateCcw, X } from 'lucide-react';

export function DotSettingsModal({ dot, globalSettings, onSave, onClose, onReset }) {
  // Use dot override if present, else fallback to global setting
  const [color, setColor] = useState(dot.color || globalSettings?.defaultDotColor || '#3b82f6');
  const [opacity, setOpacity] = useState(dot.opacity ?? globalSettings?.defaultOpacity ?? 0.88);
  const [blurRadius, setBlurRadius] = useState(dot.blurRadius ?? globalSettings?.defaultBlurRadius ?? 12);
  const [textSize, setTextSize] = useState(dot.textSize ?? globalSettings?.defaultTextSize ?? 14);
  const [textColor, setTextColor] = useState(dot.textColor ?? globalSettings?.defaultTextColor ?? '#ffffff');
  const [expandTimerMs, setExpandTimerMs] = useState(dot.expandTimerMs ?? globalSettings?.defaultExpandTimerMs ?? 4000);

  const hasOverride = Boolean(
    dot.color ||
    dot.opacity !== undefined ||
    dot.blurRadius !== undefined ||
    dot.textSize !== undefined ||
    dot.textColor ||
    dot.expandTimerMs !== undefined
  );

  const handleSave = () => {
    onSave({
      ...dot,
      color,
      opacity,
      blurRadius,
      textSize,
      textColor,
      expandTimerMs
    });
  };

  const handleReset = () => {
    onReset();
  };

  return (
    <div
      style={{
        position: 'absolute',
        top: 0,
        left: 0,
        width: '100%',
        height: '100%',
        background: 'rgba(15, 23, 42, 0.95)',
        backdropFilter: 'blur(16px)',
        WebkitBackdropFilter: 'blur(16px)',
        zIndex: 100,
        display: 'flex',
        flexDirection: 'column',
        padding: '12px',
        color: '#f8fafc',
        borderRadius: '14px',
        boxSizing: 'border-box'
      }}
    >
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
          <span style={{ fontSize: '12px', fontWeight: 'bold', textTransform: 'uppercase', letterSpacing: '0.5px' }}>
            Dot Settings
          </span>
          <div
            style={{
              width: '16px',
              height: '16px',
              borderRadius: '50%',
              backgroundColor: color,
              opacity: opacity
            }}
          />
        </div>
        <button className="icon-btn" onClick={onClose} title="Close settings">
          <X size={14} />
        </button>
      </div>

      <div style={{ flex: 1, overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: '8px', paddingRight: '4px' }}>
        {/* Color */}
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <label style={{ fontSize: '11px', opacity: 0.85 }}>Color</label>
          <input
            type="color"
            value={color}
            onChange={(e) => setColor(e.target.value)}
            style={{ width: '36px', height: '20px', border: 'none', background: 'none', cursor: 'pointer' }}
          />
        </div>

        {/* Opacity */}
        <div>
          <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '11px', opacity: 0.85 }}>
            <span>Opacity</span>
            <span>{Math.round(opacity * 100)}%</span>
          </div>
          <input
            type="range"
            min="0.2"
            max="1.0"
            step="0.05"
            value={opacity}
            onChange={(e) => setOpacity(parseFloat(e.target.value))}
            style={{ width: '100%', height: '4px' }}
          />
        </div>

        {/* Blur Radius */}
        <div>
          <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '11px', opacity: 0.85 }}>
            <span>Blur Radius</span>
            <span>{blurRadius}px</span>
          </div>
          <input
            type="range"
            min="0"
            max="20"
            step="1"
            value={blurRadius}
            onChange={(e) => setBlurRadius(parseInt(e.target.value, 10))}
            style={{ width: '100%', height: '4px' }}
          />
        </div>

        {/* Text Size */}
        <div>
          <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '11px', opacity: 0.85 }}>
            <span>Text Size</span>
            <span>{textSize}px</span>
          </div>
          <input
            type="range"
            min="10"
            max="24"
            step="1"
            value={textSize}
            onChange={(e) => setTextSize(parseInt(e.target.value, 10))}
            style={{ width: '100%', height: '4px' }}
          />
        </div>

        {/* Text Color */}
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <label style={{ fontSize: '11px', opacity: 0.85 }}>Text Color</label>
          <input
            type="color"
            value={textColor}
            onChange={(e) => setTextColor(e.target.value)}
            style={{ width: '36px', height: '20px', border: 'none', background: 'none', cursor: 'pointer' }}
          />
        </div>

        {/* Expand Timer */}
        <div>
          <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '11px', opacity: 0.85 }}>
            <span>Shrink Timer</span>
            <span>{expandTimerMs / 1000}s</span>
          </div>
          <input
            type="range"
            min="1000"
            max="15000"
            step="500"
            value={expandTimerMs}
            onChange={(e) => setExpandTimerMs(parseInt(e.target.value, 10))}
            style={{ width: '100%', height: '4px' }}
          />
        </div>
      </div>

      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: '8px', paddingTop: '6px', borderTop: '1px solid rgba(255,255,255,0.1)' }}>
        <button
          onClick={handleReset}
          disabled={!hasOverride}
          style={{
            background: 'none',
            border: 'none',
            color: hasOverride ? '#f87171' : '#64748b',
            cursor: hasOverride ? 'pointer' : 'default',
            display: 'flex',
            alignItems: 'center',
            gap: '4px',
            fontSize: '11px',
            padding: '4px'
          }}
          title="Reset to global default"
        >
          <RotateCcw size={12} />
          Reset to default
        </button>

        <div style={{ display: 'flex', gap: '6px' }}>
          <button
            onClick={onClose}
            style={{
              background: 'rgba(255,255,255,0.1)',
              border: 'none',
              borderRadius: '4px',
              color: '#e2e8f0',
              padding: '4px 8px',
              fontSize: '11px',
              cursor: 'pointer'
            }}
          >
            Cancel
          </button>
          <button
            onClick={handleSave}
            style={{
              background: '#3b82f6',
              border: 'none',
              borderRadius: '4px',
              color: '#fff',
              fontWeight: '600',
              padding: '4px 10px',
              fontSize: '11px',
              cursor: 'pointer'
            }}
          >
            Apply
          </button>
        </div>
      </div>
    </div>
  );
}
