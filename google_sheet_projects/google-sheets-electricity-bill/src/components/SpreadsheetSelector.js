import React, { useState, useEffect, useCallback } from 'react';

function SpreadsheetSelector({ onSelect, userEmail, onAuthError }) {
  const [spreadsheets, setSpreadsheets] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [creating, setCreating] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  const [renameSheetId, setRenameSheetId] = useState(null);
  const [newSheetName, setNewSheetName] = useState('');
  const [deleteSheetId, setDeleteSheetId] = useState(null);
  const [isDeleting, setIsDeleting] = useState(false);
  const [isRenaming, setIsRenaming] = useState(false);
  const [dataFetched, setDataFetched] = useState(false);

  // Convert fetchSpreadsheets to useCallback to maintain stable reference
  const fetchSpreadsheets = useCallback(async () => {
    // Skip fetching if we already have data and this render is due to theme change
    if (dataFetched && spreadsheets.length > 0) {
      console.log("Already have spreadsheet data, skipping fetch");
      setLoading(false);
      return;
    }
    
    try {
      setLoading(true);
      
      // Check if Drive API is loaded
      if (!window.gapi || !window.gapi.client || !window.gapi.client.drive) {
        console.log("Loading Drive API...");
        try {
          await window.gapi.client.load('drive', 'v3');
          console.log("Drive API loaded successfully");
        } catch (err) {
          console.error("Error loading Drive API:", err);
          setError("Failed to load Google Drive API. Please try refreshing the page.");
          setLoading(false);
          return;
        }
      }
      
      console.log("Fetching spreadsheets...");
      const response = await window.gapi.client.drive.files.list({
        q: "mimeType='application/vnd.google-apps.spreadsheet' and trashed=false",
        fields: 'files(id, name, createdTime, modifiedTime)',
        orderBy: 'modifiedTime desc'
      });

      console.log(`Found ${response.result.files.length} spreadsheets`);
      setSpreadsheets(response.result.files);
      setDataFetched(true);
      setError(null);
    } catch (err) {
      console.error('Error fetching spreadsheets:', err);
      if (err.status === 401 || (err.result && err.result.error && err.result.error.code === 401)) {
        onAuthError(err);
      } else {
        setError(`Failed to fetch spreadsheets: ${err.message || 'Unknown error'}. Please try again.`);
      }
    } finally {
      setLoading(false);
    }
  }, [spreadsheets.length, dataFetched, onAuthError]);

  // Fetch spreadsheets when component mounts or user email changes
  useEffect(() => {
    if (userEmail) {
      fetchSpreadsheets();
    }
  }, [userEmail, fetchSpreadsheets]);

  const createNewSpreadsheet = async () => {
    try {
      setCreating(true);
      
      // Create a new spreadsheet
      const response = await window.gapi.client.sheets.spreadsheets.create({
        properties: {
          title: `Electricity Bills - ${new Date().toLocaleDateString()}`
        },
        sheets: [
          {
            properties: {
              title: 'Sheet1',
              gridProperties: {
                rowCount: 1000,
                columnCount: 9
              }
            }
          }
        ]
      });

      const spreadsheetId = response.result.spreadsheetId;

      // Set up the header row
      await window.gapi.client.sheets.spreadsheets.values.update({
        spreadsheetId,
        range: 'Sheet1!A1:I1',
        valueInputOption: 'RAW',
        resource: {
          values: [[
            'Tenant Name',
            'Previous Reading',
            'Current Reading',
            'Units Consumed',
            'Cost per Unit',
            'Total Bill',
            'Date',
            'Water Units',
            'Water Cost'
          ]]
        }
      });

      // Format header row
      await window.gapi.client.sheets.spreadsheets.batchUpdate({
        spreadsheetId,
        resource: {
          requests: [
            {
              repeatCell: {
                range: {
                  sheetId: 0,
                  startRowIndex: 0,
                  endRowIndex: 1,
                  startColumnIndex: 0,
                  endColumnIndex: 9
                },
                cell: {
                  userEnteredFormat: {
                    backgroundColor: {
                      red: 0.8,
                      green: 0.8,
                      blue: 0.8
                    },
                    textFormat: {
                      bold: true
                    }
                  }
                },
                fields: 'userEnteredFormat(backgroundColor,textFormat)'
              }
            }
          ]
        }
      });

      // Refresh the list and select the new spreadsheet
      await fetchSpreadsheets();
      onSelect(spreadsheetId);
    } catch (err) {
      console.error('Error creating spreadsheet:', err);
      if (err.status === 401 || (err.result && err.result.error && err.result.error.code === 401)) {
        onAuthError(err);
      } else {
        setError('Failed to create spreadsheet. Please try again.');
      }
    } finally {
      setCreating(false);
    }
  };

  // Function to start rename process
  const handleRenameClick = (sheetId, currentName) => {
    setRenameSheetId(sheetId);
    setNewSheetName(currentName);
    setIsRenaming(false);
  };

  // Function to save the renamed spreadsheet
  const renameSpreadsheet = async (e) => {
    e.preventDefault();
    
    if (!renameSheetId || !newSheetName.trim()) {
      return;
    }
    
    try {
      setIsRenaming(true);
      
      // Use Drive API to rename the file
      await window.gapi.client.drive.files.update({
        fileId: renameSheetId,
        resource: {
          name: newSheetName
        }
      });
      
      // Update local state
      setSpreadsheets(prev => 
        prev.map(sheet => 
          sheet.id === renameSheetId 
            ? { ...sheet, name: newSheetName } 
            : sheet
        )
      );
      
      // Reset rename state
      setRenameSheetId(null);
      setNewSheetName('');
      
    } catch (err) {
      console.error('Error renaming spreadsheet:', err);
      if (err.status === 401 || (err.result && err.result.error && err.result.error.code === 401)) {
        onAuthError(err);
      } else {
        setError('Failed to rename spreadsheet. Please try again.');
      }
    } finally {
      setIsRenaming(false);
    }
  };

  // Function to cancel rename
  const cancelRename = () => {
    setRenameSheetId(null);
    setNewSheetName('');
  };

  // Function to handle delete confirmation
  const confirmDelete = (sheetId) => {
    setDeleteSheetId(sheetId);
  };

  // Function to delete a spreadsheet
  const deleteSpreadsheet = async () => {
    if (!deleteSheetId) {
      return;
    }
    
    try {
      setIsDeleting(true);
      
      // Use Drive API to delete (move to trash) the file
      await window.gapi.client.drive.files.update({
        fileId: deleteSheetId,
        resource: {
          trashed: true
        }
      });
      
      // Update local state
      setSpreadsheets(prev => prev.filter(sheet => sheet.id !== deleteSheetId));
      
      // Reset delete state
      setDeleteSheetId(null);
      
    } catch (err) {
      console.error('Error deleting spreadsheet:', err);
      if (err.status === 401 || (err.result && err.result.error && err.result.error.code === 401)) {
        onAuthError(err);
      } else {
        setError('Failed to delete spreadsheet. Please try again.');
      }
    } finally {
      setIsDeleting(false);
    }
  };

  // Function to cancel delete
  const cancelDelete = () => {
    setDeleteSheetId(null);
  };

  // Filter spreadsheets based on search term
  const filteredSpreadsheets = spreadsheets.filter(sheet =>
    sheet.name.toLowerCase().includes(searchTerm.toLowerCase())
  );

  if (loading) {
    return <div className="loading">Loading spreadsheets...</div>;
  }

  if (error) {
    return (
      <div className="error-message">
        <p>{error}</p>
        <button onClick={fetchSpreadsheets}>Try Again</button>
      </div>
    );
  }

  return (
    <div className="spreadsheet-selector">
      <h2>Select a Spreadsheet</h2>
      
      <div className="spreadsheet-actions">
        <button
          onClick={createNewSpreadsheet}
          disabled={creating}
          className="create-spreadsheet-btn"
        >
          {creating ? 'Creating...' : 'Create New Spreadsheet'}
        </button>
        
        <div className="search-container">
          <input
            type="text"
            placeholder="Search spreadsheets..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="search-input"
          />
        </div>
      </div>

      {/* Delete confirmation modal */}
      {deleteSheetId && (
        <div className="modal">
          <div className="modal-content">
            <h3>Delete Spreadsheet</h3>
            <p>Are you sure you want to delete this spreadsheet? This action cannot be undone.</p>
            <div className="modal-actions">
              <button 
                onClick={deleteSpreadsheet} 
                className="delete-btn"
                disabled={isDeleting}
              >
                {isDeleting ? 'Deleting...' : 'Delete'}
              </button>
              <button onClick={cancelDelete} className="cancel-btn">Cancel</button>
            </div>
          </div>
        </div>
      )}

      <div className="spreadsheet-list">
        {filteredSpreadsheets.length === 0 ? (
          <p>No spreadsheets found. Create a new one to get started.</p>
        ) : (
          filteredSpreadsheets.map(sheet => (
            <div
              key={sheet.id}
              className="spreadsheet-item"
            >
              {renameSheetId === sheet.id ? (
                <form onSubmit={renameSpreadsheet} className="rename-form">
                  <input
                    type="text"
                    value={newSheetName}
                    onChange={(e) => setNewSheetName(e.target.value)}
                    autoFocus
                  />
                  <div className="rename-actions">
                    <button 
                      type="submit" 
                      disabled={isRenaming || !newSheetName.trim()}
                    >
                      {isRenaming ? 'Saving...' : 'Save'}
                    </button>
                    <button type="button" onClick={cancelRename}>Cancel</button>
                  </div>
                </form>
              ) : (
                <>
                  <div className="spreadsheet-info" onClick={() => onSelect(sheet.id)}>
                    <h3>{sheet.name}</h3>
                    <p>Last modified: {new Date(sheet.modifiedTime).toLocaleString()}</p>
                  </div>
                  <div className="spreadsheet-actions">
                    <button className="select-btn" onClick={() => onSelect(sheet.id)}>Select</button>
                    <button className="rename-btn" onClick={() => handleRenameClick(sheet.id, sheet.name)}>Rename</button>
                    <button className="delete-btn" onClick={() => confirmDelete(sheet.id)}>Delete</button>
                  </div>
                </>
              )}
            </div>
          ))
        )}
      </div>
    </div>
  );
}

export default SpreadsheetSelector; 