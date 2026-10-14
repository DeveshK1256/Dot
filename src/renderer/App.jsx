import React from 'react';
import { Dot } from './components/Dot.jsx';
import { SettingsPanel } from './components/SettingsPanel.jsx';
import { PlusButton } from './components/PlusButton.jsx';
import { ClusterBadge } from './components/ClusterBadge.jsx';

export function App() {
  const urlParams = new URLSearchParams(window.location.search);
  const view = urlParams.get('view');
  const clusterId = urlParams.get('clusterId');
  const dotId = urlParams.get('dotId') || 'default-dot';

  if (view === 'settings') {
    return (
      <div style={{ width: '100vw', height: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', background: '#09090b' }}>
        <SettingsPanel onClose={() => window.close()} />
      </div>
    );
  }

  if (view === 'plus-button') {
    return <PlusButton />;
  }

  if (view === 'cluster') {
    return <ClusterBadge clusterId={clusterId} />;
  }

  return <Dot dotId={dotId} />;
}
