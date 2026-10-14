import React, { useState } from 'react';
import { Plus, Trash2, CheckSquare, Square } from 'lucide-react';

export function Checklist({ items = [], onChange }) {
  const [newText, setNewText] = useState('');

  const toggleDone = (id) => {
    const next = items.map((it) => (it.id === id ? { ...it, done: !it.done } : it));
    onChange(next);
  };

  const removeItem = (id) => {
    const next = items.filter((it) => it.id !== id);
    onChange(next);
  };

  const handleKeyDown = (e) => {
    if (e.key === 'Enter' && newText.trim()) {
      e.preventDefault();
      const newItem = {
        id: `item-${Date.now()}-${Math.random().toString(36).substr(2, 4)}`,
        label: newText.trim(),
        done: false
      };
      onChange([...items, newItem]);
      setNewText('');
    }
  };

  return (
    <div className="checklist-container">
      {items.map((item) => (
        <div key={item.id} className="checklist-row">
          <button
            className="icon-btn"
            onClick={() => toggleDone(item.id)}
            style={{ padding: '2px' }}
          >
            {item.done ? <CheckSquare size={16} /> : <Square size={16} />}
          </button>
          <span className={`checklist-input ${item.done ? 'item-done' : ''}`}>
            {item.label}
          </span>
          <button
            className="icon-btn"
            onClick={() => removeItem(item.id)}
            style={{ opacity: 0.5, padding: '2px' }}
          >
            <Trash2 size={13} />
          </button>
        </div>
      ))}

      <div className="checklist-row" style={{ marginTop: '4px' }}>
        <Plus size={16} style={{ opacity: 0.5 }} />
        <input
          className="checklist-input"
          placeholder="Add task and press Enter..."
          value={newText}
          onChange={(e) => setNewText(e.target.value)}
          onKeyDown={handleKeyDown}
        />
      </div>
    </div>
  );
}
