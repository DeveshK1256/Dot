import React, { useState, useEffect } from 'react';
import { X, Pin, Plus, ArrowLeft, Layers, CheckSquare, Clock, Settings, Palette } from 'lucide-react';
import { NoteItem } from './NoteItem.jsx';
import { HubSettingsModal } from './HubSettingsModal.jsx';
import { NoteSettingsModal } from './DotSettingsModal.jsx';

export function HubExpanded({
  dot,
  globalSettings,
  isPinned,
  onTogglePin,
  onClose,
  onSaveDotSettings,
  onResetDotSettings
}) {
  const [notes, setNotes] = useState([]);
  const [selectedNoteId, setSelectedNoteId] = useState(null);
  const [isSettingsOpen, setIsSettingsOpen] = useState(false);
  const [isNoteSettingsOpen, setIsNoteSettingsOpen] = useState(false);

  const effectiveOpacity = dot?.hubOpacity ?? dot?.opacity ?? globalSettings?.defaultOpacity ?? 0.92;
  const effectiveBlurRadius = dot?.blurRadius ?? globalSettings?.defaultBlurRadius ?? 12;
  const effectiveColor = dot?.hubColor || dot?.color || '#1e1b4b';
  const borderStyle = dot?.hubBorderStyle || 'solid';
  const border = borderStyle === 'none' ? 'none' : `1px ${borderStyle} rgba(255, 255, 255, 0.2)`;

  // Fetch notes
  const refreshData = async () => {
    if (!window.electronAPI) return;
    try {
      const allNotes = await window.electronAPI.getAllNotes();
      setNotes(allNotes || []);
    } catch (err) {
      console.error('Failed to refresh hub notes:', err);
    }
  };

  useEffect(() => {
    refreshData();

    if (window.electronAPI) {
      const unsubNote = window.electronAPI.onNoteUpdated((updatedNote) => {
        setNotes((prev) => {
          const idx = prev.findIndex((n) => n.id === updatedNote.id);
          if (idx !== -1) {
            const next = [...prev];
            next[idx] = updatedNote;
            return next;
          }
          return [updatedNote, ...prev];
        });
      });

      const unsubNoteDel = window.electronAPI.onNoteDeleted((deletedNoteId) => {
        setNotes((prev) => prev.filter((n) => n.id !== deletedNoteId));
        if (selectedNoteId === deletedNoteId) {
          setSelectedNoteId(null);
        }
      });

      const unsubFocus = window.electronAPI.onFocusInput ? window.electronAPI.onFocusInput(() => {
        handleCreateNewNote();
      }) : () => {};

      return () => {
        unsubNote();
        unsubNoteDel();
        unsubFocus();
      };
    }
  }, [selectedNoteId, globalSettings]);

  // Apply configurable sort order
  const sortOrder = dot?.sortOrder || 'newest';
  const noteList = [...notes].sort((a, b) => {
    if (sortOrder === 'oldest') {
      return (a.createdAt || 0) - (b.createdAt || 0);
    }
    if (sortOrder === 'alphabetical') {
      const textA = (a.text || '').trim().toLowerCase();
      const textB = (b.text || '').trim().toLowerCase();
      return textA.localeCompare(textB);
    }
    return (b.createdAt || 0) - (a.createdAt || 0); // 'newest'
  });

  const activeNote = notes.find((n) => n.id === selectedNoteId);

  const handleRowClick = (note) => {
    setSelectedNoteId(note.id);
  };

  const handleCreateNewNote = async () => {
    const newId = `note-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;
    const newNote = {
      id: newId,
      dotId: 'hub-dot',
      text: '',
      checklist: [],
      deadline: null,
      firedReminders: [],
      color: globalSettings?.defaultDotColor || '#3b82f6',
      opacity: globalSettings?.defaultOpacity ?? 0.88,
      textSize: globalSettings?.defaultTextSize ?? 14,
      textColor: globalSettings?.defaultTextColor ?? '#ffffff',
      blurRadius: globalSettings?.defaultBlurRadius ?? 12,
      createdAt: Date.now(),
      updatedAt: Date.now()
    };

    setNotes((prev) => [newNote, ...prev]);
    setSelectedNoteId(newId);

    if (window.electronAPI) {
      await window.electronAPI.saveNote(newNote);
    }
  };

  const handleSaveInlineNote = async (updatedNote) => {
    setNotes((prev) => {
      const idx = prev.findIndex((n) => n.id === updatedNote.id);
      if (idx !== -1) {
        const next = [...prev];
        next[idx] = updatedNote;
        return next;
      }
      return [updatedNote, ...prev];
    });

    if (window.electronAPI) {
      await window.electronAPI.saveNote(updatedNote);
    }
  };

  const handleDeleteInlineNote = async (noteId) => {
    if (window.electronAPI) {
      await window.electronAPI.deleteNote(noteId);
      setNotes((prev) => prev.filter((n) => n.id !== noteId));
      setSelectedNoteId(null);
    }
  };

  return (
    <div
      className="dot-expanded-card"
      style={{
        width: '340px',
        height: '100%',
        maxHeight: '380px',
        position: 'relative',
        border: border || '1px solid rgba(255, 255, 255, 0.2)',
        boxShadow: '0 8px 32px rgba(0, 0, 0, 0.25)'
      }}
    >
      {/* Background layer */}
      <div
        className="card-bg-layer"
        style={{
          background: `linear-gradient(135deg, rgba(255, 255, 255, 0.15) 0%, rgba(255, 255, 255, 0.04) 100%), ${effectiveColor}`,
          opacity: effectiveOpacity,
          backdropFilter: `blur(${effectiveBlurRadius}px)`,
          WebkitBackdropFilter: `blur(${effectiveBlurRadius}px)`
        }}
      />

      {/* Card Header */}
      <div className="card-header" style={{ position: 'relative', zIndex: 1, padding: '0 12px' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
          <Layers size={15} style={{ color: '#818cf8' }} />
          <span className="header-title" style={{ color: '#ffffff', letterSpacing: '0.8px', fontWeight: 'bold' }}>
            DOT
          </span>
          <span
            style={{
              fontSize: '11px',
              padding: '1px 6px',
              borderRadius: '10px',
              background: '#4338ca',
              color: '#ffffff',
              fontWeight: 500
            }}
          >
            {noteList.length} {noteList.length === 1 ? 'note' : 'notes'}
          </span>
        </div>

        <div className="header-actions">
          <button
            className="icon-btn"
            title="Create New Note"
            onClick={handleCreateNewNote}
            style={{ color: '#ffffff' }}
          >
            <Plus size={15} />
          </button>
          <button
            className="icon-btn"
            title="Dot Settings"
            onClick={() => setIsSettingsOpen(true)}
            style={{ color: '#ffffff' }}
          >
            <Settings size={14} />
          </button>
          <button
            className="icon-btn"
            title={isPinned ? 'Unpin (auto-shrink enabled)' : 'Pin (keep open)'}
            onClick={onTogglePin}
            style={{ color: isPinned ? '#facc15' : '#ffffff' }}
          >
            <Pin size={14} />
          </button>
          <button className="icon-btn" title="Close Dot" onClick={onClose} style={{ color: '#ffffff' }}>
            <X size={15} />
          </button>
        </div>
      </div>

      {/* Card Body */}
      <div
        className="card-body"
        style={{
          position: 'relative',
          zIndex: 1,
          flex: 1,
          padding: '10px 12px',
          overflow: 'hidden',
          display: 'flex',
          flexDirection: 'column'
        }}
      >
        {activeNote ? (
          /* Inline Note Editor View */
          <div style={{ display: 'flex', flexDirection: 'column', height: '100%', gap: '8px' }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', borderBottom: '1px solid rgba(255,255,255,0.1)', paddingBottom: '6px' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px', overflow: 'hidden' }}>
                <button
                  className="icon-btn"
                  title="Back to All Notes"
                  onClick={() => {
                    setSelectedNoteId(null);
                    setIsNoteSettingsOpen(false);
                  }}
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: '4px',
                    color: '#93c5fd',
                    fontSize: '11px',
                    background: 'none',
                    border: 'none',
                    cursor: 'pointer'
                  }}
                >
                  <ArrowLeft size={13} />
                  <span>Notes</span>
                </button>
                <span style={{ fontSize: '11px', opacity: 0.5 }}>|</span>
                <span style={{ fontSize: '11px', opacity: 0.8, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', maxWidth: '160px' }}>
                  {activeNote.text ? activeNote.text.split('\n')[0] : 'Untitled Note'}
                </span>
              </div>
              <button
                className="icon-btn"
                title="Note Style & Colors"
                onClick={() => setIsNoteSettingsOpen(!isNoteSettingsOpen)}
                style={{
                  color: activeNote.color || '#93c5fd',
                  background: 'none',
                  border: 'none',
                  cursor: 'pointer',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '4px'
                }}
              >
                <Palette size={13} />
              </button>
            </div>

            <div style={{ flex: 1, overflowY: 'auto' }}>
              <NoteItem
                note={activeNote}
                onUpdate={handleSaveInlineNote}
                onDelete={handleDeleteInlineNote}
              />
            </div>

            {isNoteSettingsOpen && (
              <NoteSettingsModal
                note={activeNote}
                globalSettings={globalSettings}
                onSave={async (styledNote) => {
                  await handleSaveInlineNote(styledNote);
                  setIsNoteSettingsOpen(false);
                }}
                onClose={() => setIsNoteSettingsOpen(false)}
                onReset={async () => {
                  const resetNote = {
                    ...activeNote,
                    color: globalSettings?.defaultDotColor || '#3b82f6',
                    opacity: globalSettings?.defaultOpacity ?? 0.88,
                    textSize: globalSettings?.defaultTextSize ?? 14,
                    textColor: globalSettings?.defaultTextColor ?? '#ffffff',
                    blurRadius: globalSettings?.defaultBlurRadius ?? 12
                  };
                  await handleSaveInlineNote(resetNote);
                  setIsNoteSettingsOpen(false);
                }}
              />
            )}
          </div>
        ) : (
          /* Notes List View */
          <div style={{ display: 'flex', flexDirection: 'column', height: '100%' }}>
            {/* New Note Button at Top of List */}
            <button
              onClick={handleCreateNewNote}
              style={{
                width: '100%',
                padding: '7px 10px',
                background: 'linear-gradient(135deg, rgba(255, 255, 255, 0.1) 0%, rgba(255, 255, 255, 0.03) 100%)',
                backdropFilter: 'blur(8px)',
                WebkitBackdropFilter: 'blur(8px)',
                border: '1px dashed rgba(255, 255, 255, 0.25)',
                borderRadius: '8px',
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                gap: '6px',
                color: '#93c5fd',
                fontSize: '12px',
                fontWeight: 500,
                marginBottom: '8px',
                boxShadow: '0 2px 6px rgba(0, 0, 0, 0.12)',
                transition: 'all 0.15s ease'
              }}
              onMouseEnter={(e) => {
                e.currentTarget.style.background = 'linear-gradient(135deg, rgba(255, 255, 255, 0.18) 0%, rgba(255, 255, 255, 0.08) 100%)';
                e.currentTarget.style.borderColor = 'rgba(255, 255, 255, 0.4)';
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.background = 'linear-gradient(135deg, rgba(255, 255, 255, 0.1) 0%, rgba(255, 255, 255, 0.03) 100%)';
                e.currentTarget.style.borderColor = 'rgba(255, 255, 255, 0.25)';
              }}
            >
              <Plus size={14} />
              <span>Create New Note</span>
            </button>

            <div
              style={{
                flex: 1,
                overflowY: 'auto',
                display: 'flex',
                flexDirection: 'column',
                gap: '6px',
                paddingRight: '2px'
              }}
            >
              {noteList.length === 0 ? (
                <div
                  style={{
                    height: '100%',
                    display: 'flex',
                    flexDirection: 'column',
                    alignItems: 'center',
                    justifyContent: 'center',
                    gap: '10px',
                    color: 'rgba(255,255,255,0.5)',
                    fontSize: '12px'
                  }}
                >
                  <span>No notes created yet.</span>
                </div>
              ) : (
                noteList.map((note) => {
                  const noteColor = note.color || '#3b82f6';
                  const title = note.text ? note.text.split('\n')[0] : 'Empty note';
                  const hasChecklist = note.checklist && note.checklist.length > 0;
                  const completedChecks = hasChecklist
                    ? note.checklist.filter((c) => c.done).length
                    : 0;

                  return (
                    <div
                      key={note.id}
                      onClick={() => handleRowClick(note)}
                      style={{
                        padding: '8px 10px',
                        background: 'linear-gradient(135deg, rgba(255, 255, 255, 0.09) 0%, rgba(255, 255, 255, 0.03) 100%)',
                        backdropFilter: 'blur(8px)',
                        WebkitBackdropFilter: 'blur(8px)',
                        borderRadius: '8px',
                        cursor: 'pointer',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'space-between',
                        gap: '8px',
                        border: '1px solid rgba(255, 255, 255, 0.14)',
                        boxShadow: '0 2px 8px rgba(0, 0, 0, 0.15)',
                        transition: 'all 0.15s ease'
                      }}
                      onMouseEnter={(e) => {
                        e.currentTarget.style.background = 'linear-gradient(135deg, rgba(255, 255, 255, 0.18) 0%, rgba(255, 255, 255, 0.08) 100%)';
                        e.currentTarget.style.borderColor = 'rgba(255, 255, 255, 0.28)';
                        e.currentTarget.style.boxShadow = '0 4px 12px rgba(0, 0, 0, 0.22)';
                      }}
                      onMouseLeave={(e) => {
                        e.currentTarget.style.background = 'linear-gradient(135deg, rgba(255, 255, 255, 0.09) 0%, rgba(255, 255, 255, 0.03) 100%)';
                        e.currentTarget.style.borderColor = 'rgba(255, 255, 255, 0.14)';
                        e.currentTarget.style.boxShadow = '0 2px 8px rgba(0, 0, 0, 0.15)';
                      }}
                    >
                      <div style={{ display: 'flex', alignItems: 'center', gap: '8px', overflow: 'hidden' }}>
                        <div
                          style={{
                            width: '10px',
                            height: '10px',
                            borderRadius: '50%',
                            backgroundColor: noteColor,
                            flexShrink: 0
                          }}
                        />
                        <span
                          style={{
                            fontSize: note.textSize ? `${note.textSize}px` : '12px',
                            color: note.textColor || '#ffffff',
                            fontWeight: 500,
                            overflow: 'hidden',
                            textOverflow: 'ellipsis',
                            whiteSpace: 'nowrap',
                            maxWidth: '180px'
                          }}
                        >
                          {title}
                        </span>
                      </div>

                      <div style={{ display: 'flex', alignItems: 'center', gap: '6px', flexShrink: 0 }}>
                        {hasChecklist && (dot?.showCompletedChecklists !== false || completedChecks < note.checklist.length) && (
                          <div
                            style={{
                              display: 'flex',
                              alignItems: 'center',
                              gap: '2px',
                              fontSize: '10px',
                              color: completedChecks === note.checklist.length ? '#4ade80' : 'rgba(255,255,255,0.6)'
                            }}
                          >
                            <CheckSquare size={11} />
                            <span>
                              {completedChecks}/{note.checklist.length}
                            </span>
                          </div>
                        )}
                        {note.deadline && (
                          <div
                            style={{
                              display: 'flex',
                              alignItems: 'center',
                              gap: '2px',
                              fontSize: '10px',
                              color: '#facc15'
                            }}
                            title={new Date(note.deadline).toLocaleString()}
                          >
                            <Clock size={11} />
                            <span>
                              {new Date(note.deadline).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                            </span>
                          </div>
                        )}
                      </div>
                    </div>
                  );
                })
              )}
            </div>
          </div>
        )}
      </div>

      {isSettingsOpen && (
        <HubSettingsModal
          dot={dot}
          onSave={async (updatedDot) => {
            if (onSaveDotSettings) {
              await onSaveDotSettings(updatedDot);
            }
            setIsSettingsOpen(false);
          }}
          onClose={() => setIsSettingsOpen(false)}
          onReset={async () => {
            if (onResetDotSettings) {
              await onResetDotSettings();
            }
            setIsSettingsOpen(false);
          }}
        />
      )}
    </div>
  );
}
