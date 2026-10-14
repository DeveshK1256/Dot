import React, { useState } from 'react';
import { Trash2, Calendar, ListCheck, AlignLeft } from 'lucide-react';
import { Checklist } from './Checklist.jsx';

export function NoteItem({ note, onUpdate, onDelete }) {
  const [mode, setMode] = useState(note.mode || 'text');

  const handleTextChange = (e) => {
    onUpdate({ ...note, text: e.target.value });
  };

  const handleChecklistChange = (checklist) => {
    onUpdate({ ...note, checklist });
  };

  const handleDeadlineChange = (e) => {
    const val = e.target.value;
    const epoch = val ? new Date(val).getTime() : null;
    onUpdate({ ...note, deadline: epoch, firedReminders: [] });
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
          <button className="icon-btn" onClick={() => onDelete(note.id)} title="Delete Note">
            <Trash2 size={14} />
          </button>
        </div>
      </div>

      <div style={{ flex: 1, overflowY: 'auto' }}>
        {mode === 'text' ? (
          <textarea
            className="note-textarea"
            placeholder="Type your note here..."
            value={note.text || ''}
            onChange={handleTextChange}
          />
        ) : (
          <Checklist items={note.checklist || []} onChange={handleChecklistChange} />
        )}
      </div>
    </div>
  );
}
