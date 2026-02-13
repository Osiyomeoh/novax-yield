import React, { useState, useEffect } from 'react';
import { Calculator, TrendingUp, Calendar, DollarSign } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from './Card';
import Input from './Input';
import Button from './Button';

interface InvestmentCalculatorProps {
  apy: number; // APY as percentage (e.g., 15 for 15%)
  maturityDate: number; // Unix timestamp
  minInvestment: number;
  maxInvestment: number;
  onCalculate?: (amount: number, returns: number) => void;
}

export const InvestmentCalculator: React.FC<InvestmentCalculatorProps> = ({
  apy,
  maturityDate,
  minInvestment,
  maxInvestment,
  onCalculate
}) => {
  const [investmentAmount, setInvestmentAmount] = useState<string>(minInvestment.toString());
  const [projectedReturns, setProjectedReturns] = useState({
    annual: 0,
    total: 0,
    roi: 0,
    daysUntilMaturity: 0
  });

  useEffect(() => {
    calculateReturns();
  }, [investmentAmount, apy, maturityDate]);

  const calculateReturns = () => {
    const amount = parseFloat(investmentAmount) || 0;
    
    if (amount < minInvestment || amount > maxInvestment) {
      setProjectedReturns({
        annual: 0,
        total: 0,
        roi: 0,
        daysUntilMaturity: 0
      });
      return;
    }

    // Calculate days until maturity
    const now = Date.now() / 1000;
    const daysUntilMaturity = Math.max(0, Math.floor((maturityDate - now) / 86400));

    // Calculate annual return
    const annualReturn = (amount * apy) / 100;

    // Calculate return for the period until maturity
    const periodReturn = (annualReturn * daysUntilMaturity) / 365;

    // Total return (principal + yield)
    const totalReturn = amount + periodReturn;

    // ROI percentage
    const roi = daysUntilMaturity > 0 ? (periodReturn / amount) * 100 : 0;

    setProjectedReturns({
      annual: annualReturn,
      total: totalReturn,
      roi: roi,
      daysUntilMaturity: daysUntilMaturity
    });

    if (onCalculate) {
      onCalculate(amount, periodReturn);
    }
  };

  const handleAmountChange = (value: string) => {
    // Remove non-numeric characters except decimal point
    const numericValue = value.replace(/[^0-9.]/g, '');
    setInvestmentAmount(numericValue);
  };

  const setQuickAmount = (percentage: number) => {
    const amount = (maxInvestment * percentage) / 100;
    setInvestmentAmount(amount.toFixed(2));
  };

  const formatDate = (timestamp: number) => {
    return new Date(timestamp * 1000).toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'short',
      day: 'numeric'
    });
  };

  return (
    <Card className="bg-white border border-gray-200">
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Calculator className="w-5 h-5" />
          Investment Calculator
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Investment Amount Input */}
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-2">
            Investment Amount (USDC)
          </label>
          <Input
            type="text"
            value={investmentAmount}
            onChange={(e) => handleAmountChange(e.target.value)}
            placeholder={`Min: $${minInvestment.toLocaleString()}`}
            className="text-lg"
          />
          <div className="flex items-center justify-between mt-1 text-xs text-gray-500">
            <span>Min: ${minInvestment.toLocaleString()}</span>
            <span>Max: ${maxInvestment.toLocaleString()}</span>
          </div>
          
          {/* Quick Amount Buttons */}
          <div className="flex gap-2 mt-2">
            <Button
              variant="outline"
              size="sm"
              onClick={() => setQuickAmount(25)}
              className="text-xs"
            >
              25%
            </Button>
            <Button
              variant="outline"
              size="sm"
              onClick={() => setQuickAmount(50)}
              className="text-xs"
            >
              50%
            </Button>
            <Button
              variant="outline"
              size="sm"
              onClick={() => setQuickAmount(75)}
              className="text-xs"
            >
              75%
            </Button>
            <Button
              variant="outline"
              size="sm"
              onClick={() => setQuickAmount(100)}
              className="text-xs"
            >
              Max
            </Button>
          </div>
        </div>

        {/* Projected Returns */}
        {parseFloat(investmentAmount) >= minInvestment && parseFloat(investmentAmount) <= maxInvestment && (
          <div className="bg-gray-50 rounded-lg p-4 space-y-3 border border-gray-200">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2 text-sm text-gray-600">
                <TrendingUp className="w-4 h-4" />
                <span>Projected Annual Return</span>
              </div>
              <span className="text-lg font-bold text-gray-900">
                ${projectedReturns.annual.toLocaleString(undefined, { maximumFractionDigits: 2 })}
              </span>
            </div>

            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2 text-sm text-gray-600">
                <DollarSign className="w-4 h-4" />
                <span>Total Return (Principal + Yield)</span>
              </div>
              <span className="text-lg font-bold text-green-600">
                ${projectedReturns.total.toLocaleString(undefined, { maximumFractionDigits: 2 })}
              </span>
            </div>

            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2 text-sm text-gray-600">
                <TrendingUp className="w-4 h-4" />
                <span>ROI</span>
              </div>
              <span className="text-lg font-bold text-blue-600">
                {projectedReturns.roi.toFixed(2)}%
              </span>
            </div>

            <div className="flex items-center justify-between pt-2 border-t border-gray-200">
              <div className="flex items-center gap-2 text-sm text-gray-600">
                <Calendar className="w-4 h-4" />
                <span>Maturity Date</span>
              </div>
              <span className="text-sm font-medium text-gray-900">
                {formatDate(maturityDate)}
              </span>
            </div>

            {projectedReturns.daysUntilMaturity > 0 && (
              <div className="text-xs text-gray-500 text-center pt-2 border-t border-gray-200">
                {projectedReturns.daysUntilMaturity} days until maturity
              </div>
            )}
          </div>
        )}

        {/* Validation Messages */}
        {parseFloat(investmentAmount) < minInvestment && parseFloat(investmentAmount) > 0 && (
          <div className="text-sm text-red-600 bg-red-50 p-2 rounded">
            Minimum investment is ${minInvestment.toLocaleString()} USDC
          </div>
        )}

        {parseFloat(investmentAmount) > maxInvestment && (
          <div className="text-sm text-red-600 bg-red-50 p-2 rounded">
            Maximum investment is ${maxInvestment.toLocaleString()} USDC
          </div>
        )}
      </CardContent>
    </Card>
  );
};

