import React from 'react';
import { Dot } from './components/Dot.jsx';
import { SettingsPanel } from './components/SettingsPanel.jsx';

export function App() {
  const urlParams = new URLSearchParams(window.location.search);
  const view = urlParams.get('view');
  const dotId = urlParams.get('dotId') || 'hub-dot';

  if (view === 'settings') {
    return (
      <div style={{ width: '100vw', height: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', background: '#09090b' }}>
        <SettingsPanel onClose={() => window.close()} />
      </div>
    );
  }

  return <Dot dotId={dotId} />;
}
