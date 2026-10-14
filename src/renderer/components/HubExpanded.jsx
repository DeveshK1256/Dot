import React, { useState, useEffect } from 'react';
import { X, Pin, Plus, ArrowLeft, Layers, CheckSquare, Clock, ExternalLink, Settings } from 'lucide-react';
import { NoteItem } from './NoteItem.jsx';
import { HubSettingsModal } from './HubSettingsModal.jsx';

export function HubExpanded({
  dot,
  globalSettings,
  isPinned,
  onTogglePin,
  onClose,
  onSaveDotSettings,
  onResetDotSettings
}) {
  const [dots, setDots] = useState([]);
  const [notes, setNotes] = useState([]);
  const [selectedNoteId, setSelectedNoteId] = useState(null);
  const [displayMode, setDisplayMode] = useState(globalSettings?.displayMode || 'all');
  const [isSettingsOpen, setIsSettingsOpen] = useState(false);

  const effectiveOpacity = dot?.hubOpacity ?? dot?.opacity ?? globalSettings?.defaultOpacity ?? 0.92;
  const effectiveBlurRadius = dot?.blurRadius ?? globalSettings?.defaultBlurRadius ?? 12;
  const effectiveColor = dot?.hubColor || dot?.color || '#1e1b4b';
  const borderStyle = dot?.hubBorderStyle || 'solid';
  const border = borderStyle === 'none' ? 'none' : `1px ${borderStyle} rgba(255, 255, 255, 0.2)`;

  // Fetch dots and notes
  const refreshData = async () => {
    if (!window.electronAPI) return;
    try {
      const [allDots, allNotes, settings] = await Promise.all([
        window.electronAPI.getDots(),
        window.electronAPI.getAllNotes(),
        window.electronAPI.getSettings()
      ]);
      setDots(allDots || []);
      setNotes(allNotes || []);
      if (settings?.displayMode) {
        setDisplayMode(settings.displayMode);
      }
    } catch (err) {
      console.error('Failed to refresh hub data:', err);
    }
  };

  useEffect(() => {
    refreshData();

    if (window.electronAPI) {
      const unsubDot = window.electronAPI.onDotUpdated(() => refreshData());
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
      const unsubSettings = window.electronAPI.onSettingsUpdated((newSettings) => {
        if (newSettings?.displayMode) {
          setDisplayMode(newSettings.displayMode);
        }
      });
      const unsubDisplayMode = window.electronAPI.onDisplayModeChanged((mode) => {
        setDisplayMode(mode);
      });

      return () => {
        unsubDot();
        unsubNote();
        unsubNoteDel();
        unsubSettings();
        unsubDisplayMode();
      };
    }
  }, [selectedNoteId]);

  // Map notes to their parent dots
  const rawNoteList = notes.filter((n) => {
    const parentDot = dots.find((d) => d.id === n.dotId);
    return parentDot && !parentDot.isHub;
  });

  // Apply configurable sort order
  const sortOrder = dot?.sortOrder || 'newest';
  const noteList = [...rawNoteList].sort((a, b) => {
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
    if (displayMode === 'hubOnly') {
      // In hubOnly mode, open note inline
      setSelectedNoteId(note.id);
    } else {
      // In all mode, bring that floating dot to front
      if (window.electronAPI) {
        window.electronAPI.bringDotToFront(note.dotId);
      }
    }
  };

  const handleCreateNewDot = () => {
    if (window.electronAPI) {
      window.electronAPI.spawnDotFromPlusButton();
    }
  };

  const handleSaveInlineNote = async (updatedNote) => {
    if (window.electronAPI) {
      await window.electronAPI.saveNote(updatedNote);
      setNotes((prev) => {
        const idx = prev.findIndex((n) => n.id === updatedNote.id);
        if (idx !== -1) {
          const next = [...prev];
          next[idx] = updatedNote;
          return next;
        }
        return [updatedNote, ...prev];
      });
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
        border: border
      }}
    >
      {/* Background layer */}
      <div
        className="card-bg-layer"
        style={{
          backgroundColor: effectiveColor,
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
            HUB
          </span>
          <span
            style={{
              fontSize: '11px',
              padding: '1px 6px',
              borderRadius: '10px',
              background: displayMode === 'hubOnly' ? '#4338ca' : 'rgba(255,255,255,0.15)',
              color: '#ffffff',
              fontWeight: 500
            }}
          >
            {displayMode === 'hubOnly' ? 'Hub Only' : `${noteList.length} notes`}
          </span>
        </div>

        <div className="header-actions">
          <button
            className="icon-btn"
            title="Create New Dot"
            onClick={handleCreateNewDot}
            style={{ color: '#ffffff' }}
          >
            <Plus size={15} />
          </button>
          <button
            className="icon-btn"
            title="Hub Settings"
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
          <button className="icon-btn" title="Close Hub" onClick={onClose} style={{ color: '#ffffff' }}>
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
        {activeNote && displayMode === 'hubOnly' ? (
          /* Inline Note Editor View */
          <div style={{ display: 'flex', flexDirection: 'column', height: '100%', gap: '8px' }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', borderBottom: '1px solid rgba(255,255,255,0.1)', paddingBottom: '6px' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px', overflow: 'hidden' }}>
                <button
                  className="icon-btn"
                  title="Back to Hub List"
                  onClick={() => setSelectedNoteId(null)}
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
                  <span>All Notes</span>
                </button>
                <span style={{ fontSize: '11px', opacity: 0.5 }}>|</span>
                <span style={{ fontSize: '11px', opacity: 0.8, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', maxWidth: '170px' }}>
                  {activeNote.text ? activeNote.text.split('\n')[0] : 'Untitled Note'}
                </span>
              </div>
              <button
                className="icon-btn"
                title="Pop out as Floating Dot"
                onClick={() => {
                  if (window.electronAPI) {
                    window.electronAPI.bringDotToFront(activeNote.dotId);
                  }
                }}
                style={{ color: '#93c5fd', background: 'none', border: 'none', cursor: 'pointer' }}
              >
                <ExternalLink size={13} />
              </button>
            </div>

            <div style={{ flex: 1, overflowY: 'auto' }}>
              <NoteItem
                note={activeNote}
                onUpdate={handleSaveInlineNote}
                onDelete={handleDeleteInlineNote}
              />
            </div>
          </div>
        ) : (
          /* Notes List View */
          <div style={{ display: 'flex', flexDirection: 'column', height: '100%' }}>
            <div
              style={{
                fontSize: '11px',
                color: 'rgba(255,255,255,0.7)',
                marginBottom: '8px',
                display: 'flex',
                justifyContent: 'space-between'
              }}
            >
              <span>{displayMode === 'hubOnly' ? 'Select a note to edit inline:' : 'Click a note to bring to front:'}</span>
              {displayMode === 'hubOnly' && (
                <span style={{ color: '#818cf8', fontSize: '10px' }}>[Floating Dots Hidden]</span>
              )}
            </div>

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
                  <button
                    onClick={handleCreateNewDot}
                    style={{
                      background: '#4f46e5',
                      border: 'none',
                      borderRadius: '6px',
                      color: '#ffffff',
                      padding: '6px 12px',
                      fontSize: '12px',
                      cursor: 'pointer',
                      display: 'flex',
                      alignItems: 'center',
                      gap: '4px'
                    }}
                  >
                    <Plus size={14} />
                    <span>Create First Dot</span>
                  </button>
                </div>
              ) : (
                noteList.map((note) => {
                  const parentDot = dots.find((d) => d.id === note.dotId);
                  const dotColor = parentDot?.color || '#3b82f6';
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
                        background: 'rgba(255,255,255,0.06)',
                        hover: { background: 'rgba(255,255,255,0.12)' },
                        borderRadius: '8px',
                        cursor: 'pointer',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'space-between',
                        gap: '8px',
                        border: '1px solid rgba(255,255,255,0.05)',
                        transition: 'background 0.15s ease'
                      }}
                      onMouseEnter={(e) => {
                        e.currentTarget.style.background = 'rgba(255,255,255,0.14)';
                      }}
                      onMouseLeave={(e) => {
                        e.currentTarget.style.background = 'rgba(255,255,255,0.06)';
                      }}
                    >
                      <div style={{ display: 'flex', alignItems: 'center', gap: '8px', overflow: 'hidden' }}>
                        <div
                          style={{
                            width: '10px',
                            height: '10px',
                            borderRadius: '50%',
                            backgroundColor: dotColor,
                            flexShrink: 0
                          }}
                        />
                        <span
                          style={{
                            fontSize: '12px',
                            color: '#ffffff',
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
