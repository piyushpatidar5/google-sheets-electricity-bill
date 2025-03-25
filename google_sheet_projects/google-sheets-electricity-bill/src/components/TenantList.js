import React, { useState, useEffect, useCallback } from 'react';
import Tabs from './Tabs';
import Collapsible from './Collapsible';

function TenantList({ spreadsheetId, shouldRefresh, onAuthError }) {
  const [tenants, setTenants] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [sortConfig, setSortConfig] = useState({ key: 'date', direction: 'desc' });
  const [deletingEntry, setDeletingEntry] = useState(null);
  const [refreshCounter, setRefreshCounter] = useState(0);
  const [showDeleteModal, setShowDeleteModal] = useState(false);
  const [entryToDelete, setEntryToDelete] = useState(null);
  const [refreshing, setRefreshing] = useState(false);
  const [showUtilitiesSummary, setShowUtilitiesSummary] = useState(false);
  
  // Move fetchTenants to useCallback to prevent recreation on every render
  const fetchTenants = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);
      
      // Make sure gapi is available
      if (!window.gapi || !window.gapi.client) {
        throw new Error('Google API client not loaded');
      }
      
      // Get data from Google Sheet
      const response = await window.gapi.client.sheets.spreadsheets.values.get({
        spreadsheetId: spreadsheetId,
        range: 'Sheet1!A:I',
      });
      
      const values = response.result.values || [];
      
      if (values.length === 0) {
        setTenants([]);
        return;
      }
      
      // Check if first row has column headers
      const hasHeaders = values[0].some(cell => 
        typeof cell === 'string' && 
        ['tenant', 'name', 'reading', 'cost', 'bill', 'unit', 'date', 'water'].some(keyword => 
          cell.toLowerCase().includes(keyword)
        )
      );
      
      // Skip headers if they exist
      const startIndex = hasHeaders ? 1 : 0;
      
      // Map the data to our tenant objects
      const tenantList = values.slice(startIndex).map((row, index) => {
        // Extract the basic values
        const [
          tenantName = '',
          previousReading = '0',
          currentReading = '0',
          unitsConsumed = '0',
          costPerUnit = '0',
          totalBill = '0',
          date = '',
          waterUnits = '',
          waterCost = ''
        ] = row;
        
        // Parse numeric values, treating empty strings as 0
        const parseNumeric = (value) => {
          if (value === '' || value === undefined || value === null) return 0;
          const parsed = parseFloat(value);
          return isNaN(parsed) ? 0 : parsed;
        };
        
        // Use the helper function to parse all numeric values
        return {
          id: index,
          tenantName,
          previousReading: parseNumeric(previousReading),
          currentReading: parseNumeric(currentReading),
          unitsConsumed: parseNumeric(unitsConsumed),
          costPerUnit: parseNumeric(costPerUnit),
          totalBill: parseNumeric(totalBill),
          date,
          waterUnits: parseNumeric(waterUnits),
          waterCost: parseNumeric(waterCost),
          hasWaterData: waterUnits !== '' || waterCost !== '' || parseNumeric(waterUnits) > 0 || parseNumeric(waterCost) > 0
        };
      });
      
      // Sort the data based on the current sort configuration
      const sortedData = [...tenantList].sort((a, b) => {
        if (a[sortConfig.key] < b[sortConfig.key]) {
          return sortConfig.direction === 'asc' ? -1 : 1;
        }
        if (a[sortConfig.key] > b[sortConfig.key]) {
          return sortConfig.direction === 'asc' ? 1 : -1;
        }
        return 0;
      });
      
      setTenants(sortedData);
      
    } catch (err) {
      console.error('Error fetching tenant data:', err);
      
      // Check if this is an authentication error (401)
      if (
        err.status === 401 || 
        (err.result && err.result.error && err.result.error.code === 401) ||
        (err.error && err.error.status === 'UNAUTHENTICATED')
      ) {
        console.log("Authentication error in TenantList", err);
        // Use the onAuthError prop if available, otherwise just set local error
        if (onAuthError) {
          onAuthError(err.result ? err.result.error : err);
        } else {
          setError(`Authentication error. Please sign in again.`);
        }
      } else {
        // For other errors, set the error message locally
        setError(`Failed to fetch tenant data: ${err.message}`);
      }
    } finally {
      setLoading(false);
    }
  }, [spreadsheetId, sortConfig, onAuthError]);
  
  // Separate useEffect for data fetching that depends on refresh triggers only
  useEffect(() => {
    if (spreadsheetId) {
      fetchTenants();
    }
  }, [spreadsheetId, shouldRefresh, refreshCounter, fetchTenants]);
  
  // Handle sorting when a column header is clicked
  const handleSort = (key) => {
    let direction = 'asc';
    if (sortConfig.key === key && sortConfig.direction === 'asc') {
      direction = 'desc';
    }
    setSortConfig({ key, direction });
  };
  
  // Get sort indicator for the column
  const getSortIndicator = (key) => {
    if (sortConfig.key === key) {
      return sortConfig.direction === 'asc' ? ' ↑' : ' ↓';
    }
    return '';
  };
  
  // Format currency for display
  const formatCurrency = (amount) => {
    return new Intl.NumberFormat('en-IN', {
      style: 'currency',
      currency: 'INR',
      minimumFractionDigits: 2,
      maximumFractionDigits: 2
    }).format(amount);
  };

  // Format date for display
  const formatDate = (dateStr) => {
    try {
      const date = new Date(dateStr);
      return date.toLocaleDateString('en-IN', {
        year: 'numeric',
        month: 'short',
        day: 'numeric'
      });
    } catch (e) {
      return dateStr;
    }
  };
  
  // Get tenant-wise data
  const getTenantWiseData = () => {
    const tenantMap = new Map();
    const utilityTenants = ['Water Motor', 'Shop'];
    
    // Group by tenant name
    tenants.forEach(tenant => {
      // Skip utility tenants
      if (utilityTenants.includes(tenant.tenantName)) {
        return;
      }
      
      if (!tenantMap.has(tenant.tenantName)) {
        tenantMap.set(tenant.tenantName, []);
      }
      tenantMap.get(tenant.tenantName).push(tenant);
    });
    
    // Sort each tenant's entries by date
    tenantMap.forEach((entries, tenantName) => {
      entries.sort((a, b) => new Date(b.date) - new Date(a.date));
    });
    
    return tenantMap;
  };
  
  // Get monthly data
  const getMonthlyData = () => {
    const monthMap = new Map();
    const utilityTenants = ['Water Motor', 'Shop'];
    
    tenants.forEach(tenant => {
      if (!tenant.date) return;
      
      const date = new Date(tenant.date);
      if (isNaN(date.getTime())) return; // Skip invalid dates
      
      const monthKey = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`;
      const monthName = date.toLocaleDateString('en-IN', { month: 'long', year: 'numeric' });
      
      if (!monthMap.has(monthKey)) {
        monthMap.set(monthKey, {
          displayName: monthName,
          entries: [],
          utilityEntries: [],
          totalUnits: 0,
          totalWaterUnits: 0,
          totalBill: 0,
          utilityUnits: 0,
          utilityBill: 0
        });
      }
      
      const monthData = monthMap.get(monthKey);
      
      // Check if this is a utility entry (Water Motor or Shop)
      if (utilityTenants.includes(tenant.tenantName)) {
        monthData.utilityEntries.push(tenant);
        monthData.utilityUnits += tenant.unitsConsumed;
        monthData.utilityBill += tenant.totalBill;
      } else {
        monthData.entries.push(tenant);
        monthData.totalUnits += tenant.unitsConsumed;
        monthData.totalWaterUnits += tenant.waterUnits || 0;
        monthData.totalBill += tenant.totalBill;
      }
    });
    
    // Sort by month key in descending order (newest first)
    return new Map([...monthMap.entries()].sort().reverse());
  };
  
  // Get yearly data
  const getYearlyData = () => {
    const yearMap = new Map();
    const utilityTenants = ['Water Motor', 'Shop'];
    
    tenants.forEach(tenant => {
      if (!tenant.date) return;
      
      const date = new Date(tenant.date);
      if (isNaN(date.getTime())) return; // Skip invalid dates
      
      const year = date.getFullYear().toString();
      
      if (!yearMap.has(year)) {
        yearMap.set(year, {
          totalUnits: 0,
          totalWaterUnits: 0,
          totalBill: 0,
          utilityUnits: 0,
          utilityBill: 0,
          entries: [],
          utilityEntries: [],
          months: new Map()
        });
      }
      
      const yearData = yearMap.get(year);
      
      // Check if this is a utility entry
      if (utilityTenants.includes(tenant.tenantName)) {
        yearData.utilityEntries.push(tenant);
        yearData.utilityUnits += tenant.unitsConsumed;
        yearData.utilityBill += tenant.totalBill;
      } else {
        yearData.entries.push(tenant);
        yearData.totalUnits += tenant.unitsConsumed;
        yearData.totalWaterUnits += tenant.waterUnits || 0;
        yearData.totalBill += tenant.totalBill;
      }
      
      // Group by month within the year
      const monthKey = String(date.getMonth() + 1).padStart(2, '0');
      const monthName = date.toLocaleDateString('en-IN', { month: 'long' });
      
      if (!yearData.months.has(monthKey)) {
        yearData.months.set(monthKey, {
          name: monthName,
          totalUnits: 0,
          totalWaterUnits: 0,
          totalBill: 0,
          utilityUnits: 0,
          utilityBill: 0,
          entries: [],
          utilityEntries: []
        });
      }
      
      const monthData = yearData.months.get(monthKey);
      
      // Add to appropriate arrays based on tenant type
      if (utilityTenants.includes(tenant.tenantName)) {
        monthData.utilityEntries.push(tenant);
        monthData.utilityUnits += tenant.unitsConsumed;
        monthData.utilityBill += tenant.totalBill;
      } else {
        monthData.entries.push(tenant);
        monthData.totalUnits += tenant.unitsConsumed;
        monthData.totalWaterUnits += tenant.waterUnits || 0;
        monthData.totalBill += tenant.totalBill;
      }
    });
    
    // Sort by year in descending order (newest first)
    return new Map([...yearMap.entries()].sort().reverse());
  };
  
  // Refresh data manually
  const handleRefreshData = async () => {
    setRefreshing(true);
    setRefreshCounter(prev => prev + 1);
    // Add a small delay to show the refresh animation
    setTimeout(() => {
      setRefreshing(false);
    }, 800);
  };
  
  // Show delete confirmation modal instead of using window.confirm
  const confirmDelete = (entry) => {
    setEntryToDelete(entry);
    setShowDeleteModal(true);
  };
  
  // Handle actual deletion
  const handleDeleteEntry = async () => {
    if (!entryToDelete) return;
    
    try {
      setDeletingEntry(entryToDelete.id);
      setShowDeleteModal(false);
      
      // Make sure gapi is available
      if (!window.gapi || !window.gapi.client) {
        throw new Error('Google API client not loaded');
      }
      
      // First, get all data from the spreadsheet to find the row to delete
      const response = await window.gapi.client.sheets.spreadsheets.values.get({
        spreadsheetId: spreadsheetId,
        range: 'Sheet1!A:I',
      });
      
      const values = response.result.values || [];
      const hasHeaders = values[0].some(cell => 
        typeof cell === 'string' && 
        ['tenant', 'name', 'reading', 'cost', 'bill', 'unit', 'date'].some(keyword => 
          cell.toLowerCase().includes(keyword)
        )
      );
      
      // Start from index 1 if has headers, otherwise from 0
      const startIndex = hasHeaders ? 1 : 0;
      
      // Find the row that matches the entry we want to delete
      let rowToDelete = -1;
      for (let i = startIndex; i < values.length; i++) {
        const row = values[i];
        if (row.length < 6) continue; // Skip incomplete rows
        
        // Match based on tenant name, date, and bill amount
        const tenantName = row[0];
        const currentReading = parseFloat(row[2]);
        const totalBill = parseFloat(row[5]);
        const date = row[6];
        
        // Some fuzzy matching to find the likely matching row
        if (tenantName === entryToDelete.tenantName && 
            Math.abs(currentReading - entryToDelete.currentReading) < 0.01 && 
            Math.abs(totalBill - entryToDelete.totalBill) < 0.01 && 
            date === entryToDelete.date) {
          rowToDelete = i + 1; // 1-indexed for Google Sheets API
          break;
        }
      }
      
      if (rowToDelete === -1) {
        throw new Error('Could not find the entry in the spreadsheet');
      }
      
      // Delete the row
      await window.gapi.client.sheets.spreadsheets.batchUpdate({
        spreadsheetId: spreadsheetId,
        resource: {
          requests: [
            {
              deleteDimension: {
                range: {
                  sheetId: 0, // Assuming it's the first sheet
                  dimension: 'ROWS',
                  startIndex: rowToDelete - 1, // 0-indexed
                  endIndex: rowToDelete // exclusive end index
                }
              }
            }
          ]
        }
      });
      
      // Refresh the data
      setTenants(prevTenants => prevTenants.filter(t => t.id !== entryToDelete.id));
      
      // After successful deletion, trigger a refresh
      setRefreshCounter(prev => prev + 1);
      
    } catch (err) {
      console.error('Error deleting entry:', err);
      
      // Check if this is an authentication error
      if (
        err.status === 401 || 
        (err.result && err.result.error && err.result.error.code === 401) ||
        (err.error && err.error.status === 'UNAUTHENTICATED')
      ) {
        console.log("Authentication error in TenantList", err);
        if (onAuthError) {
          onAuthError(err.result ? err.result.error : err);
        } else {
          setError(`Authentication error. Please sign in again.`);
        }
      } else {
        // For other errors, set the error message locally
        setError(`Failed to delete entry: ${err.message}`);
      }
    } finally {
      setDeletingEntry(null);
      setEntryToDelete(null);
    }
  };

  // Cancel deletion
  const cancelDelete = () => {
    setShowDeleteModal(false);
    setEntryToDelete(null);
  };
  
  // Render regular table view
  const renderRegularTable = () => {
    // Filter out Water Motor and Shop from the regular table view
    const filteredTenants = tenants.filter(tenant => 
      tenant.tenantName !== 'Water Motor' && tenant.tenantName !== 'Shop');
      
    return (
      <div className="table-container">
        <table>
          <thead>
            <tr>
              <th onClick={() => handleSort('tenantName')}>
                Tenant Name{getSortIndicator('tenantName')}
              </th>
              <th onClick={() => handleSort('previousReading')}>
                Previous Reading{getSortIndicator('previousReading')}
              </th>
              <th onClick={() => handleSort('currentReading')}>
                Current Reading{getSortIndicator('currentReading')}
              </th>
              <th onClick={() => handleSort('unitsConsumed')}>
                Units Used{getSortIndicator('unitsConsumed')}
              </th>
              <th onClick={() => handleSort('costPerUnit')}>
                Rate{getSortIndicator('costPerUnit')}
              </th>
              <th onClick={() => handleSort('waterUnits')}>
                Water Units{getSortIndicator('waterUnits')}
              </th>
              <th onClick={() => handleSort('totalBill')}>
                Total Bill{getSortIndicator('totalBill')}
              </th>
              <th onClick={() => handleSort('date')}>
                Date{getSortIndicator('date')}
              </th>
            </tr>
          </thead>
          <tbody>
            {filteredTenants.map((tenant) => (
              <tr key={tenant.id}>
                <td>{tenant.tenantName}</td>
                <td>{tenant.previousReading} units</td>
                <td>{tenant.currentReading} units</td>
                <td>{tenant.unitsConsumed} units</td>
                <td>{formatCurrency(tenant.costPerUnit)}</td>
                <td>
                  {tenant.hasWaterData 
                    ? tenant.waterUnits > 0 
                      ? `${tenant.waterUnits.toFixed(2)} units` 
                      : '0 units'
                    : '-'}
                </td>
                <td>{formatCurrency(tenant.totalBill)}</td>
                <td>{formatDate(tenant.date)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    );
  };
  
  // Render tenant-wise view with collapsible sections
  const renderTenantWiseView = () => {
    const tenantMap = getTenantWiseData();
    
    return (
      <div className="tenant-wise-view">
        {[...tenantMap.entries()].map(([tenantName, entries]) => {
          // Calculate totals
          const totalUnits = entries.reduce((sum, entry) => sum + entry.unitsConsumed, 0);
          const totalWaterUnits = entries.reduce((sum, entry) => sum + (entry.waterUnits || 0), 0);
          const totalBill = entries.reduce((sum, entry) => sum + entry.totalBill, 0);
          
          return (
            <Collapsible 
              key={tenantName} 
              title={tenantName}
              defaultOpen={false}
              className="tenant-card"
            >
              <div className="tenant-summary">
                <div className="summary-item">
                  <span>Total Electricity Units:</span> {totalUnits.toFixed(2)} units
                </div>
                {totalWaterUnits > 0 && (
                  <div className="summary-item">
                    <span>Total Water Units:</span> {totalWaterUnits.toFixed(2)} units
                  </div>
                )}
                <div className="summary-item">
                  <span>Total Amount:</span> {formatCurrency(totalBill)}
                </div>
              </div>
              <div className="table-container">
                <table>
                  <thead>
                    <tr>
                      <th>Date</th>
                      <th>Electricity Units</th>
                      <th>Water Units</th>
                      <th>Bill Amount</th>
                      <th>Actions</th>
                    </tr>
                  </thead>
                  <tbody>
                    {entries.map((entry, index) => (
                      <tr key={index}>
                        <td>{formatDate(entry.date)}</td>
                        <td>{entry.unitsConsumed} units</td>
                        <td>
                          {entry.hasWaterData 
                            ? `${entry.waterUnits.toFixed(2)} units` 
                            : '-'}
                        </td>
                        <td>{formatCurrency(entry.totalBill)}</td>
                        <td>
                          <button 
                            className="delete-btn"
                            onClick={() => confirmDelete(entry)}
                            disabled={deletingEntry === entry.id}
                          >
                            {deletingEntry === entry.id ? 'Deleting...' : 'Delete'}
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </Collapsible>
          );
        })}
      </div>
    );
  };
  
  // Render monthly view with collapsible sections
  const renderMonthlyView = () => {
    const monthlyData = getMonthlyData();
    
    return (
      <div className="monthly-view">
        {[...monthlyData.entries()].map(([monthKey, data]) => (
          <Collapsible
            key={monthKey}
            title={data.displayName}
            defaultOpen={false}
            className="month-card"
          >
            <div className="month-summary">
              <div className="summary-item">
                <span>Total Electricity Units:</span> {data.totalUnits.toFixed(2)} units
              </div>
              {data.totalWaterUnits > 0 && (
                <div className="summary-item">
                  <span>Total Water Units:</span> {data.totalWaterUnits.toFixed(2)} units
                </div>
              )}
              <div className="summary-item">
                <span>Total Bill:</span> {formatCurrency(data.totalBill)}
              </div>
            </div>
            
            {/* Regular tenants table */}
            <div className="table-container">
              <table>
                <thead>
                  <tr>
                    <th>Tenant</th>
                    <th>Electricity Units</th>
                    <th>Water Units</th>
                    <th>Bill Amount</th>
                  </tr>
                </thead>
                <tbody>
                  {data.entries.map((entry, index) => (
                    <tr key={index}>
                      <td>{entry.tenantName}</td>
                      <td>{entry.unitsConsumed} units</td>
                      <td>
                        {entry.hasWaterData 
                          ? `${entry.waterUnits.toFixed(2)} units` 
                          : '-'}
                      </td>
                      <td>{formatCurrency(entry.totalBill)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            
            {/* Utilities section */}
            {data.utilityEntries.length > 0 && (
              <div className="utilities-section">
                <h4>Utility Readings</h4>
                <div className="utilities-summary">
                  <div className="summary-item">
                    <span>Total Utility Units:</span> {data.utilityUnits.toFixed(2)} units
                  </div>
                  <div className="summary-item">
                    <span>Total Utility Cost:</span> {formatCurrency(data.utilityBill)}
                  </div>
                </div>
                <div className="table-container">
                  <table className="utilities-table">
                    <thead>
                      <tr>
                        <th>Utility</th>
                        <th>Previous Reading</th>
                        <th>Current Reading</th>
                        <th>Units</th>
                        <th>Bill Amount</th>
                      </tr>
                    </thead>
                    <tbody>
                      {data.utilityEntries.map((entry, index) => (
                        <tr key={index}>
                          <td>{entry.tenantName}</td>
                          <td>{entry.previousReading} units</td>
                          <td>{entry.currentReading} units</td>
                          <td>{entry.unitsConsumed} units</td>
                          <td>{formatCurrency(entry.totalBill)}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            )}
          </Collapsible>
        ))}
      </div>
    );
  };
  
  // Render yearly view with collapsible sections
  const renderYearlyView = () => {
    const yearlyData = getYearlyData();
    
    return (
      <div className="yearly-view">
        {[...yearlyData.entries()].map(([year, data]) => (
          <Collapsible
            key={year}
            title={`Year ${year}`}
            defaultOpen={false}
            className="year-card"
          >
            <div className="year-summary">
              <div className="summary-item">
                <span>Total Electricity Units:</span> {data.totalUnits.toFixed(2)} units
              </div>
              {data.totalWaterUnits > 0 && (
                <div className="summary-item">
                  <span>Total Water Units:</span> {data.totalWaterUnits.toFixed(2)} units
                </div>
              )}
              <div className="summary-item">
                <span>Total Bill:</span> {formatCurrency(data.totalBill)}
              </div>
              
              {data.utilityUnits > 0 && (
                <div className="summary-item utility-summary">
                  <span>Total Utility Units:</span> {data.utilityUnits.toFixed(2)} units
                </div>
              )}
              {data.utilityBill > 0 && (
                <div className="summary-item utility-summary">
                  <span>Total Utility Bill:</span> {formatCurrency(data.utilityBill)}
                </div>
              )}
            </div>
            
            {/* Regular tenants table by month */}
            <div className="table-container">
              <table>
                <thead>
                  <tr>
                    <th>Month</th>
                    <th>Electricity Units</th>
                    <th>Water Units</th>
                    <th>Bill Amount</th>
                  </tr>
                </thead>
                <tbody>
                  {[...data.months.entries()].sort().reverse().map(([monthKey, monthData]) => (
                    <tr key={monthKey}>
                      <td>{monthData.name}</td>
                      <td>{monthData.totalUnits.toFixed(2)} units</td>
                      <td>
                        {monthData.totalWaterUnits > 0 
                          ? `${monthData.totalWaterUnits.toFixed(2)} units` 
                          : '-'}
                      </td>
                      <td>{formatCurrency(monthData.totalBill)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            
            {/* Utilities section */}
            {data.utilityEntries.length > 0 && (
              <div className="utilities-section">
                <h4>Utility Readings</h4>
                <div className="utilities-summary">
                  <div className="summary-item">
                    <span>Total Utility Units:</span> {data.utilityUnits.toFixed(2)} units
                  </div>
                  <div className="summary-item">
                    <span>Total Utility Cost:</span> {formatCurrency(data.utilityBill)}
                  </div>
                </div>
                
                <div className="table-container">
                  <table className="utilities-table">
                    <thead>
                      <tr>
                        <th>Month</th>
                        <th>Utility</th>
                        <th>Units</th>
                        <th>Bill Amount</th>
                      </tr>
                    </thead>
                    <tbody>
                      {[...data.months.entries()]
                        .filter(([_, monthData]) => monthData.utilityEntries.length > 0)
                        .sort().reverse()
                        .map(([monthKey, monthData]) => 
                          monthData.utilityEntries.map((entry, entryIndex) => (
                            <tr key={`${monthKey}-${entryIndex}`}>
                              <td>{monthData.name}</td>
                              <td>{entry.tenantName}</td>
                              <td>{entry.unitsConsumed.toFixed(2)} units</td>
                              <td>{formatCurrency(entry.totalBill)}</td>
                            </tr>
                          ))
                        )}
                    </tbody>
                  </table>
                </div>
              </div>
            )}
          </Collapsible>
        ))}
      </div>
    );
  };
  
  // Render utilities summary for monthly view
  const renderUtilitiesSummary = () => {
    const monthlyData = getMonthlyData();
    const utilityMonths = [...monthlyData.entries()]
      .filter(([_, data]) => data.utilityEntries.length > 0)
      .slice(0, 3); // Show only the most recent 3 months
      
    if (utilityMonths.length === 0) {
      return <p>No utility data available.</p>;
    }
    
    return (
      <div className="utilities-summary-card">
        <h4>Recent Utilities Summary</h4>
        <div className="utilities-grid">
          {utilityMonths.map(([monthKey, data]) => (
            data.utilityEntries.map((entry, index) => (
              <div key={`${monthKey}-${index}`} className="utility-card">
                <div className="utility-name">{entry.tenantName}</div>
                <div className="utility-details">
                  <div><span>Month:</span> {data.displayName}</div>
                  <div><span>Units:</span> {entry.unitsConsumed.toFixed(2)} units</div>
                  <div><span>Amount:</span> {formatCurrency(entry.totalBill)}</div>
                </div>
              </div>
            ))
          ))}
        </div>
      </div>
    );
  };
  
  // Render the delete confirmation modal
  const renderDeleteConfirmationModal = () => {
    if (!showDeleteModal || !entryToDelete) return null;
    
    return (
      <div className="modal-overlay">
        <div className="delete-modal">
          <div className="modal-header">
            <h3>Confirm Deletion</h3>
          </div>
          <div className="modal-body">
            <p>Are you sure you want to delete this entry?</p>
            <div className="entry-details">
              <div><strong>Tenant:</strong> {entryToDelete.tenantName}</div>
              <div><strong>Date:</strong> {formatDate(entryToDelete.date)}</div>
              <div><strong>Amount:</strong> {formatCurrency(entryToDelete.totalBill)}</div>
            </div>
            <p className="warning-text">This action cannot be undone.</p>
          </div>
          <div className="modal-footer">
            <button className="cancel-btn" onClick={cancelDelete}>Cancel</button>
            <button 
              className="delete-confirm-btn" 
              onClick={handleDeleteEntry}
              disabled={deletingEntry === entryToDelete.id}
            >
              {deletingEntry === entryToDelete.id ? 'Deleting...' : 'Delete'}
            </button>
          </div>
        </div>
      </div>
    );
  };
  
  if (loading) {
    return <div className="loading">Loading tenant data...</div>;
  }
  
  if (error) {
    return <div className="error">Error: {error}</div>;
  }
  
  if (tenants.length === 0) {
    return <div className="no-data">No electricity data available. Add your first reading using the form above.</div>;
  }
  
  // Define tabs for the TenantList component
  const reportTabs = [
    {
      label: "All Records",
      icon: "📋",
      content: renderRegularTable()
    },
    {
      label: "Tenant-wise View",
      icon: "👥",
      content: renderTenantWiseView()
    },
    {
      label: "Monthly View",
      icon: "📅",
      content: (
        <div>
          {/* Utilities Quick View - show at the top for monthly */}
          <div className="utilities-quick-view">
            <button 
              className="utilities-toggle-btn"
              onClick={() => setShowUtilitiesSummary(prevState => !prevState)}
            >
              {showUtilitiesSummary ? 'Hide Utilities Summary' : 'Show Utilities Summary'}
            </button>
            
            {showUtilitiesSummary && renderUtilitiesSummary()}
          </div>
          
          {renderMonthlyView()}
        </div>
      )
    },
    {
      label: "Yearly View",
      icon: "📊",
      content: renderYearlyView()
    }
  ];
  
  return (
    <div className="tenant-list">
      <div className="tenant-list-header">
        <h2>Electricity Usage Reports</h2>
        <button 
          className={`refresh-btn ${refreshing ? 'refreshing' : ''}`}
          onClick={handleRefreshData}
          disabled={refreshing}
          title="Refresh data"
        >
          <span className="refresh-icon">↻</span>
          {refreshing ? 'Refreshing...' : 'Refresh'}
        </button>
      </div>
      
      <Tabs tabs={reportTabs} defaultTab={0} />
      
      {/* Render confirmation modal */}
      {renderDeleteConfirmationModal()}
    </div>
  );
}

// Export the component wrapped in React.memo to prevent unnecessary re-renders
export default React.memo(TenantList); 