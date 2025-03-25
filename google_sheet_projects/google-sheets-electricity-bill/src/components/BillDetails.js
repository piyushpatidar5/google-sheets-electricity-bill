import React from 'react';

function BillDetails({ billData, onBack }) {
  const formatCurrency = (amount) => {
    return new Intl.NumberFormat('en-IN', {
      style: 'currency',
      currency: 'INR',
      minimumFractionDigits: 2
    }).format(amount);
  };

  if (!billData) {
    return <div className="loading">Loading bill details...</div>;
  }

  // Determine if this bill includes water usage
  const includesWater = billData.waterUnits !== undefined && billData.waterCost !== undefined;

  // Determine if this is a water motor reading
  const isWaterMotorReading = billData.tenantName && billData.tenantName.includes('Water Motor');

  // Calculate electricity cost (total bill minus water cost if included)
  const electricityCost = includesWater ? (billData.totalBill - billData.waterCost) : billData.totalBill;

  // Water-only bill (no electricity usage)
  const isWaterOnlyBill = includesWater && billData.unitsConsumed === 0 && billData.waterUnits > 0;

  return (
    <div className="bill-details">
      <h2>Electricity Bill Details</h2>
      
      <div className="bill-detail-row">
        <span className="bill-detail-label">Name:</span>
        <span className="bill-detail-value">{billData.tenantName}</span>
      </div>
      
      {!isWaterOnlyBill && (
        <>
          <div className="bill-detail-row">
            <span className="bill-detail-label">Previous Reading:</span>
            <span className="bill-detail-value">{billData.previousReading} units</span>
          </div>
          
          <div className="bill-detail-row">
            <span className="bill-detail-label">Current Reading:</span>
            <span className="bill-detail-value">{billData.currentReading} units</span>
          </div>
          
          <div className="bill-detail-row">
            <span className="bill-detail-label">Units Consumed:</span>
            <span className="bill-detail-value">{billData.unitsConsumed} units</span>
          </div>
          
          <div className="bill-detail-row">
            <span className="bill-detail-label">Cost per Unit:</span>
            <span className="bill-detail-value">{formatCurrency(billData.costPerUnit)}</span>
          </div>
          
          <div className="bill-detail-row">
            <span className="bill-detail-label">Electricity Cost:</span>
            <span className="bill-detail-value">{formatCurrency(electricityCost)}</span>
          </div>
        </>
      )}
      
      {includesWater && (
        <>
          <div className="bill-detail-section">
            <h3>{isWaterOnlyBill ? 'Water Bill Only' : 'Water Usage'}</h3>
            
            <div className="bill-detail-row">
              <span className="bill-detail-label">Water Units:</span>
              <span className="bill-detail-value">{billData.waterUnits.toFixed(2)} units</span>
            </div>
            
            <div className="bill-detail-row">
              <span className="bill-detail-label">Water Cost:</span>
              <span className="bill-detail-value">{formatCurrency(billData.waterCost)}</span>
            </div>
          </div>
        </>
      )}
      
      <div className="bill-detail-row total-row">
        <span className="bill-detail-label">Total Bill Amount:</span>
        <span className="bill-detail-value">{formatCurrency(billData.totalBill)}</span>
      </div>
      
      {isWaterMotorReading && (
        <div className="bill-note">
          <p><strong>Note:</strong> This is the main water motor reading. The cost will be distributed among families based on their member count.</p>
        </div>
      )}
      
      {isWaterOnlyBill && (
        <div className="bill-note">
          <p><strong>Note:</strong> This is a water-only bill with no electricity usage.</p>
        </div>
      )}
      
      <div className="bill-actions">
        <p>This information has been saved to your Google Sheet.</p>
        <button onClick={onBack} className="back-btn">Enter More Readings</button>
      </div>
    </div>
  );
}

export default BillDetails; 