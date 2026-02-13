import React from 'react';

interface ProgressBarProps {
  current: number;
  target: number;
  showLabel?: boolean;
  showPercentage?: boolean;
  color?: 'blue' | 'green' | 'yellow' | 'red';
  size?: 'sm' | 'md' | 'lg';
  className?: string;
}

export const ProgressBar: React.FC<ProgressBarProps> = ({
  current,
  target,
  showLabel = true,
  showPercentage = true,
  color = 'blue',
  size = 'md',
  className = ''
}) => {
  const percentage = target > 0 ? Math.min((current / target) * 100, 100) : 0;
  const isComplete = percentage >= 100;

  const colorClasses = {
    blue: isComplete ? 'bg-green-500' : 'bg-blue-600',
    green: 'bg-green-500',
    yellow: 'bg-yellow-500',
    red: 'bg-red-500'
  };

  const sizeClasses = {
    sm: 'h-1',
    md: 'h-2',
    lg: 'h-3'
  };

  return (
    <div className={`w-full ${className}`}>
      {showLabel && (
        <div className="flex items-center justify-between mb-1">
          <span className="text-sm text-gray-600">
            ${current.toLocaleString()} / ${target.toLocaleString()}
          </span>
          {showPercentage && (
            <span className="text-sm font-medium text-gray-900">
              {percentage.toFixed(1)}%
            </span>
          )}
        </div>
      )}
      <div className={`w-full bg-gray-200 rounded-full overflow-hidden ${sizeClasses[size]}`}>
        <div
          className={`${colorClasses[color]} transition-all duration-300 ${sizeClasses[size]} rounded-full`}
          style={{ width: `${percentage}%` }}
        />
      </div>
    </div>
  );
};

