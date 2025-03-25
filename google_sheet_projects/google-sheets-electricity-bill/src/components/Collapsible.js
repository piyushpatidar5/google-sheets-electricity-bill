import React, { useState } from 'react';

function Collapsible({ title, children, defaultOpen = false, className = '', titleClassName = '' }) {
  const [isOpen, setIsOpen] = useState(defaultOpen);

  return (
    <div className={`collapsible ${className} ${isOpen ? 'open' : 'closed'}`}>
      <div 
        className={`collapsible-header ${titleClassName}`} 
        onClick={() => setIsOpen(!isOpen)}
      >
        <h3>{title}</h3>
        <span className="collapsible-icon">{isOpen ? '▼' : '►'}</span>
      </div>
      
      {isOpen && (
        <div className="collapsible-content">
          {children}
        </div>
      )}
    </div>
  );
}

export default Collapsible; 