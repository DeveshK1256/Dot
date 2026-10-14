import React, { useState, useEffect } from 'react';
import { DotExpanded } from './DotExpanded.jsx';
import { HubExpanded } from './HubExpanded.jsx';
import { useExpandTimer } from '../hooks/useExpandTimer.js';
import { Layers } from 'lucide-react';

export function Dot({ dotId }) {
  const [dot, setDot] = useState(null);
  const [globalSettings, setGlobalSettings] = useState(null);
  const [notes, setNotes] = useState([]);
  const [isPinned, setIsPinned] = useState(false);
  const [urgency, setUrgency] = useState('normal'); // 'normal' | 'warning' | 'critical'
  const [undoNote, setUndoNote] = useState(null);

  // Compute effective settings (dot override takes precedence over global default)
  const effectiveColor = dot?.color || globalSettings?.defaultDotColor || '#3b82f6';
  const effectiveOpacity = dot?.opacity ?? globalSettings?.defaultOpacity ?? 0.88;
  const effectiveBlurRadius = dot?.blurRadius ?? globalSettings?.defaultBlurRadius ?? 12;
  const effectiveTextSize = dot?.textSize ?? globalSettings?.defaultTextSize ?? 14;
  const effectiveTextColor = dot?.textColor ?? globalSettings?.defaultTextColor ?? '#ffffff';
  const effectiveExpandTimerMs = dot?.expandTimerMs ?? globalSettings?.defaultExpandTimerMs ?? 4000;

  // Expand timer hook
  const { expanded, expand, scheduleShrink, collapse, clearTimer } = useExpandTimer({
    expandTimerMs: effectiveExpandTimerMs,
    isPinned,
    isEditing: false
  });

  // Load Dot, Global Settings, and Notes
  useEffect(() => {
    async function loadData() {
      if (window.electronAPI) {
        const settings = await window.electronAPI.getSettings();
        setGlobalSettings(settings);

        const dots = await window.electronAPI.getDots();
        const current = dots.find((d) => d.id === dotId) || {
          id: dotId,
          position: { x: 100, y: 100 },
          noteIds: []
        };
        setDot(current);

        const loadedNotes = await window.electronAPI.getNotesByDot(dotId);
        setNotes(loadedNotes);
      }
    }
    loadData();

    // Listen to live events
    if (window.electronAPI) {
      const unsubUrgency = window.electronAPI.onUrgencyUpdate(({ dotId: id, urgency: urg }) => {
        if (id === dotId) setUrgency(urg);
      });
      const unsubSettings = window.electronAPI.onSettingsUpdated((newSettings) => {
        setGlobalSettings(newSettings);
      });
      const unsubDisplayMode = window.electronAPI.onDisplayModeChanged ? window.electronAPI.onDisplayModeChanged((mode) => {
        setGlobalSettings((prev) => prev ? { ...prev, displayMode: mode } : { displayMode: mode });
      }) : () => {};
      const unsubDot = window.electronAPI.onDotUpdated((updatedDot) => {
        if (updatedDot.id === dotId) {
          setDot(updatedDot);
        }
      });
      const unsubNote = window.electronAPI.onNoteUpdated ? window.electronAPI.onNoteUpdated((updatedNote) => {
        if (updatedNote.dotId === dotId) {
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
      }) : () => {};

      const unsubFocus = window.electronAPI.onFocusInput ? window.electronAPI.onFocusInput(() => {
        expand();
      }) : () => {};

      const unsubCollapseHub = window.electronAPI.onCollapseHub ? window.electronAPI.onCollapseHub(() => {
        collapse();
      }) : () => {};

      return () => {
        unsubUrgency();
        unsubSettings();
        unsubDisplayMode();
        unsubDot();
        unsubNote();
        unsubFocus();
        unsubCollapseHub();
      };
    }
  }, [dotId, expand, collapse]);

  // Synchronize dynamic window bounds between collapsed (48px) and expanded (340px)
  useEffect(() => {
    if (window.electronAPI) {
      window.electronAPI.setDotState(dotId, expanded ? 'EXPANDED' : 'COLLAPSED');
    }
  }, [dotId, expanded]);

  const handleSaveNote = async (updatedNote) => {
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

  const handleDeleteNote = async (noteId) => {
    const toDelete = notes.find((n) => n.id === noteId);
    if (!toDelete) return;

    // Undo buffer
    setUndoNote(toDelete);
    setTimeout(() => {
      setUndoNote((cur) => (cur?.id === noteId ? null : cur));
    }, 3000);

    if (window.electronAPI) {
      await window.electronAPI.deleteNote(noteId);
      setNotes((prev) => prev.filter((n) => n.id !== noteId));
    }
  };

  const handleUndo = async () => {
    if (undoNote && window.electronAPI) {
      await window.electronAPI.saveNote(undoNote);
      setNotes((prev) => [...prev, undoNote]);
      setUndoNote(null);
    }
  };

  const handleSaveDotSettings = async (updatedDot) => {
    if (window.electronAPI) {
      await window.electronAPI.saveDot(updatedDot);
      setDot(updatedDot);
    }
  };

  const handleResetDotSettings = async () => {
    if (window.electronAPI && dot) {
      const resetDot = {
        id: dot.id,
        position: dot.position,
        noteIds: dot.noteIds || [],
        isPinned: dot.isPinned || false
      };
      await window.electronAPI.saveDot(resetDot);
      setDot(resetDot);
    }
  };

  const handleCloseDot = async (deletePermanently) => {
    if (window.electronAPI) {
      if (deletePermanently) {
        await window.electronAPI.deleteDot(dotId, true);
        window.electronAPI.closeDotWindow(dotId);
      } else {
        clearTimer();
        window.electronAPI.hideDotWindow(dotId);
      }
    }
  };

  if (!dot) return null;

  return (
    <div
      className="app-container"
      onMouseEnter={expand}
      onMouseLeave={scheduleShrink}
      style={{
        '--dot-bg': effectiveColor,
        '--dot-opacity': effectiveOpacity,
        '--dot-blur': `${effectiveBlurRadius}px`,
        '--dot-text-size': `${effectiveTextSize}px`,
        '--dot-text-color': effectiveTextColor
      }}
    >
      {!expanded ? (
        dot.isHub && globalSettings?.displayMode === 'hubOnly' ? (
          <div
            className={`hub-edge-tab edge-${dot.hubEdge || 'right'}`}
            onClick={expand}
            title="Dot Hub (Click or hover to expand)"
          >
            <div
              className="hub-edge-tab-bg"
              style={{
                backgroundColor: dot.hubColor || dot.color || '#4f46e5',
                opacity: dot.hubOpacity ?? dot.opacity ?? 0.92
              }}
            />
          </div>
        ) : (
          <div
            className={`dot-collapsed urgency-${urgency}`}
            onClick={expand}
            title={dot.isHub ? 'Dot Hub' : 'Dot Note'}
            style={dot.isHub ? { border: '2px solid rgba(255, 255, 255, 0.45)' } : {}}
          >
            <div className="dot-collapsed-bg" />
            {dot.isHub && (
              <div
                style={{
                  position: 'relative',
                  zIndex: 2,
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  width: '100%',
                  height: '100%',
                  color: '#ffffff'
                }}
              >
                <Layers size={18} strokeWidth={2.4} />
              </div>
            )}
          </div>
        )
      ) : dot.isHub ? (
        <HubExpanded
          dot={dot}
          globalSettings={globalSettings}
          isPinned={isPinned}
          onTogglePin={() => setIsPinned(!isPinned)}
          onClose={() => collapse()}
          onSaveDotSettings={handleSaveDotSettings}
          onResetDotSettings={handleResetDotSettings}
        />
      ) : (
        <DotExpanded
          dot={dot}
          notes={notes}
          globalSettings={globalSettings}
          isPinned={isPinned}
          onTogglePin={() => setIsPinned(!isPinned)}
          onClose={handleCloseDot}
          onSaveNote={handleSaveNote}
          onDeleteNote={handleDeleteNote}
          onSaveDotSettings={handleSaveDotSettings}
          onResetDotSettings={handleResetDotSettings}
        />
      )}

      {undoNote && (
        <div className="undo-snackbar">
          <span>Note deleted</span>
          <button className="undo-btn" onClick={handleUndo}>
            Undo
          </button>
        </div>
      )}
    </div>
  );
}
