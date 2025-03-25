import React, { useState, useEffect } from 'react';

function DebugPanel() {
  const [gapiInfo, setGapiInfo] = useState(null);
  const [tokenInfo, setTokenInfo] = useState(null);
  const [sessionInfo, setSessionInfo] = useState(null);

  useEffect(() => {
    updateDebugInfo();
  }, []);

  const updateDebugInfo = () => {
    // Get GAPI information
    const gapi = window.gapi;
    if (gapi) {
      setGapiInfo({
        version: gapi.client?.version || 'Unknown',
        isSignedIn: gapi.auth2?.getAuthInstance()?.isSignedIn.get() || false,
        apiKey: gapi.client?.apiKey ? 'Present' : 'Not set',
        discoveryDocs: gapi.client?.discoveryDocs || []
      });

      // Get token information
      const token = gapi.client?.getToken();
      if (token) {
        setTokenInfo({
          accessToken: token.access_token ? `${token.access_token.substring(0, 10)}...` : 'Not present',
          expiresIn: token.expires_in || 'Unknown',
          scope: token.scope || 'Unknown'
        });
      }
    }

    // Get session storage information
    const sessionToken = sessionStorage.getItem('gapi_token');
    setSessionInfo({
      hasToken: !!sessionToken,
      tokenLength: sessionToken ? sessionToken.length : 0,
      lastUpdated: sessionStorage.getItem('gapi_token_timestamp') || 'Unknown'
    });
  };

  const clearSession = () => {
    sessionStorage.removeItem('gapi_token');
    sessionStorage.removeItem('gapi_token_timestamp');
    updateDebugInfo();
  };

  const refreshToken = async () => {
    try {
      await window.gapi.auth2.getAuthInstance().currentUser.get().reloadAuthResponse();
      updateDebugInfo();
    } catch (err) {
      console.error('Error refreshing token:', err);
    }
  };

  return (
    <div className="debug-panel">
      <h3>Debug Information</h3>
      
      <div className="debug-section">
        <h4>GAPI Status</h4>
        {gapiInfo ? (
          <pre>{JSON.stringify(gapiInfo, null, 2)}</pre>
        ) : (
          <p>GAPI not initialized</p>
        )}
      </div>

      <div className="debug-section">
        <h4>Token Information</h4>
        {tokenInfo ? (
          <pre>{JSON.stringify(tokenInfo, null, 2)}</pre>
        ) : (
          <p>No token information available</p>
        )}
      </div>

      <div className="debug-section">
        <h4>Session Storage</h4>
        {sessionInfo ? (
          <pre>{JSON.stringify(sessionInfo, null, 2)}</pre>
        ) : (
          <p>No session information available</p>
        )}
      </div>

      <div className="debug-actions">
        <button onClick={updateDebugInfo}>Refresh Info</button>
        <button onClick={clearSession}>Clear Session</button>
        <button onClick={refreshToken}>Refresh Token</button>
      </div>
    </div>
  );
}

export default DebugPanel; 