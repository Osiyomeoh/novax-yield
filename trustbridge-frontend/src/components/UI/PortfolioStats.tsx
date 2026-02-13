import React from 'react';
import { TrendingUp, DollarSign, FileText, Activity, ArrowUp, ArrowDown } from 'lucide-react';
import { Card, CardContent } from './Card';

interface PortfolioStatsProps {
  totalReceivables: number;
  totalReceivablesValue: number;
  totalInvestments: number;
  totalInvested: number;
  totalYield: number;
  nvxBalance: number;
  verifiedCount: number;
  previousPeriod?: {
    receivables?: number;
    investments?: number;
    yield?: number;
  };
}

export const PortfolioStats: React.FC<PortfolioStatsProps> = ({
  totalReceivables,
  totalReceivablesValue,
  totalInvestments,
  totalInvested,
  totalYield,
  nvxBalance,
  verifiedCount,
  previousPeriod
}) => {
  const calculateChange = (current: number, previous?: number) => {
    if (!previous || previous === 0) return null;
    const change = ((current - previous) / previous) * 100;
    return {
      value: Math.abs(change),
      isPositive: change >= 0
    };
  };

  const receivablesChange = calculateChange(totalReceivables, previousPeriod?.receivables);
  const investmentsChange = calculateChange(totalInvestments, previousPeriod?.investments);
  const yieldChange = calculateChange(totalYield, previousPeriod?.yield);

  return (
    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
      {/* Receivables Card */}
      <Card className="bg-midnight-800/50 border-medium-gray/30 hover:border-primary-blue/50 transition-colors">
        <CardContent className="p-6">
          <div className="flex items-center justify-between mb-2">
            <FileText className="w-5 h-5 text-primary-blue" />
            {receivablesChange && (
              <div className={`flex items-center gap-1 text-xs ${
                receivablesChange.isPositive ? 'text-green-400' : 'text-red-400'
              }`}>
                {receivablesChange.isPositive ? (
                  <ArrowUp className="w-3 h-3" />
                ) : (
                  <ArrowDown className="w-3 h-3" />
                )}
                {receivablesChange.value.toFixed(1)}%
              </div>
            )}
          </div>
          <p className="text-sm text-text-secondary mb-1">Receivables</p>
          <p className="text-2xl font-bold text-off-white">{totalReceivables}</p>
          <p className="text-xs text-text-secondary mt-1">
            ${totalReceivablesValue.toLocaleString(undefined, { maximumFractionDigits: 2 })}
          </p>
        </CardContent>
      </Card>

      {/* Investments Card */}
      <Card className="bg-midnight-800/50 border-medium-gray/30 hover:border-primary-blue-light/50 transition-colors">
        <CardContent className="p-6">
          <div className="flex items-center justify-between mb-2">
            <TrendingUp className="w-5 h-5 text-primary-blue-light" />
            {investmentsChange && (
              <div className={`flex items-center gap-1 text-xs ${
                investmentsChange.isPositive ? 'text-green-400' : 'text-red-400'
              }`}>
                {investmentsChange.isPositive ? (
                  <ArrowUp className="w-3 h-3" />
                ) : (
                  <ArrowDown className="w-3 h-3" />
                )}
                {investmentsChange.value.toFixed(1)}%
              </div>
            )}
          </div>
          <p className="text-sm text-text-secondary mb-1">Active Investments</p>
          <p className="text-2xl font-bold text-off-white">{totalInvestments}</p>
          <p className="text-xs text-text-secondary mt-1">
            ${totalInvested.toLocaleString(undefined, { maximumFractionDigits: 2 })}
          </p>
        </CardContent>
      </Card>

      {/* NVX Tokens Card */}
      <Card className="bg-midnight-800/50 border-medium-gray/30 hover:border-green-400/50 transition-colors">
        <CardContent className="p-6">
          <div className="flex items-center justify-between mb-2">
            <DollarSign className="w-5 h-5 text-green-400" />
          </div>
          <p className="text-sm text-text-secondary mb-1">NVX Tokens</p>
          <p className="text-2xl font-bold text-off-white">
            {nvxBalance.toLocaleString(undefined, { maximumFractionDigits: 2 })}
          </p>
          <p className="text-xs text-text-secondary mt-1">Governance & Rewards</p>
        </CardContent>
      </Card>

      {/* Yield Earned Card */}
      <Card className="bg-midnight-800/50 border-medium-gray/30 hover:border-purple-400/50 transition-colors">
        <CardContent className="p-6">
          <div className="flex items-center justify-between mb-2">
            <Activity className="w-5 h-5 text-purple-400" />
            {yieldChange && (
              <div className={`flex items-center gap-1 text-xs ${
                yieldChange.isPositive ? 'text-green-400' : 'text-red-400'
              }`}>
                {yieldChange.isPositive ? (
                  <ArrowUp className="w-3 h-3" />
                ) : (
                  <ArrowDown className="w-3 h-3" />
                )}
                {yieldChange.value.toFixed(1)}%
              </div>
            )}
          </div>
          <p className="text-sm text-text-secondary mb-1">Total Yield Earned</p>
          <p className="text-2xl font-bold text-off-white">
            ${totalYield.toLocaleString(undefined, { maximumFractionDigits: 2 })}
          </p>
          <p className="text-xs text-text-secondary mt-1">Lifetime earnings</p>
        </CardContent>
      </Card>
    </div>
  );
};

