import React from 'react';

function Login({ onSignIn }) {
  return (
    <div className="login-container">
      <div className="login-card">
        <div className="login-logo">
          <span className="logo-icon">⚡</span>
        </div>
        
        <h2>Welcome to Electricity Bill Management</h2>
        
        <div className="login-description">
          <p>Track electricity usage, calculate bills and distribute water costs among tenants easily.</p>
        </div>
        
        <button onClick={onSignIn} className="google-sign-in-btn">
          Sign in with Google
        </button>
        
        <div className="login-features">
          <div className="feature-item">
            <span className="feature-icon">📊</span>
            <span className="feature-text">Track readings</span>
          </div>
          <div className="feature-item">
            <span className="feature-icon">💰</span>
            <span className="feature-text">Calculate bills</span>
          </div>
          <div className="feature-item">
            <span className="feature-icon">💧</span>
            <span className="feature-text">Distribute water costs</span>
          </div>
        </div>
        
        <div className="privacy-note">
          <h3>Privacy Note</h3>
          <p>This application stores all data in your own Google Sheets account. Your data remains private and under your control.</p>
        </div>
      </div>
    </div>
  );
}

export default Login; 