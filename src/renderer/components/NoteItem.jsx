import React, { useState } from 'react';
import { Trash2, Calendar, ListCheck, AlignLeft, Bell } from 'lucide-react';
import { Checklist } from './Checklist.jsx';
import { ALERT_WINDOW_PRESETS } from '../../shared/schema.js';

export function NoteItem({ note, onUpdate, onDelete }) {
  const [mode, setMode] = useState(note.mode || 'text');
  const [text, setText] = useState(note.text || '');

  const noteRef = React.useRef(note);
  const textRef = React.useRef(text);
  const debounceTimerRef = React.useRef(null);
  const onUpdateRef = React.useRef(onUpdate);
  const isDeletingRef = React.useRef(false);

  React.useEffect(() => {
    noteRef.current = note;
    onUpdateRef.current = onUpdate;
  }, [note, onUpdate]);

  // Sync if external note or id changes
  React.useEffect(() => {
    setText(note.text || '');
    textRef.current = note.text || '';
    isDeletingRef.current = false;
  }, [note.id, note.text]);

  const flushSave = React.useCallback(() => {
    if (isDeletingRef.current) return;
    if (debounceTimerRef.current) {
      clearTimeout(debounceTimerRef.current);
      debounceTimerRef.current = null;
    }
    if (textRef.current !== noteRef.current.text) {
      onUpdateRef.current({ ...noteRef.current, text: textRef.current });
    }
  }, []);

  // Flush on unmount and beforeunload
  React.useEffect(() => {
    window.addEventListener('beforeunload', flushSave);
    return () => {
      window.removeEventListener('beforeunload', flushSave);
      if (!isDeletingRef.current) {
        flushSave();
      }
    };
  }, [flushSave]);

  const handleTextChange = (e) => {
    if (isDeletingRef.current) return;
    const newText = e.target.value;
    setText(newText);
    textRef.current = newText;

    if (debounceTimerRef.current) {
      clearTimeout(debounceTimerRef.current);
    }
    debounceTimerRef.current = setTimeout(() => {
      debounceTimerRef.current = null;
      if (!isDeletingRef.current && textRef.current !== noteRef.current.text) {
        onUpdateRef.current({ ...noteRef.current, text: textRef.current });
      }
    }, 350);
  };

  const handleBlur = () => {
    if (!isDeletingRef.current) {
      flushSave();
    }
  };

  const handleChecklistChange = (checklist) => {
    if (isDeletingRef.current) return;
    flushSave();
    onUpdate({ ...note, checklist });
  };

  const handleDeadlineChange = (e) => {
    if (isDeletingRef.current) return;
    flushSave();
    const val = e.target.value;
    const epoch = val ? new Date(val).getTime() : null;
    const defaultAlerts = epoch && !note.alertWindowsMin ? [60, 0] : (note.alertWindowsMin || [60, 0]);
    onUpdate({
      ...note,
      deadline: epoch,
      alertWindowsMin: epoch ? defaultAlerts : undefined,
      firedReminders: []
    });
  };

  const currentAlertWindows = Array.isArray(note.alertWindowsMin)
    ? note.alertWindowsMin
    : [60, 0];

  const handleToggleAlertWindow = (min) => {
    if (isDeletingRef.current) return;
    flushSave();
    let nextWindows;
    if (currentAlertWindows.includes(min)) {
      nextWindows = currentAlertWindows.filter((w) => w !== min);
    } else {
      nextWindows = [...currentAlertWindows, min];
    }
    onUpdate({
      ...note,
      alertWindowsMin: nextWindows,
      firedReminders: []
    });
  };

  const handleDelete = (e) => {
    e.stopPropagation();
    isDeletingRef.current = true;
    if (debounceTimerRef.current) {
      clearTimeout(debounceTimerRef.current);
      debounceTimerRef.current = null;
    }
    onDelete(note.id);
  };

  const deadlineFormatted = note.deadline
    ? new Date(note.deadline).toISOString().slice(0, 16)
    : '';

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%', gap: '6px' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <div style={{ display: 'flex', gap: '4px' }}>
          <button
            className="icon-btn"
            title="Text Note"
            onClick={() => setMode('text')}
            style={{ opacity: mode === 'text' ? 1 : 0.4 }}
          >
            <AlignLeft size={14} />
          </button>
          <button
            className="icon-btn"
            title="Checklist"
            onClick={() => setMode('checklist')}
            style={{ opacity: mode === 'checklist' ? 1 : 0.4 }}
          >
            <ListCheck size={14} />
          </button>
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
          <input
            type="datetime-local"
            value={deadlineFormatted}
            onChange={handleDeadlineChange}
            style={{
              background: 'rgba(0,0,0,0.2)',
              border: 'none',
              borderRadius: '4px',
              color: 'inherit',
              fontSize: '11px',
              padding: '2px 4px'
            }}
          />
          <button
            className="icon-btn"
            onMouseDown={() => {
              isDeletingRef.current = true;
              if (debounceTimerRef.current) {
                clearTimeout(debounceTimerRef.current);
                debounceTimerRef.current = null;
              }
            }}
            onClick={handleDelete}
            title="Delete Note"
          >
            <Trash2 size={14} />
          </button>
        </div>
      </div>

      {note.deadline && (
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: '6px',
            fontSize: '10px',
            opacity: 0.9,
            padding: '2px 0',
            flexWrap: 'wrap'
          }}
        >
          <span style={{ display: 'flex', alignItems: 'center', gap: '3px', fontWeight: 600 }}>
            <Bell size={10} /> Alert:
          </span>
          <div style={{ display: 'flex', gap: '4px', flexWrap: 'wrap' }}>
            {ALERT_WINDOW_PRESETS.map((preset) => {
              const checked = currentAlertWindows.includes(preset.min);
              return (
                <label
                  key={preset.min}
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: '2px',
                    cursor: 'pointer',
                    userSelect: 'none',
                    background: checked ? 'rgba(255,255,255,0.22)' : 'rgba(0,0,0,0.25)',
                    padding: '1px 5px',
                    borderRadius: '3px',
                    border: checked ? '1px solid rgba(255,255,255,0.3)' : '1px solid transparent',
                    transition: 'all 0.15s ease'
                  }}
                >
                  <input
                    type="checkbox"
                    checked={checked}
                    onChange={() => handleToggleAlertWindow(preset.min)}
                    style={{ width: '10px', height: '10px', margin: 0, cursor: 'pointer' }}
                  />
                  <span>{preset.label}</span>
                </label>
              );
            })}
          </div>
        </div>
      )}

      <div style={{ flex: 1, overflowY: 'auto' }}>
        {mode === 'text' ? (
          <textarea
            className="note-textarea"
            placeholder="Type your note here..."
            value={text}
            onChange={handleTextChange}
            onBlur={handleBlur}
          />
        ) : (
          <Checklist items={note.checklist || []} onChange={handleChecklistChange} />
        )}
      </div>
    </div>
  );
}
