import React, { useState, useEffect } from 'react';
import { Boxes, X, ExternalLink, Unlink, CheckSquare, Clock } from 'lucide-react';

export function ClusterBadge({ clusterId }) {
  const [clusterData, setClusterData] = useState(null);
  const [expanded, setExpanded] = useState(false);

  useEffect(() => {
    async function loadData() {
      if (window.electronAPI) {
        const data = await window.electronAPI.getClusterData(clusterId);
        if (data) {
          setClusterData(data);
        }
      }
    }
    loadData();

    if (window.electronAPI) {
      const unsubCluster = window.electronAPI.onClusterDataUpdated(async (updatedCluster) => {
        if (updatedCluster && updatedCluster.clusterId === clusterId) {
          const freshData = await window.electronAPI.getClusterData(clusterId);
          if (freshData) {
            setClusterData(freshData);
          } else {
            setClusterData((prev) => (prev ? { ...prev, cluster: updatedCluster } : null));
          }
        }
      });

      const unsubNote = window.electronAPI.onNoteUpdated((updatedNote) => {
        setClusterData((prev) => {
          if (!prev) return prev;
          const idx = prev.notes.findIndex((n) => n.id === updatedNote.id);
          if (idx !== -1) {
            const nextNotes = [...prev.notes];
            nextNotes[idx] = updatedNote;
            return { ...prev, notes: nextNotes };
          }
          if (prev.cluster.dotIds.includes(updatedNote.dotId)) {
            return { ...prev, notes: [updatedNote, ...prev.notes] };
          }
          return prev;
        });
      });

      const unsubNoteDel = window.electronAPI.onNoteDeleted((deletedNoteId) => {
        setClusterData((prev) => {
          if (!prev) return prev;
          return {
            ...prev,
            notes: prev.notes.filter((n) => n.id !== deletedNoteId)
          };
        });
      });

      return () => {
        unsubCluster();
        unsubNote();
        unsubNoteDel();
      };
    }
  }, [clusterId]);

  const toggleExpand = (nextExpanded) => {
    setExpanded(nextExpanded);
    if (window.electronAPI) {
      window.electronAPI.setClusterState(clusterId, nextExpanded ? 'EXPANDED' : 'COLLAPSED');
    }
  };

  const handleOpenNoteDot = (dotId) => {
    if (window.electronAPI) {
      window.electronAPI.bringDotToFront(dotId);
    }
  };

  const handleUnclusterAll = () => {
    if (window.electronAPI) {
      window.electronAPI.uncluster(clusterId);
    }
  };

  if (!clusterData || !clusterData.cluster) {
    return null;
  }

  const { cluster, dots = [], notes = [] } = clusterData;
  const count = cluster.count || dots.length;

  return (
    <div className="app-container">
      {!expanded ? (
        <div
          className="cluster-collapsed"
          onClick={() => toggleExpand(true)}
          title={`Cluster of ${count} Dots (Click to open list)`}
        >
          {/* Physical stacked paper/disc layers behind bubble */}
          <div className="cluster-stack-layer cluster-stack-2" />
          <div className="cluster-stack-layer cluster-stack-1" />

          <div className="cluster-main-bubble">
            <Boxes size={13} strokeWidth={2.4} style={{ flexShrink: 0 }} />
            <span style={{ fontSize: '13px', fontWeight: 800, lineHeight: 1 }}>{count}</span>
          </div>
        </div>
      ) : (
        <div className="dot-expanded-card cluster-expanded-card">
          <div className="card-bg-layer cluster-bg-layer" />

          {/* Header */}
          <div className="card-header cluster-header">
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
              <Boxes size={15} style={{ color: '#c084fc' }} />
              <span className="header-title" style={{ color: '#ffffff', fontWeight: 'bold', letterSpacing: '0.6px' }}>
                CLUSTER
              </span>
              <span
                style={{
                  fontSize: '11px',
                  padding: '1px 6px',
                  borderRadius: '10px',
                  background: 'rgba(192, 132, 252, 0.25)',
                  color: '#e9d5ff',
                  fontWeight: 600
                }}
              >
                {count} Dots
              </span>
            </div>

            <div className="header-actions">
              <button
                className="icon-btn"
                title="Separate / Uncluster all dots"
                onClick={handleUnclusterAll}
                style={{ color: '#e9d5ff', display: 'flex', alignItems: 'center', gap: '4px', fontSize: '11px' }}
              >
                <Unlink size={13} />
                <span>Separate</span>
              </button>
              <button
                className="icon-btn"
                title="Collapse"
                onClick={() => toggleExpand(false)}
                style={{ color: '#ffffff' }}
              >
                <X size={15} />
              </button>
            </div>
          </div>

          {/* Body */}
          <div
            className="card-body"
            style={{ flex: 1, padding: '10px 12px', overflow: 'hidden', display: 'flex', flexDirection: 'column' }}
          >
            <div
              style={{
                fontSize: '11px',
                color: 'rgba(255,255,255,0.7)',
                marginBottom: '8px',
                display: 'flex',
                justifyContent: 'space-between'
              }}
            >
              <span>Click a note to open and drag it away:</span>
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
              {notes.length === 0 ? (
                <div
                  style={{
                    height: '100%',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    color: 'rgba(255,255,255,0.5)',
                    fontSize: '12px'
                  }}
                >
                  No notes in this cluster.
                </div>
              ) : (
                notes.map((note) => {
                  const parentDot = dots.find((d) => d.id === note.dotId);
                  const dotColor = parentDot?.color || '#a855f7';
                  const title = note.text ? note.text.split('\n')[0] : 'Empty note';
                  const hasChecklist = note.checklist && note.checklist.length > 0;
                  const completedChecks = hasChecklist
                    ? note.checklist.filter((c) => c.done).length
                    : 0;

                  return (
                    <div
                      key={note.id}
                      onClick={() => handleOpenNoteDot(note.dotId)}
                      style={{
                        padding: '8px 10px',
                        background: 'rgba(255, 255, 255, 0.08)',
                        borderRadius: '8px',
                        cursor: 'pointer',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'space-between',
                        gap: '8px',
                        border: '1px solid rgba(255, 255, 255, 0.08)',
                        transition: 'all 0.15s ease'
                      }}
                      onMouseEnter={(e) => {
                        e.currentTarget.style.background = 'rgba(255, 255, 255, 0.16)';
                      }}
                      onMouseLeave={(e) => {
                        e.currentTarget.style.background = 'rgba(255, 255, 255, 0.08)';
                      }}
                      title="Click to open this dot"
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
                        {hasChecklist && (
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
                        <ExternalLink size={12} style={{ color: '#c084fc', opacity: 0.8 }} />
                      </div>
                    </div>
                  );
                })
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
