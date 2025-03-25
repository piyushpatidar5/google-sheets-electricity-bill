import React, { useState, useEffect, useCallback } from 'react';

function ElectricityForm({ onSubmit, spreadsheetId }) {
  const [loading, setLoading] = useState(true);
  const [errors, setErrors] = useState({});
  const [formSubmitting, setFormSubmitting] = useState(false);
  const [showFamilySettings, setShowFamilySettings] = useState(false);
  const [authError, setAuthError] = useState(null);
  
  // Define the different types of meters with default values
  const defaultMeterData = {
    shop: { previousReading: 0, currentReading: '', name: 'Shop' },
    family1: { previousReading: 0, currentReading: '', name: 'Rakesh Bhayya', members: 4 },
    family2: { previousReading: 0, currentReading: '', name: 'Kadam Medam', members: 4 },
    family3: { previousReading: 0, currentReading: '', name: 'Pipalde Sir', members: 2 },
    family4: { previousReading: 0, currentReading: '', name: 'Single Room Yash', members: 1 },
    mainMeter: { previousReading: 0, currentReading: '', name: 'Main Meter' },
    waterMotor: { previousReading: 0, currentReading: '', name: 'Water Motor' }
  };
  
  // Helper function to check if an error is an authentication error
  const isAuthError = useCallback((error) => {
    return (
      error?.status === 401 || 
      (error?.result?.error?.code === 401) ||
      (error?.error?.code === 401) ||
      (error?.error?.status === 'UNAUTHENTICATED') ||
      (typeof error === 'string' && error.includes('authentication credentials'))
    );
  }, []);
  
  // Load saved family data from localStorage if available
  const loadSavedFamilyData = () => {
    try {
      const savedData = localStorage.getItem('electricityBillFamilyData');
      if (savedData) {
        const parsedData = JSON.parse(savedData);
        
        // Only update family-related properties while keeping other defaults
        const updatedMeterData = { ...defaultMeterData };
        ['family1', 'family2', 'family3', 'family4'].forEach(familyKey => {
          if (parsedData[familyKey]) {
            updatedMeterData[familyKey] = {
              ...updatedMeterData[familyKey],
              name: parsedData[familyKey].name || updatedMeterData[familyKey].name,
              members: parsedData[familyKey].members || updatedMeterData[familyKey].members
            };
          }
        });
        
        return updatedMeterData;
      }
    } catch (err) {
      console.error('Error loading saved family data:', err);
    }
    
    return defaultMeterData;
  };
  
  const [meterData, setMeterData] = useState(loadSavedFamilyData());
  
  // Set default cost per unit for each meter type
  const [costPerUnit, setCostPerUnit] = useState('10');
  
  // Save family data to localStorage when it changes
  useEffect(() => {
    try {
      // Only save the family-related properties
      const dataToSave = {
        family1: { name: meterData.family1.name, members: meterData.family1.members },
        family2: { name: meterData.family2.name, members: meterData.family2.members },
        family3: { name: meterData.family3.name, members: meterData.family3.members },
        family4: { name: meterData.family4.name, members: meterData.family4.members }
      };
      localStorage.setItem('electricityBillFamilyData', JSON.stringify(dataToSave));
    } catch (err) {
      console.error('Error saving family data:', err);
    }
  }, [
    meterData.family1.name, meterData.family1.members,
    meterData.family2.name, meterData.family2.members,
    meterData.family3.name, meterData.family3.members,
    meterData.family4.name, meterData.family4.members
  ]);
  
  // Fetch previous readings from the Google Sheet
  useEffect(() => {
    const fetchReadings = async () => {
      try {
        setLoading(true);
        setAuthError(null);
        
        // Make sure gapi is available
        if (!window.gapi || !window.gapi.client) {
          throw new Error('Google API client not loaded');
        }

        // Get data from Google Sheet
        const response = await window.gapi.client.sheets.spreadsheets.values.get({
          spreadsheetId: spreadsheetId,
          range: 'Sheet1!A:Z', // Using a wider range to accommodate all meter data
        });
        
        const values = response.result.values || [];
        
        if (values.length === 0) {
          return;
        }
        
        // Check if first row has column headers
        const hasHeaders = values[0].some(cell => 
          typeof cell === 'string' && 
          ['tenant', 'name', 'reading', 'cost', 'bill', 'unit', 'date'].some(keyword => 
            cell.toLowerCase().includes(keyword)
          )
        );
        
        // Skip headers if they exist
        const startIndex = hasHeaders ? 1 : 0;
        
        // Get the most recent readings for each meter type
        let latestReadings = {
          shop: 0,
          family1: 0,
          family2: 0,
          family3: 0,
          family4: 0,
          mainMeter: 0,
          waterMotor: 0
        };
        
        let latestCostPerUnit = 10; // Default cost
        
        // Process all entries to find the latest readings
        for (let i = startIndex; i < values.length; i++) {
          const row = values[i];
          if (row.length < 3) continue; // Skip incomplete rows
          
          const tenantName = (row[0] || '').trim();
          const currentReading = parseFloat(row[2] || 0);
          
          // Set cost per unit from the most recent entry
          if (row[4] && !isNaN(parseFloat(row[4]))) {
            latestCostPerUnit = parseFloat(row[4]);
          }
          
          // Match tenant names to meter IDs
          if (tenantName.includes('Shop')) {
            latestReadings.shop = currentReading;
          } else if (tenantName.includes('Rakesh Bhayya') || tenantName.includes('Family 1')) {
            latestReadings.family1 = currentReading;
          } else if (tenantName.includes('Kadam Medam') || tenantName.includes('Family 2')) {
            latestReadings.family2 = currentReading;
          } else if (tenantName.includes('Pipalde Sir') || tenantName.includes('Family 3')) {
            latestReadings.family3 = currentReading;
          } else if (tenantName.includes('Single Room Yash') || tenantName.includes('Family 4')) {
            latestReadings.family4 = currentReading;
          } else if (tenantName.includes('Main Meter')) {
            latestReadings.mainMeter = currentReading;
          } else if (tenantName.includes('Water Motor')) {
            latestReadings.waterMotor = currentReading;
          }
        }
        
        // Update the meter data with the latest readings
        setMeterData(prevData => ({
          shop: { ...prevData.shop, previousReading: latestReadings.shop },
          family1: { ...prevData.family1, previousReading: latestReadings.family1 },
          family2: { ...prevData.family2, previousReading: latestReadings.family2 },
          family3: { ...prevData.family3, previousReading: latestReadings.family3 },
          family4: { ...prevData.family4, previousReading: latestReadings.family4 },
          mainMeter: { ...prevData.mainMeter, previousReading: latestReadings.mainMeter },
          waterMotor: { ...prevData.waterMotor, previousReading: latestReadings.waterMotor }
        }));
        
        // Update cost per unit
        setCostPerUnit(latestCostPerUnit.toString());
        
      } catch (err) {
        console.error('Error fetching reading data:', err);
        
        // Check if this is an authentication error
        if (isAuthError(err)) {
          setAuthError("Your session has expired. Please sign in again.");
          
          // Forward auth error to parent component if using onSubmit for auth handling
          onSubmit({ authError: err });
        }
      } finally {
        setLoading(false);
      }
    };

    if (spreadsheetId) {
      fetchReadings();
    }
  }, [spreadsheetId, isAuthError, onSubmit]);
  
  // Handle cost per unit change
  const handleCostChange = (e) => {
    setCostPerUnit(e.target.value);
    
    // Clear any error
    if (errors.costPerUnit) {
      setErrors(prev => ({ ...prev, costPerUnit: '' }));
    }
  };
  
  // Handle reading change
  const handleReadingChange = (meterId, value) => {
    setMeterData(prevData => ({
      ...prevData,
      [meterId]: { ...prevData[meterId], currentReading: value }
    }));
    
    // Clear any error for this meter
    if (errors[meterId]) {
      setErrors(prev => ({ ...prev, [meterId]: '' }));
    }
  };
  
  // Calculate the total number of family members
  const getTotalFamilyMembers = () => {
    return meterData.family1.members + 
           meterData.family2.members + 
           meterData.family3.members + 
           meterData.family4.members;
  };
  
  // Calculate percentages that add up to exactly 100%
  const getExactPercentages = () => {
    const total = getTotalFamilyMembers();
    if (total === 0) return { family1: 0, family2: 0, family3: 0, family4: 0 };
    
    const rawPercents = {
      family1: (meterData.family1.members / total) * 100,
      family2: (meterData.family2.members / total) * 100,
      family3: (meterData.family3.members / total) * 100,
      family4: (meterData.family4.members / total) * 100
    };
    
    // Convert to 2 decimal places
    const roundedPercents = {
      family1: parseFloat(rawPercents.family1.toFixed(2)),
      family2: parseFloat(rawPercents.family2.toFixed(2)),
      family3: parseFloat(rawPercents.family3.toFixed(2)),
      family4: parseFloat(rawPercents.family4.toFixed(2))
    };
    
    // Calculate the sum of rounded percentages
    const sumRounded = roundedPercents.family1 + roundedPercents.family2 + 
                       roundedPercents.family3 + roundedPercents.family4;
    
    // Adjust the largest value to ensure sum is exactly 100%
    const diff = parseFloat((100 - sumRounded).toFixed(2));
    
    if (diff !== 0) {
      // Find the family with the largest number of members to adjust
      let largestFamily = 'family1';
      if (meterData.family2.members > meterData[largestFamily].members) largestFamily = 'family2';
      if (meterData.family3.members > meterData[largestFamily].members) largestFamily = 'family3';
      if (meterData.family4.members > meterData[largestFamily].members) largestFamily = 'family4';
      
      roundedPercents[largestFamily] += diff;
    }
    
    return roundedPercents;
  };
  
  // Validate the form
  const validateForm = () => {
    const newErrors = {};
    
    // Validate cost per unit
    if (!costPerUnit.trim()) {
      newErrors.costPerUnit = 'Cost per unit is required';
    } else if (isNaN(costPerUnit) || parseFloat(costPerUnit) <= 0) {
      newErrors.costPerUnit = 'Must be a valid positive number';
    }
    
    // Validate each meter's current reading
    Object.entries(meterData).forEach(([meterId, meter]) => {
      const currentReading = meter.currentReading;
      const previousReading = meter.previousReading;
      
      if (currentReading === '') {
        // Empty is ok for some meters
      } else if (isNaN(currentReading) || parseFloat(currentReading) < 0) {
        newErrors[meterId] = 'Must be a valid positive number';
      } else if (parseFloat(currentReading) <= previousReading) {
        newErrors[meterId] = 'Must be greater than previous reading';
      }
    });
    
    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };
  
  // Handle form submission
  const handleSubmit = async (e) => {
    e.preventDefault();
    
    if (!validateForm()) {
      return;
    }
    
    setFormSubmitting(true);
    
    try {
      // Calculate water motor units and cost if available
      let waterMotorUnits = 0;
      let waterMotorCostPerFamily = {};
      let waterMotorUnitsPerFamily = {};
      
      const waterMotorMeter = meterData.waterMotor;
      if (waterMotorMeter.currentReading !== '' && !isNaN(waterMotorMeter.currentReading)) {
        waterMotorUnits = parseFloat(waterMotorMeter.currentReading) - waterMotorMeter.previousReading;
        const totalWaterCost = waterMotorUnits * parseFloat(costPerUnit);
        
        console.log(`Water Motor: Total units=${waterMotorUnits}, totalCost=${totalWaterCost}`);
        
        // Calculate water bill distribution for each family
        const totalFamilyMembers = getTotalFamilyMembers();
        
        // Only process if there are family members to distribute to
        if (totalFamilyMembers > 0) {
          for (const [meterId, meter] of Object.entries(meterData)) {
            if (meterId.startsWith('family') && meter.members && meter.members > 0) {
              const familyWaterUnits = (waterMotorUnits * meter.members) / totalFamilyMembers;
              const familyWaterCost = (totalWaterCost * meter.members) / totalFamilyMembers;
              
              console.log(`${meter.name}: members=${meter.members}, waterUnits=${familyWaterUnits.toFixed(2)}, waterCost=${familyWaterCost.toFixed(2)}`);
              
              // Store for later use when processing the family meters
              waterMotorCostPerFamily[meterId] = familyWaterCost;
              waterMotorUnitsPerFamily[meterId] = familyWaterUnits;
            }
          }
        }
        
        // Submit the main water motor reading as a separate record
        const waterMotorFormData = {
          tenantName: waterMotorMeter.name,
          previousReading: waterMotorMeter.previousReading,
          currentReading: parseFloat(waterMotorMeter.currentReading),
          costPerUnit: parseFloat(costPerUnit)
        };
        
        try {
          await onSubmit(waterMotorFormData);
        } catch (err) {
          // Check if auth error
          if (isAuthError(err)) {
            throw err; // Re-throw to be caught by the outer try-catch
          }
        }
      }
      
      // Check if we have at least one valid reading
      const metersWithReadings = Object.entries(meterData)
        .filter(([meterId, meter]) => 
          meter.currentReading !== '' && 
          !isNaN(meter.currentReading) && 
          // Skip water motor in this filtering as we'll handle it separately
          meterId !== 'waterMotor'
        );
      
      if (metersWithReadings.length === 0 && Object.keys(waterMotorUnitsPerFamily).length === 0) {
        alert('Please enter at least one current reading');
        setFormSubmitting(false);
        return;
      }
      
      // Process and submit individual meter readings
      for (const [meterId, meter] of metersWithReadings) {
        const currentReadingValue = parseFloat(meter.currentReading);
        const previousReadingValue = meter.previousReading;
        
        // Create basic form data
        const formData = {
          tenantName: meter.name,
          previousReading: previousReadingValue,
          currentReading: currentReadingValue,
          costPerUnit: parseFloat(costPerUnit)
        };
        
        // Add water data if this is a family meter
        if (meterId.startsWith('family')) {
          // If water motor data exists, use it
          if (waterMotorUnitsPerFamily[meterId]) {
            formData.waterUnits = parseFloat(waterMotorUnitsPerFamily[meterId].toFixed(2));
            formData.waterCost = parseFloat(waterMotorCostPerFamily[meterId].toFixed(2));
            console.log(`Attaching water data to ${meter.name}: units=${formData.waterUnits}, cost=${formData.waterCost}`);
          } else if (waterMotorUnits > 0 && getTotalFamilyMembers() > 0) {
            // Calculate the water units and cost on the fly if we have water meter readings
            // but they weren't calculated for this family yet (edge case)
            const totalWaterCost = waterMotorUnits * parseFloat(costPerUnit);
            const familyWaterUnits = (waterMotorUnits * meter.members) / getTotalFamilyMembers();
            const familyWaterCost = (totalWaterCost * meter.members) / getTotalFamilyMembers();
            
            formData.waterUnits = parseFloat(familyWaterUnits.toFixed(2));
            formData.waterCost = parseFloat(familyWaterCost.toFixed(2));
            console.log(`Calculated water data for ${meter.name}: units=${formData.waterUnits}, cost=${formData.waterCost}`);
          } else {
            // If no water data exists, set to 0 rather than undefined
            formData.waterUnits = 0;
            formData.waterCost = 0;
            console.log(`No water data for ${meter.name}, setting to 0`);
          }
          formData.includesWater = true;
        } else {
          console.log(`${meter.name} is not a family meter, no water data`);
        }
        
        // Submit the data
        try {
          await onSubmit(formData);
        } catch (err) {
          // Check if auth error
          if (isAuthError(err)) {
            throw err; // Re-throw to be caught by the outer try-catch
          }
        }
      }
      
      // If we have water readings but no meter readings for a family, create entries for water bills only
      if (Object.keys(waterMotorUnitsPerFamily).length > 0 || waterMotorUnits > 0) {
        for (const [meterId, meter] of Object.entries(meterData)) {
          if (meterId.startsWith('family') && meter.currentReading === '') {
            let familyWaterUnits = 0;
            let familyWaterCost = 0;
            
            // Use pre-calculated values if available
            if (waterMotorUnitsPerFamily[meterId]) {
              familyWaterUnits = waterMotorUnitsPerFamily[meterId];
              familyWaterCost = waterMotorCostPerFamily[meterId];
            } 
            // Otherwise calculate them directly if we have water meter data
            else if (waterMotorUnits > 0 && getTotalFamilyMembers() > 0 && meter.members > 0) {
              const totalWaterCost = waterMotorUnits * parseFloat(costPerUnit);
              familyWaterUnits = (waterMotorUnits * meter.members) / getTotalFamilyMembers();
              familyWaterCost = (totalWaterCost * meter.members) / getTotalFamilyMembers();
            }
            
            // Only create entries if we have water units to assign
            if (familyWaterUnits > 0) {
              // Create water-only form data for this family
              const formData = {
                tenantName: meter.name,
                previousReading: meter.previousReading,
                currentReading: meter.previousReading, // Same as previous, no electricity used
                costPerUnit: parseFloat(costPerUnit),
                waterUnits: parseFloat(familyWaterUnits.toFixed(2)),
                waterCost: parseFloat(familyWaterCost.toFixed(2)),
                includesWater: true
              };
              
              try {
                await onSubmit(formData);
              } catch (err) {
                // Check if auth error
                if (isAuthError(err)) {
                  throw err; // Re-throw to be caught by the outer try-catch
                }
              }
            }
          }
        }
      }
      
      // Reset the current readings after submission
      setMeterData(prevData => {
        const updatedData = { ...prevData };
        
        // Update previous readings and clear current readings
        Object.entries(updatedData).forEach(([meterId, meter]) => {
          if (meter.currentReading !== '') {
            updatedData[meterId] = {
              ...meter,
              previousReading: parseFloat(meter.currentReading),
              currentReading: ''
            };
          }
        });
        
        return updatedData;
      });
      
      // Clear the currentBill in App.js to make sure "Enter More Readings" works
      onSubmit({clearBillData: true});
      
    } catch (error) {
      console.error('Error submitting form:', error);
      
      // Check if this is an authentication error
      if (isAuthError(error)) {
        setAuthError("Your session has expired. Please sign in again.");
        // Forward auth error to parent component
        onSubmit({ authError: error });
      } else {
        alert('Error submitting form. Please try again.');
      }
    } finally {
      setFormSubmitting(false);
    }
  };
  
  // Toggle family settings panel
  const toggleFamilySettings = () => {
    setShowFamilySettings(!showFamilySettings);
  };

  // Handle family member count change
  const handleMemberCountChange = (meterId, value) => {
    const members = parseInt(value, 10);
    if (isNaN(members) || members < 1) return;

    setMeterData(prevData => ({
      ...prevData,
      [meterId]: { ...prevData[meterId], members }
    }));
  };
  
  // Handle family name change
  const handleFamilyNameChange = (meterId, value) => {
    if (!value.trim()) return;
    
    setMeterData(prevData => ({
      ...prevData,
      [meterId]: { ...prevData[meterId], name: value }
    }));
  };
  
  // Display auth error if present
  if (authError) {
    return (
      <div className="auth-error-container">
        <div className="auth-error-message">
          <h3>Authentication Error</h3>
          <p>{authError}</p>
          <p>Please reload the page and sign in again.</p>
        </div>
      </div>
    );
  }
  
  if (loading) {
    return <div className="loading">Loading meter data...</div>;
  }
  
  return (
    <div className="electricity-form">
      <h2>Enter Electricity Readings</h2>
      
      {/* Family Settings Toggle */}
      <div className="family-settings-toggle">
        <button 
          type="button" 
          onClick={toggleFamilySettings}
          className="toggle-btn"
        >
          {showFamilySettings ? 'Hide Family Settings' : 'Configure Family Members'}
        </button>
      </div>
      
      {/* Family Settings Panel */}
      {showFamilySettings && (
        <div className="family-settings-panel">
          <h3>Update Family Names and Member Counts</h3>
          <div className="family-members-grid">
            <div className="family-member-item">
              <label>Family 1 Name:</label>
              <input
                type="text"
                value={meterData.family1.name}
                onChange={(e) => handleFamilyNameChange('family1', e.target.value)}
                placeholder="Enter family name"
              />
              <label>Members:</label>
              <input
                type="number"
                min="1"
                value={meterData.family1.members}
                onChange={(e) => handleMemberCountChange('family1', e.target.value)}
              />
            </div>
            <div className="family-member-item">
              <label>Family 2 Name:</label>
              <input
                type="text"
                value={meterData.family2.name}
                onChange={(e) => handleFamilyNameChange('family2', e.target.value)}
                placeholder="Enter family name"
              />
              <label>Members:</label>
              <input
                type="number"
                min="1"
                value={meterData.family2.members}
                onChange={(e) => handleMemberCountChange('family2', e.target.value)}
              />
            </div>
            <div className="family-member-item">
              <label>Family 3 Name:</label>
              <input
                type="text"
                value={meterData.family3.name}
                onChange={(e) => handleFamilyNameChange('family3', e.target.value)}
                placeholder="Enter family name"
              />
              <label>Members:</label>
              <input
                type="number"
                min="1"
                value={meterData.family3.members}
                onChange={(e) => handleMemberCountChange('family3', e.target.value)}
              />
            </div>
            <div className="family-member-item">
              <label>Family 4 Name:</label>
              <input
                type="text"
                value={meterData.family4.name}
                onChange={(e) => handleFamilyNameChange('family4', e.target.value)}
                placeholder="Enter family name"
              />
              <label>Members:</label>
              <input
                type="number"
                min="1"
                value={meterData.family4.members}
                onChange={(e) => handleMemberCountChange('family4', e.target.value)}
              />
            </div>
          </div>
          <div className="total-members">
            <strong>Total Members:</strong> {getTotalFamilyMembers()}
          </div>
        </div>
      )}
      
      <form onSubmit={handleSubmit}>
        <div className="form-group cost-group">
          <label htmlFor="costPerUnit">Electricity Cost per Unit (₹)</label>
          <input
            type="number"
            id="costPerUnit"
            value={costPerUnit}
            onChange={handleCostChange}
            step="0.01"
            placeholder="Enter cost in INR"
            disabled={formSubmitting}
          />
          {errors.costPerUnit && <div className="error-message">{errors.costPerUnit}</div>}
        </div>
        
        <div className="meters-container">
          <h3>Current Meter Readings</h3>
          
          <div className="meters-grid">
            {/* Shop Meter */}
            <div className="meter-card">
              <h4>Shop Meter</h4>
              <div className="meter-info">
                <div className="meter-reading">
                  <div className="previous-reading">Previous: {meterData.shop.previousReading} units</div>
                  <div className="reading-input">
                    <label>Current Reading:</label>
                    <input
                      type="number"
                      value={meterData.shop.currentReading}
                      onChange={(e) => handleReadingChange('shop', e.target.value)}
                      placeholder="Enter current reading"
                      disabled={formSubmitting}
                    />
                    {errors.shop && <div className="error-message">{errors.shop}</div>}
                  </div>
                </div>
              </div>
            </div>
            
            {/* Families Section */}
            <div className="meter-card families-meter">
              <h4>Family Meters</h4>
              <div className="families-grid">
                {/* Family 1 */}
                <div className="family-meter">
                  <div className="meter-info">
                    <div className="family-name">
                      {meterData.family1.name}
                      <span className="member-count">{meterData.family1.members} members</span>
                    </div>
                    <div className="previous-reading">Previous: {meterData.family1.previousReading} units</div>
                    <div className="reading-input">
                      <input
                        type="number"
                        value={meterData.family1.currentReading}
                        onChange={(e) => handleReadingChange('family1', e.target.value)}
                        placeholder="Enter current reading"
                        disabled={formSubmitting}
                      />
                      {errors.family1 && <div className="error-message">{errors.family1}</div>}
                    </div>
                  </div>
                </div>
                
                {/* Family 2 */}
                <div className="family-meter">
                  <div className="meter-info">
                    <div className="family-name">
                      {meterData.family2.name}
                      <span className="member-count">{meterData.family2.members} members</span>
                    </div>
                    <div className="previous-reading">Previous: {meterData.family2.previousReading} units</div>
                    <div className="reading-input">
                      <input
                        type="number"
                        value={meterData.family2.currentReading}
                        onChange={(e) => handleReadingChange('family2', e.target.value)}
                        placeholder="Enter current reading"
                        disabled={formSubmitting}
                      />
                      {errors.family2 && <div className="error-message">{errors.family2}</div>}
                    </div>
                  </div>
                </div>
                
                {/* Family 3 */}
                <div className="family-meter">
                  <div className="meter-info">
                    <div className="family-name">
                      {meterData.family3.name}
                      <span className="member-count">{meterData.family3.members} members</span>
                    </div>
                    <div className="previous-reading">Previous: {meterData.family3.previousReading} units</div>
                    <div className="reading-input">
                      <input
                        type="number"
                        value={meterData.family3.currentReading}
                        onChange={(e) => handleReadingChange('family3', e.target.value)}
                        placeholder="Enter current reading"
                        disabled={formSubmitting}
                      />
                      {errors.family3 && <div className="error-message">{errors.family3}</div>}
                    </div>
                  </div>
                </div>
                
                {/* Family 4 */}
                <div className="family-meter">
                  <div className="meter-info">
                    <div className="family-name">
                      {meterData.family4.name}
                      <span className="member-count">{meterData.family4.members} members</span>
                    </div>
                    <div className="previous-reading">Previous: {meterData.family4.previousReading} units</div>
                    <div className="reading-input">
                      <input
                        type="number"
                        value={meterData.family4.currentReading}
                        onChange={(e) => handleReadingChange('family4', e.target.value)}
                        placeholder="Enter current reading"
                        disabled={formSubmitting}
                      />
                      {errors.family4 && <div className="error-message">{errors.family4}</div>}
                    </div>
                  </div>
                </div>
              </div>
            </div>
            
            {/* Main Meter */}
            <div className="meter-card">
              <h4>Main Meter</h4>
              <div className="meter-info">
                <div className="meter-reading">
                  <div className="previous-reading">Previous: {meterData.mainMeter.previousReading} units</div>
                  <div className="reading-input">
                    <label>Current Reading:</label>
                    <input
                      type="number"
                      value={meterData.mainMeter.currentReading}
                      onChange={(e) => handleReadingChange('mainMeter', e.target.value)}
                      placeholder="Enter current reading"
                      disabled={formSubmitting}
                    />
                    {errors.mainMeter && <div className="error-message">{errors.mainMeter}</div>}
                  </div>
                </div>
              </div>
            </div>
            
            {/* Water Motor Meter */}
            <div className="meter-card">
              <h4>Water Motor Meter</h4>
              <div className="meter-info">
                <div className="meter-reading">
                  <div className="previous-reading">Previous: {meterData.waterMotor.previousReading} units</div>
                  <div className="reading-input">
                    <label>Current Reading:</label>
                    <input
                      type="number"
                      value={meterData.waterMotor.currentReading}
                      onChange={(e) => handleReadingChange('waterMotor', e.target.value)}
                      placeholder="Enter current reading"
                      disabled={formSubmitting}
                    />
                    {errors.waterMotor && <div className="error-message">{errors.waterMotor}</div>}
                  </div>
                </div>
                <div className="motor-info">
                  <p>Water motor bill will be divided based on family members:</p>
                  {(() => {
                    const percentages = getExactPercentages();
                    return (
                      <ul>
                        <li>
                          {meterData.family1.name}
                          <span>{meterData.family1.members} members ({percentages.family1.toFixed(2)}%)</span>
                        </li>
                        <li>
                          {meterData.family2.name}
                          <span>{meterData.family2.members} members ({percentages.family2.toFixed(2)}%)</span>
                        </li>
                        <li>
                          {meterData.family3.name}
                          <span>{meterData.family3.members} members ({percentages.family3.toFixed(2)}%)</span>
                        </li>
                        <li>
                          {meterData.family4.name}
                          <span>{meterData.family4.members} members ({percentages.family4.toFixed(2)}%)</span>
                        </li>
                      </ul>
                    );
                  })()}
                </div>
              </div>
            </div>
          </div>
        </div>
        
        <button 
          type="submit" 
          className="submit-btn" 
          disabled={formSubmitting}
        >
          {formSubmitting ? 'Submitting...' : 'Calculate & Save Readings'}
        </button>
      </form>
    </div>
  );
}

export default ElectricityForm; 