import React from 'react';
import { Plus } from 'lucide-react';

export function PlusButton() {
  const handleClick = (e) => {
    if (e) {
      e.preventDefault();
      e.stopPropagation();
    }
    if (window.electronAPI) {
      window.electronAPI.spawnDotFromPlusButton();
    }
  };

  return (
    <div
      onClick={handleClick}
      style={{
        width: '100vw',
        height: '100vh',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        background: 'transparent',
        userSelect: 'none',
        cursor: 'pointer',
        WebkitAppRegion: 'no-drag'
      }}
    >
      <button
        onClick={handleClick}
        title="Create new Dot"
        style={{
          width: '38px',
          height: '38px',
          borderRadius: '50%',
          backgroundColor: '#3b82f6',
          border: '1.5px solid rgba(255, 255, 255, 0.35)',
          color: '#ffffff',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          cursor: 'pointer',
          boxShadow: '0 4px 14px rgba(0, 0, 0, 0.45)',
          transition: 'transform 0.1s ease, background-color 0.15s ease',
          outline: 'none',
          WebkitAppRegion: 'no-drag'
        }}
        onMouseEnter={(e) => {
          e.currentTarget.style.transform = 'scale(1.1)';
          e.currentTarget.style.backgroundColor = '#2563eb';
        }}
        onMouseLeave={(e) => {
          e.currentTarget.style.transform = 'scale(1.0)';
          e.currentTarget.style.backgroundColor = '#3b82f6';
        }}
        onMouseDown={(e) => {
          e.currentTarget.style.transform = 'scale(0.92)';
        }}
        onMouseUp={(e) => {
          e.currentTarget.style.transform = 'scale(1.1)';
        }}
      >
        <Plus size={20} strokeWidth={2.5} />
      </button>
    </div>
  );
}
