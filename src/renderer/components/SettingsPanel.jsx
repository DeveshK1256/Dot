import React, { useState, useEffect } from 'react';
import { Volume2, VolumeX, Play, X, Check } from 'lucide-react';
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
    alarmSound: 'chime',
    launchAtStartup: true
  });
  const [applied, setApplied] = useState(false);

  useEffect(() => {
    if (window.electronAPI) {
      window.electronAPI.getSettings().then((s) => {
        if (s) setSettings((prev) => ({ ...prev, ...s }));
      });
    }
  }, []);

  const handleClose = () => {
    if (onClose) {
      onClose();
    } else if (window.electronAPI?.closeSettings) {
      window.electronAPI.closeSettings();
    } else {
      window.close();
    }
  };

  useEffect(() => {
    const handleKeyDown = (e) => {
      if (e.key === 'Escape') {
        handleClose();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [onClose]);

  const handleChange = (key, val) => {
    setSettings((prev) => ({ ...prev, [key]: val }));
  };

  const handlePreviewSound = (e) => {
    e.preventDefault();
    playAlarmSound(settings.alarmSound || 'chime');
  };

  const handleApply = async () => {
    if (window.electronAPI) {
      await window.electronAPI.saveSettings(settings);
    }
    if (onSave) onSave(settings);
    setApplied(true);
    setTimeout(() => setApplied(false), 2000);
  };

  const handleSave = async () => {
    if (window.electronAPI) {
      await window.electronAPI.saveSettings(settings);
    }
    if (onSave) onSave(settings);
    handleClose();
  };

  return (
    <div
      style={{
        width: '100%',
        height: '100%',
        padding: '16px 18px',
        background: 'linear-gradient(135deg, rgba(255, 255, 255, 0.12) 0%, rgba(255, 255, 255, 0.03) 100%), rgba(24, 24, 27, 0.96)',
        backdropFilter: 'blur(16px)',
        WebkitBackdropFilter: 'blur(16px)',
        border: '1px solid rgba(255, 255, 255, 0.2)',
        color: '#f4f4f5',
        borderRadius: '12px',
        fontFamily: 'sans-serif',
        display: 'flex',
        flexDirection: 'column',
        boxShadow: '0 8px 32px rgba(0,0,0,0.5)',
        boxSizing: 'border-box',
        overflow: 'hidden'
      }}
    >
      {/* Header */}
      <div
        style={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          flexShrink: 0,
          paddingBottom: '12px',
          borderBottom: '1px solid rgba(255, 255, 255, 0.12)',
          userSelect: 'none',
          WebkitAppRegion: 'drag'
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
          <h2 style={{ fontSize: '15px', fontWeight: 600, margin: 0, letterSpacing: '0.5px' }}>Dot Settings</h2>
          {/* Live Preview Mini-Dot */}
          <div
            style={{
              width: '20px',
              height: '20px',
              borderRadius: '50%',
              backgroundColor: settings.defaultDotColor,
              opacity: settings.defaultOpacity,
              boxShadow: '0 2px 6px rgba(0,0,0,0.4)',
              border: '1px solid rgba(255, 255, 255, 0.2)'
            }}
            title="Live Preview"
          />
        </div>

        {/* Close Button (Cross / X) */}
        <button
          onClick={handleClose}
          title="Close Settings (Esc)"
          aria-label="Close"
          style={{
            WebkitAppRegion: 'no-drag',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            width: '28px',
            height: '28px',
            borderRadius: '6px',
            background: 'rgba(255, 255, 255, 0.08)',
            border: '1px solid rgba(255, 255, 255, 0.15)',
            color: '#cbd5e1',
            cursor: 'pointer',
            transition: 'background 0.15s, color 0.15s, border-color 0.15s'
          }}
          onMouseEnter={(e) => {
            e.currentTarget.style.background = 'rgba(239, 68, 68, 0.25)';
            e.currentTarget.style.borderColor = 'rgba(239, 68, 68, 0.4)';
            e.currentTarget.style.color = '#fca5a5';
          }}
          onMouseLeave={(e) => {
            e.currentTarget.style.background = 'rgba(255, 255, 255, 0.08)';
            e.currentTarget.style.borderColor = 'rgba(255, 255, 255, 0.15)';
            e.currentTarget.style.color = '#cbd5e1';
          }}
        >
          <X size={16} />
        </button>
      </div>

      {/* Scrollable Body Controls */}
      <div
        className="custom-scrollbar"
        style={{
          flex: 1,
          overflowY: 'auto',
          display: 'flex',
          flexDirection: 'column',
          gap: '12px',
          paddingTop: '12px',
          paddingRight: '6px',
          minHeight: 0
        }}
      >
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

        {/* Launch at Startup */}
        <div
          style={{
            background: 'linear-gradient(135deg, rgba(255, 255, 255, 0.08) 0%, rgba(255, 255, 255, 0.02) 100%)',
            backdropFilter: 'blur(8px)',
            WebkitBackdropFilter: 'blur(8px)',
            border: '1px solid rgba(255, 255, 255, 0.15)',
            borderRadius: '8px',
            padding: '10px 12px',
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center'
          }}
        >
          <div style={{ display: 'flex', flexDirection: 'column', gap: '2px' }}>
            <span style={{ fontSize: '13px', fontWeight: 600 }}>Launch at Startup</span>
            <span style={{ fontSize: '11px', opacity: 0.7 }}>Start Dot automatically when logging into Windows</span>
          </div>
          <label style={{ display: 'flex', alignItems: 'center', cursor: 'pointer' }}>
            <input
              type="checkbox"
              checked={settings.launchAtStartup !== false}
              onChange={(e) => handleChange('launchAtStartup', e.target.checked)}
              style={{ cursor: 'pointer', width: '16px', height: '16px' }}
            />
          </label>
        </div>

        {/* Dot Color */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
          <label style={{ fontSize: '12px', opacity: 0.8 }}>Dot Color</label>
          <input
            type="color"
            value={settings.defaultDotColor}
            onChange={(e) => handleChange('defaultDotColor', e.target.value)}
            style={{ width: '100%', height: '32px', background: 'none', border: 'none', cursor: 'pointer' }}
          />
        </div>

        {/* Opacity */}
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

        {/* Text Size */}
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

        {/* Text Color */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
          <label style={{ fontSize: '12px', opacity: 0.8 }}>Text Color</label>
          <input
            type="color"
            value={settings.defaultTextColor || '#ffffff'}
            onChange={(e) => handleChange('defaultTextColor', e.target.value)}
            style={{ width: '100%', height: '32px', background: 'none', border: 'none', cursor: 'pointer' }}
          />
        </div>

        {/* Background Blur */}
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

        {/* Expand Timer */}
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
      </div>

      {/* Footer Actions */}
      <div
        style={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          flexShrink: 0,
          paddingTop: '12px',
          marginTop: '10px',
          borderTop: '1px solid rgba(255, 255, 255, 0.12)'
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', minHeight: '24px' }}>
          {applied && (
            <span
              style={{
                fontSize: '12px',
                color: '#4ade80',
                display: 'flex',
                alignItems: 'center',
                gap: '4px',
                fontWeight: 500
              }}
            >
              <Check size={14} /> Applied!
            </span>
          )}
        </div>

        <div style={{ display: 'flex', gap: '8px' }}>
          <button
            onClick={handleClose}
            style={{
              background: 'none',
              border: 'none',
              color: '#a1a1aa',
              cursor: 'pointer',
              fontSize: '12px',
              padding: '6px 12px',
              borderRadius: '6px',
              transition: 'color 0.15s'
            }}
            onMouseEnter={(e) => (e.currentTarget.style.color = '#f4f4f5')}
            onMouseLeave={(e) => (e.currentTarget.style.color = '#a1a1aa')}
          >
            Cancel
          </button>

          <button
            onClick={handleApply}
            title="Apply changes without closing"
            style={{
              background: 'rgba(255, 255, 255, 0.1)',
              border: '1px solid rgba(255, 255, 255, 0.2)',
              borderRadius: '6px',
              color: '#e4e4e7',
              fontSize: '12px',
              fontWeight: 600,
              cursor: 'pointer',
              padding: '6px 14px',
              transition: 'background 0.15s, border-color 0.15s'
            }}
            onMouseEnter={(e) => {
              e.currentTarget.style.background = 'rgba(255, 255, 255, 0.16)';
              e.currentTarget.style.borderColor = 'rgba(255, 255, 255, 0.35)';
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.background = 'rgba(255, 255, 255, 0.1)';
              e.currentTarget.style.borderColor = 'rgba(255, 255, 255, 0.2)';
            }}
          >
            Apply
          </button>

          <button
            onClick={handleSave}
            title="Save changes and close"
            style={{
              background: '#3b82f6',
              border: 'none',
              borderRadius: '6px',
              color: '#fff',
              fontSize: '12px',
              fontWeight: 600,
              cursor: 'pointer',
              padding: '6px 16px',
              boxShadow: '0 2px 6px rgba(59, 130, 246, 0.4)',
              transition: 'background 0.15s'
            }}
            onMouseEnter={(e) => (e.currentTarget.style.background = '#2563eb')}
            onMouseLeave={(e) => (e.currentTarget.style.background = '#3b82f6')}
          >
            Save
          </button>
        </div>
      </div>
    </div>
  );
}
