import React, { useState } from 'react';
import { RotateCcw, X } from 'lucide-react';
import { HubSettingsSchema } from '../../shared/schema.js';

export function HubSettingsModal({ dot, onSave, onClose, onReset }) {
  const [hubEdge, setHubEdge] = useState(dot?.hubEdge || HubSettingsSchema.hubEdge);
  const [hubColor, setHubColor] = useState(dot?.hubColor || dot?.color || HubSettingsSchema.hubColor);
  const [hubOpacity, setHubOpacity] = useState(dot?.hubOpacity ?? dot?.opacity ?? HubSettingsSchema.hubOpacity);
  const [hubBorderStyle, setHubBorderStyle] = useState(dot?.hubBorderStyle || HubSettingsSchema.hubBorderStyle);
  const [sortOrder, setSortOrder] = useState(dot?.sortOrder || HubSettingsSchema.sortOrder);
  const [showCompletedChecklists, setShowCompletedChecklists] = useState(
    dot?.showCompletedChecklists ?? HubSettingsSchema.showCompletedChecklists
  );

  const handleSave = () => {
    onSave({
      ...dot,
      hubEdge,
      hubColor,
      color: hubColor,
      hubOpacity,
      opacity: hubOpacity,
      hubBorderStyle,
      sortOrder,
      showCompletedChecklists
    });
  };

  const handleReset = () => {
    setHubEdge(HubSettingsSchema.hubEdge);
    setHubColor(HubSettingsSchema.hubColor);
    setHubOpacity(HubSettingsSchema.hubOpacity);
    setHubBorderStyle(HubSettingsSchema.hubBorderStyle);
    setSortOrder(HubSettingsSchema.sortOrder);
    setShowCompletedChecklists(HubSettingsSchema.showCompletedChecklists);
    if (onReset) onReset();
  };

  return (
    <div
      style={{
        position: 'absolute',
        top: 0,
        left: 0,
        width: '100%',
        height: '100%',
        background: 'linear-gradient(135deg, rgba(255, 255, 255, 0.12) 0%, rgba(255, 255, 255, 0.03) 100%), rgba(15, 23, 42, 0.88)',
        backdropFilter: 'blur(16px)',
        WebkitBackdropFilter: 'blur(16px)',
        border: '1px solid rgba(255, 255, 255, 0.2)',
        boxShadow: '0 8px 32px rgba(0, 0, 0, 0.35)',
        zIndex: 100,
        display: 'flex',
        flexDirection: 'column',
        padding: '14px',
        color: '#f8fafc',
        borderRadius: '14px',
        boxSizing: 'border-box'
      }}
    >
      {/* Header */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '10px' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
          <span style={{ fontSize: '12px', fontWeight: 'bold', textTransform: 'uppercase', letterSpacing: '0.6px' }}>
            Dot Settings
          </span>
          <div
            style={{
              width: '14px',
              height: '14px',
              borderRadius: '50%',
              backgroundColor: hubColor,
              opacity: hubOpacity
            }}
          />
        </div>
        <button className="icon-btn" onClick={onClose} title="Close Settings" style={{ color: '#ffffff' }}>
          <X size={14} />
        </button>
      </div>

      {/* Body Controls */}
      <div
        style={{
          flex: 1,
          overflowY: 'auto',
          display: 'flex',
          flexDirection: 'column',
          gap: '10px',
          paddingRight: '4px'
        }}
      >
        {/* Hub Edge Position */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <label style={{ fontSize: '11px', opacity: 0.9, fontWeight: 500 }}>Dock Edge</label>
            <select
              value={hubEdge}
              onChange={(e) => setHubEdge(e.target.value)}
              style={{
                background: '#1e293b',
                color: '#ffffff',
                border: '1px solid rgba(255,255,255,0.15)',
                borderRadius: '4px',
                padding: '3px 6px',
                fontSize: '11px',
                cursor: 'pointer'
              }}
            >
              <option value="right">Right Edge (Default)</option>
              <option value="left">Left Edge</option>
              <option value="top">Top Edge</option>
              <option value="bottom">Bottom Edge</option>
            </select>
          </div>
          <span style={{ fontSize: '10px', opacity: 0.6 }}>
            Screen edge where the Dot edge tab is anchored.
          </span>
        </div>

        {/* Hub Color */}
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <label style={{ fontSize: '11px', opacity: 0.9 }}>Dot Accent Color</label>
          <input
            type="color"
            value={hubColor}
            onChange={(e) => setHubColor(e.target.value)}
            style={{ width: '40px', height: '22px', border: 'none', background: 'none', cursor: 'pointer' }}
          />
        </div>

        {/* Hub Opacity */}
        <div>
          <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '11px', opacity: 0.9 }}>
            <span>Dot Opacity</span>
            <span>{Math.round(hubOpacity * 100)}%</span>
          </div>
          <input
            type="range"
            min="0.2"
            max="1.0"
            step="0.05"
            value={hubOpacity}
            onChange={(e) => setHubOpacity(parseFloat(e.target.value))}
            style={{ width: '100%', marginTop: '3px' }}
          />
        </div>

        {/* Border Style */}
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <label style={{ fontSize: '11px', opacity: 0.9 }}>Border Style</label>
          <select
            value={hubBorderStyle}
            onChange={(e) => setHubBorderStyle(e.target.value)}
            style={{
              background: '#1e293b',
              color: '#ffffff',
              border: '1px solid rgba(255,255,255,0.15)',
              borderRadius: '4px',
              padding: '3px 6px',
              fontSize: '11px',
              cursor: 'pointer'
            }}
          >
            <option value="solid">Solid</option>
            <option value="dashed">Dashed</option>
            <option value="none">None</option>
          </select>
        </div>

        {/* Note Sort Order */}
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <label style={{ fontSize: '11px', opacity: 0.9 }}>Note Sort Order</label>
          <select
            value={sortOrder}
            onChange={(e) => setSortOrder(e.target.value)}
            style={{
              background: '#1e293b',
              color: '#ffffff',
              border: '1px solid rgba(255,255,255,0.15)',
              borderRadius: '4px',
              padding: '3px 6px',
              fontSize: '11px',
              cursor: 'pointer'
            }}
          >
            <option value="newest">Newest First</option>
            <option value="oldest">Oldest First</option>
            <option value="alphabetical">Alphabetical</option>
          </select>
        </div>

        {/* Show Completed Checklists */}
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: '2px' }}>
          <label style={{ fontSize: '11px', opacity: 0.9 }}>Show Completed Checklists</label>
          <input
            type="checkbox"
            checked={showCompletedChecklists}
            onChange={(e) => setShowCompletedChecklists(e.target.checked)}
            style={{ width: '15px', height: '15px', cursor: 'pointer' }}
          />
        </div>
      </div>

      {/* Footer Actions */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: '10px', paddingTop: '8px', borderTop: '1px solid rgba(255,255,255,0.1)' }}>
        <button
          onClick={handleReset}
          title="Reset to defaults"
          style={{
            background: 'none',
            border: 'none',
            color: '#94a3b8',
            cursor: 'pointer',
            display: 'flex',
            alignItems: 'center',
            gap: '4px',
            fontSize: '11px'
          }}
        >
          <RotateCcw size={12} />
          <span>Reset</span>
        </button>

        <div style={{ display: 'flex', gap: '8px' }}>
          <button
            onClick={onClose}
            style={{
              background: 'none',
              border: 'none',
              color: '#cbd5e1',
              cursor: 'pointer',
              fontSize: '11px',
              padding: '4px 8px'
            }}
          >
            Cancel
          </button>
          <button
            onClick={handleSave}
            style={{
              background: '#4f46e5',
              border: 'none',
              borderRadius: '5px',
              color: '#ffffff',
              fontWeight: '600',
              cursor: 'pointer',
              fontSize: '11px',
              padding: '4px 12px'
            }}
          >
            Save
          </button>
        </div>
      </div>
    </div>
  );
}
