/**
 * Chainlink Functions Source Code for Invoice Verification
 * 
 * This script runs off-chain via Chainlink Functions to verify invoice authenticity
 * Returns: CSV format "isValid,riskScore,creditRating"
 * 
 * This matches the inline JavaScript in NovaxVerificationModuleV2.sol
 * Can be used for testing or as a reference
 */

// Main entry point for Chainlink Functions
const main = async (args) => {
  // Parse input arguments
  const invoiceId = args[0] || '';
  const metadataCID = args[1] || '';
  const commodity = args[2] || 'Coffee';
  const amount = parseInt(args[3]) || 50000;
  const supplierCountry = args[4] || 'Kenya';
  const buyerCountry = args[5] || 'USA';
  const exporterName = args[6] || 'Test Exporter';
  const buyerName = args[7] || 'Test Buyer';

  try {
    // Make HTTP request to verification API
    const apiResponse = await Functions.makeHttpRequest({
      url: 'https://your-backend.com/chainlink/functions/verify-invoice',
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'User-Agent': 'Chainlink-Functions'
      },
      data: {
        receivableId: invoiceId,
        metadataCID: metadataCID,
        commodity: commodity,
        amount: amount,
        supplierCountry: supplierCountry,
        buyerCountry: buyerCountry,
        exporterName: exporterName,
        buyerName: buyerName
      }
    });

    if (apiResponse.error) {
      return Functions.encodeString('0,99,ERROR');
    }

    // Parse response - should be CSV format: isValid,riskScore,creditRating
    // API returns: { result: "1,25,A" }
    const result = apiResponse.data.result || apiResponse.data;
    
    // Ensure it's a string
    if (typeof result === 'string') {
      return Functions.encodeString(result);
    } else if (typeof result === 'object' && result.result) {
      return Functions.encodeString(result.result);
    } else {
      return Functions.encodeString('0,99,ERROR');
    }
  } catch (error) {
    console.error('Verification error:', error);
    return Functions.encodeString('0,99,ERROR');
  }
};

// Export for Chainlink Functions
if (typeof module !== 'undefined' && module.exports) {
  module.exports = { main };
}

// Legacy function (kept for reference)
const verifyInvoice = async (receivableId, metadataCID) => {
  try {
    // Step 1: Fetch invoice metadata from IPFS
    const ipfsUrl = `https://ipfs.io/ipfs/${metadataCID}`;
    const invoiceData = await makeRequest(ipfsUrl);
    
    if (invoiceData.error) {
      return {
        verified: false,
        riskScore: 100,
        apr: 0,
        reason: `IPFS fetch failed: ${invoiceData.error}`
      };
    }

    // Step 2: Extract invoice details
    const {
      exporter,
      importer,
      amount,
      dueDate,
      invoiceNumber,
      commodity,
      country,
      documents
    } = invoiceData;

    // Step 3: Verify invoice authenticity
    let verified = true;
    let riskScore = 25; // Start with low risk (25%)
    let apr = 1200; // 12% APR (1200 basis points)
    const reasons = [];

    // Check 1: Invoice amount validation
    if (!amount || amount <= 0) {
      verified = false;
      reasons.push("Invalid invoice amount");
    }

    // Check 2: Due date validation
    const currentDate = Math.floor(Date.now() / 1000);
    if (!dueDate || dueDate <= currentDate) {
      verified = false;
      reasons.push("Invalid or past due date");
    }

    // Check 3: Required documents
    if (!documents || !Array.isArray(documents) || documents.length === 0) {
      riskScore += 20; // Increase risk if no documents
      reasons.push("Missing supporting documents");
    }

    // Check 4: Country risk assessment
    const countryRiskMap = {
      'NG': 45, // Nigeria: 4.5% risk
      'KE': 35, // Kenya: 3.5% risk
      'GH': 30, // Ghana: 3.0% risk
      'ET': 40, // Ethiopia: 4.0% risk
      'ZA': 25, // South Africa: 2.5% risk
      'TZ': 38, // Tanzania: 3.8% risk
    };

    if (country && countryRiskMap[country]) {
      riskScore = countryRiskMap[country];
    } else if (country) {
      riskScore = 50; // Default for unknown countries
    }

    // Check 5: Commodity price validation (if available)
    if (commodity) {
      // Could fetch commodity prices from external API
      // For now, just validate commodity exists
    }

    // Check 6: Sanctions check (simplified)
    // In production, this would call a sanctions API
    const sanctionsList = []; // Would be populated from sanctions API
    if (exporter && sanctionsList.includes(exporter.toLowerCase())) {
      verified = false;
      reasons.push("Exporter on sanctions list");
    }

    // Calculate APR based on risk score
    // Lower risk = lower APR, Higher risk = higher APR
    if (riskScore <= 25) {
      apr = 1000; // 10% APR for low risk
    } else if (riskScore <= 40) {
      apr = 1200; // 12% APR for medium risk
    } else if (riskScore <= 60) {
      apr = 1500; // 15% APR for medium-high risk
    } else {
      apr = 2000; // 20% APR for high risk
    }

    // If verification failed, set high risk
    if (!verified) {
      riskScore = 100;
      apr = 0;
    }

    // Return result in format: "verified,riskScore,apr"
    return {
      verified,
      riskScore,
      apr,
      reason: reasons.length > 0 ? reasons.join('; ') : ''
    };

  } catch (error) {
    return {
      verified: false,
      riskScore: 100,
      apr: 0,
      reason: `Verification error: ${error.message}`
    };
  }
};

// Main entry point for Chainlink Functions
const main = async (args) => {
  // Parse input arguments
  // args[0] = receivableId (string)
  // args[1] = metadataCID (string)
  
  if (!args || args.length < 2) {
    return Buffer.from(JSON.stringify({
      verified: false,
      riskScore: 100,
      apr: 0,
      reason: "Missing required parameters"
    }));
  }

  const receivableId = args[0];
  const metadataCID = args[1];

  // Perform verification
  const result = await verifyInvoice(receivableId, metadataCID);

  // Return result as bytes (Chainlink Functions format)
  // Format: "verified,riskScore,apr" as comma-separated string
  const responseString = `${result.verified},${result.riskScore},${result.apr}`;
  
  return Buffer.from(responseString);
};

// Export for Chainlink Functions
if (typeof module !== 'undefined' && module.exports) {
  module.exports = { main };
}

