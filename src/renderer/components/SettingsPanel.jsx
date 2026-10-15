import React, { useState, useEffect } from 'react';

export function SettingsPanel({ onSave, onClose }) {
  const [settings, setSettings] = useState({
    defaultDotColor: '#3b82f6',
    defaultOpacity: 0.88,
    defaultBlurRadius: 12,
    defaultTextSize: 14,
    defaultTextColor: '#ffffff',
    defaultExpandTimerMs: 4000,
    displayMode: 'all'
  });

  useEffect(() => {
    if (window.electronAPI) {
      window.electronAPI.getSettings().then((s) => {
        if (s) setSettings(s);
      });
    }
  }, []);

  const handleChange = (key, val) => {
    setSettings((prev) => ({ ...prev, [key]: val }));
  };

  const handleSave = () => {
    if (window.electronAPI) {
      window.electronAPI.saveSettings(settings);
    }
    if (onSave) onSave(settings);
  };

  return (
    <div
      style={{
        width: '380px',
        padding: '20px',
        background: '#18181b',
        color: '#f4f4f5',
        borderRadius: '12px',
        fontFamily: 'sans-serif',
        display: 'flex',
        flexDirection: 'column',
        gap: '16px',
        boxShadow: '0 8px 30px rgba(0,0,0,0.5)'
      }}
    >
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <h2 style={{ fontSize: '16px', margin: 0 }}>Dot Settings</h2>
        {/* Live Preview Mini-Dot */}
        <div
          style={{
            width: '28px',
            height: '28px',
            borderRadius: '50%',
            backgroundColor: settings.defaultDotColor,
            opacity: settings.defaultOpacity,
            boxShadow: '0 2px 8px rgba(0,0,0,0.4)'
          }}
          title="Live Preview"
        />
      </div>

      <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
        <label style={{ fontSize: '12px', opacity: 0.8 }}>Dot Color</label>
        <input
          type="color"
          value={settings.defaultDotColor}
          onChange={(e) => handleChange('defaultDotColor', e.target.value)}
          style={{ width: '100%', height: '32px', background: 'none', border: 'none', cursor: 'pointer' }}
        />
      </div>

      <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '12px', opacity: 0.8 }}>
          <span>Opacity</span>
          <span>{Math.round(settings.defaultOpacity * 100)}%</span>
        </div>
        <input
          type="range"
          min="0.2"
          max="1.0"
          step="0.05"
          value={settings.defaultOpacity}
          onChange={(e) => handleChange('defaultOpacity', parseFloat(e.target.value))}
        />
      </div>

      <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '12px', opacity: 0.8 }}>
          <span>Text Size</span>
          <span>{settings.defaultTextSize || 14}px</span>
        </div>
        <input
          type="range"
          min="10"
          max="24"
          step="1"
          value={settings.defaultTextSize || 14}
          onChange={(e) => handleChange('defaultTextSize', parseInt(e.target.value, 10))}
        />
      </div>

      <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
        <label style={{ fontSize: '12px', opacity: 0.8 }}>Text Color</label>
        <input
          type="color"
          value={settings.defaultTextColor || '#ffffff'}
          onChange={(e) => handleChange('defaultTextColor', e.target.value)}
          style={{ width: '100%', height: '32px', background: 'none', border: 'none', cursor: 'pointer' }}
        />
      </div>

      <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '12px', opacity: 0.8 }}>
          <span>Background Blur</span>
          <span>{settings.defaultBlurRadius}px</span>
        </div>
        <input
          type="range"
          min="0"
          max="20"
          step="1"
          value={settings.defaultBlurRadius}
          onChange={(e) => handleChange('defaultBlurRadius', parseInt(e.target.value, 10))}
        />
      </div>

      <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '12px', opacity: 0.8 }}>
          <span>Expand Timer</span>
          <span>{settings.defaultExpandTimerMs / 1000}s</span>
        </div>
        <input
          type="range"
          min="1000"
          max="15000"
          step="500"
          value={settings.defaultExpandTimerMs}
          onChange={(e) => handleChange('defaultExpandTimerMs', parseInt(e.target.value, 10))}
        />
      </div>

      <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '10px', marginTop: '10px' }}>
        <button
          onClick={onClose}
          style={{
            background: 'none',
            border: 'none',
            color: '#a1a1aa',
            cursor: 'pointer',
            padding: '6px 12px'
          }}
        >
          Cancel
        </button>
        <button
          onClick={handleSave}
          style={{
            background: '#3b82f6',
            border: 'none',
            borderRadius: '6px',
            color: '#fff',
            fontWeight: 'bold',
            cursor: 'pointer',
            padding: '6px 16px'
          }}
        >
          Save
        </button>
      </div>
    </div>
  );
}
