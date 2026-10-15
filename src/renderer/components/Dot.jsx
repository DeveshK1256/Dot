import React, { useState, useEffect } from 'react';
import { HubExpanded } from './HubExpanded.jsx';
import { useExpandTimer } from '../hooks/useExpandTimer.js';
import { HubSettingsSchema } from '../../shared/schema.js';

export function Dot({ dotId = 'hub-dot' }) {
  const [dot, setDot] = useState(null);
  const [globalSettings, setGlobalSettings] = useState(null);
  const [isPinned, setIsPinned] = useState(false);

  // Compute effective settings for Hub
  const effectiveColor = dot?.hubColor || dot?.color || '#4f46e5';
  const effectiveOpacity = dot?.hubOpacity ?? dot?.opacity ?? globalSettings?.defaultOpacity ?? 0.92;
  const effectiveBlurRadius = dot?.blurRadius ?? globalSettings?.defaultBlurRadius ?? 12;
  const effectiveExpandTimerMs = dot?.expandTimerMs ?? globalSettings?.defaultExpandTimerMs ?? 4000;

  // Expand timer hook
  const { expanded, expand, scheduleShrink, collapse, clearTimer } = useExpandTimer({
    expandTimerMs: effectiveExpandTimerMs,
    isPinned,
    isEditing: false
  });

  // Load Dot & Global Settings
  useEffect(() => {
    async function loadData() {
      if (window.electronAPI) {
        const settings = await window.electronAPI.getSettings();
        setGlobalSettings(settings);

        const dots = await window.electronAPI.getDots();
        const current = dots.find((d) => d.id === dotId || d.isHub) || {
          id: 'hub-dot',
          isHub: true,
          position: { x: 50, y: 50 },
          hubEdge: 'right',
          hubColor: '#4f46e5',
          hubOpacity: 0.92,
          hubBorderStyle: 'solid',
          noteIds: []
        };
        setDot(current);
      }
    }
    loadData();

    if (window.electronAPI) {
      const unsubSettings = window.electronAPI.onSettingsUpdated((newSettings) => {
        setGlobalSettings(newSettings);
      });

      const unsubDot = window.electronAPI.onDotUpdated((updatedDot) => {
        if (updatedDot.id === dotId || updatedDot.isHub) {
          setDot(updatedDot);
        }
      });

      const unsubFocus = window.electronAPI.onFocusInput ? window.electronAPI.onFocusInput(() => {
        expand();
      }) : () => {};

      const unsubCollapseHub = window.electronAPI.onCollapseHub ? window.electronAPI.onCollapseHub(() => {
        collapse();
      }) : () => {};

      return () => {
        unsubSettings();
        unsubDot();
        unsubFocus();
        unsubCollapseHub();
      };
    }
  }, [dotId, expand, collapse]);

  // Synchronize dynamic window bounds between collapsed (thin strip) and expanded (340px)
  useEffect(() => {
    if (window.electronAPI) {
      window.electronAPI.setDotState(dotId, expanded ? 'EXPANDED' : 'COLLAPSED');
    }
  }, [dotId, expanded]);

  const handleSaveDotSettings = async (updatedDot) => {
    if (window.electronAPI) {
      await window.electronAPI.saveDot(updatedDot);
      setDot(updatedDot);
    }
  };

  const handleResetDotSettings = async () => {
    if (window.electronAPI && dot) {
      const resetDot = {
        ...dot,
        isHub: true,
        position: dot.position || { x: 50, y: 50 },
        color: HubSettingsSchema.hubColor,
        opacity: HubSettingsSchema.hubOpacity,
        blurBackground: true,
        blurRadius: 12,
        expandTimerMs: 4000,
        hubEdge: HubSettingsSchema.hubEdge,
        hubColor: HubSettingsSchema.hubColor,
        hubOpacity: HubSettingsSchema.hubOpacity,
        hubBorderStyle: HubSettingsSchema.hubBorderStyle,
        sortOrder: HubSettingsSchema.sortOrder,
        showCompletedChecklists: HubSettingsSchema.showCompletedChecklists
      };
      await window.electronAPI.saveDot(resetDot);
      setDot(resetDot);
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
        '--dot-blur': `${effectiveBlurRadius}px`
      }}
    >
      {!expanded ? (
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
        <HubExpanded
          dot={dot}
          globalSettings={globalSettings}
          isPinned={isPinned}
          onTogglePin={() => setIsPinned(!isPinned)}
          onClose={() => collapse()}
          onSaveDotSettings={handleSaveDotSettings}
          onResetDotSettings={handleResetDotSettings}
        />
      )}
    </div>
  );
}
