// AutoFill component removed - no mock data support
// This component was used for testing with mock data
import React from 'react';

interface AutoFillProps {
  onAutoFill?: (data: any) => void;
  disabled?: boolean;
  className?: string;
}

const AutoFill: React.FC<AutoFillProps> = () => {
  // Component disabled - mock data removed
  return null;
};

export default AutoFill;
