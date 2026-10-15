import React, { useState, useEffect } from 'react';
import { Volume2, VolumeX, Play } from 'lucide-react';
import { ALARM_SOUND_PRESETS } from '../../shared/schema.js';
import { playAlarmSound } from '../utils/soundPlayer.js';

export function SettingsPanel({ onSave, onClose }) {
  const [settings, setSettings] = useState({
    defaultDotColor: '#3b82f6',
    defaultOpacity: 0.88,
    defaultBlurRadius: 12,
    defaultTextSize: 14,
    defaultTextColor: '#ffffff',
    defaultExpandTimerMs: 4000,
    soundEnabled: true,
    alarmSound: 'chime'
  });

  useEffect(() => {
    if (window.electronAPI) {
      window.electronAPI.getSettings().then((s) => {
        if (s) setSettings((prev) => ({ ...prev, ...s }));
      });
    }
  }, []);

  const handleChange = (key, val) => {
    setSettings((prev) => ({ ...prev, [key]: val }));
  };

  const handlePreviewSound = (e) => {
    e.preventDefault();
    playAlarmSound(settings.alarmSound || 'chime');
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
        background: 'linear-gradient(135deg, rgba(255, 255, 255, 0.12) 0%, rgba(255, 255, 255, 0.03) 100%), rgba(24, 24, 27, 0.92)',
        backdropFilter: 'blur(16px)',
        WebkitBackdropFilter: 'blur(16px)',
        border: '1px solid rgba(255, 255, 255, 0.2)',
        color: '#f4f4f5',
        borderRadius: '12px',
        fontFamily: 'sans-serif',
        display: 'flex',
        flexDirection: 'column',
        gap: '14px',
        boxShadow: '0 8px 32px rgba(0,0,0,0.5)'
      }}
    >
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <h2 style={{ fontSize: '16px', margin: 0, letterSpacing: '0.5px' }}>Dot Settings</h2>
        {/* Live Preview Mini-Dot */}
        <div
          style={{
            width: '28px',
            height: '28px',
            borderRadius: '50%',
            backgroundColor: settings.defaultDotColor,
            opacity: settings.defaultOpacity,
            boxShadow: '0 2px 8px rgba(0,0,0,0.4)',
            border: '1px solid rgba(255, 255, 255, 0.2)'
          }}
          title="Live Preview"
        />
      </div>

      {/* Deadline Alarm Sound Section */}
      <div
        style={{
          background: 'linear-gradient(135deg, rgba(255, 255, 255, 0.08) 0%, rgba(255, 255, 255, 0.02) 100%)',
          backdropFilter: 'blur(8px)',
          WebkitBackdropFilter: 'blur(8px)',
          border: '1px solid rgba(255, 255, 255, 0.15)',
          borderRadius: '8px',
          padding: '10px 12px',
          display: 'flex',
          flexDirection: 'column',
          gap: '10px'
        }}
      >
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            {settings.soundEnabled !== false ? (
              <Volume2 size={16} style={{ color: '#60a5fa' }} />
            ) : (
              <VolumeX size={16} style={{ color: '#9ca3af' }} />
            )}
            <span style={{ fontSize: '13px', fontWeight: 600 }}>Deadline Alarm Sound</span>
          </div>
          <label style={{ display: 'flex', alignItems: 'center', cursor: 'pointer' }}>
            <input
              type="checkbox"
              checked={settings.soundEnabled !== false}
              onChange={(e) => handleChange('soundEnabled', e.target.checked)}
              style={{ cursor: 'pointer', width: '16px', height: '16px' }}
            />
          </label>
        </div>

        {settings.soundEnabled !== false && (
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <select
              value={settings.alarmSound || 'chime'}
              onChange={(e) => handleChange('alarmSound', e.target.value)}
              style={{
                flex: 1,
                background: 'rgba(0, 0, 0, 0.45)',
                color: '#fff',
                border: '1px solid rgba(255, 255, 255, 0.2)',
                borderRadius: '6px',
                padding: '6px 8px',
                fontSize: '12px',
                outline: 'none'
              }}
            >
              {ALARM_SOUND_PRESETS.map((preset) => (
                <option key={preset.id} value={preset.id} style={{ background: '#18181b', color: '#fff' }}>
                  {preset.label}
                </option>
              ))}
            </select>

            <button
              onClick={handlePreviewSound}
              title="Preview Sound"
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: '4px',
                background: 'rgba(59, 130, 246, 0.2)',
                border: '1px solid rgba(59, 130, 246, 0.4)',
                borderRadius: '6px',
                color: '#93c5fd',
                fontSize: '11px',
                fontWeight: 600,
                padding: '6px 10px',
                cursor: 'pointer',
                transition: 'background 0.15s ease'
              }}
            >
              <Play size={12} fill="#93c5fd" />
              <span>Preview</span>
            </button>
          </div>
        )}
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

      <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '10px', marginTop: '6px' }}>
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
