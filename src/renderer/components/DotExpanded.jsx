import React, { useState } from 'react';
import { X, Pin, Settings as SettingsIcon } from 'lucide-react';
import { NoteItem } from './NoteItem.jsx';
import { DotSettingsModal } from './DotSettingsModal.jsx';

export function DotExpanded({ dot, notes, globalSettings, isPinned, onTogglePin, onClose, onSaveNote, onDeleteNote, onSaveDotSettings, onResetDotSettings }) {
  const [showConfirmClose, setShowConfirmClose] = useState(false);
  const [showSettings, setShowSettings] = useState(false);

  const handleCloseClick = () => {
    if (document.activeElement && typeof document.activeElement.blur === 'function') {
      document.activeElement.blur();
    }
    if (notes.length === 0) {
      onClose(true); // Close & delete if empty
    } else {
      setShowConfirmClose(true);
    }
  };

  const activeNote = notes[0] || {
    id: `note-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
    dotId: dot.id,
    text: '',
    checklist: [],
    firedReminders: []
  };

  return (
    <div className="dot-expanded-card" style={{ position: 'relative' }}>
      {/* Background layer: isolates opacity and backdrop blur so text remains 100% solid pure white */}
      <div className="card-bg-layer" />

      <div className="card-header" style={{ position: 'relative', zIndex: 1 }}>
        <span className="header-title">DOT</span>
        <div className="header-actions">
          <button
            className="icon-btn"
            title="Dot Settings"
            onClick={() => setShowSettings(!showSettings)}
            style={{ color: showSettings ? '#38bdf8' : 'inherit' }}
          >
            <SettingsIcon size={14} />
          </button>
          <button
            className="icon-btn"
            title={isPinned ? 'Unpin (auto-shrink enabled)' : 'Pin (keep open)'}
            onClick={onTogglePin}
            style={{ color: isPinned ? '#facc15' : 'inherit' }}
          >
            <Pin size={14} />
          </button>
          <button className="icon-btn" title="Close" onClick={handleCloseClick}>
            <X size={15} />
          </button>
        </div>
      </div>

      <div className="card-body" style={{ position: 'relative', zIndex: 1 }}>
        {showSettings && (
          <DotSettingsModal
            dot={dot}
            globalSettings={globalSettings}
            onClose={() => setShowSettings(false)}
            onSave={(updatedDot) => {
              onSaveDotSettings(updatedDot);
              setShowSettings(false);
            }}
            onReset={() => {
              onResetDotSettings();
              setShowSettings(false);
            }}
          />
        )}
        {showConfirmClose ? (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', padding: '10px' }}>
            <span style={{ fontSize: '12px' }}>This dot contains notes. What would you like to do?</span>
            <button
              onClick={() => {
                setShowConfirmClose(false);
                onClose(false);
              }}
              style={{
                padding: '6px',
                background: 'rgba(255,255,255,0.2)',
                border: 'none',
                borderRadius: '4px',
                color: 'inherit',
                cursor: 'pointer'
              }}
            >
              Hide to Tray (Keep Notes)
            </button>
            <button
              onClick={() => onClose(true)}
              style={{
                padding: '6px',
                background: '#ef4444',
                border: 'none',
                borderRadius: '4px',
                color: 'white',
                cursor: 'pointer'
              }}
            >
              Delete Dot & Notes
            </button>
            <button
              onClick={() => setShowConfirmClose(false)}
              style={{ background: 'none', border: 'none', color: 'inherit', opacity: 0.6, cursor: 'pointer' }}
            >
              Cancel
            </button>
          </div>
        ) : (
          <NoteItem
            note={activeNote}
            onUpdate={onSaveNote}
            onDelete={onDeleteNote}
          />
        )}
      </div>
    </div>
  );
}
