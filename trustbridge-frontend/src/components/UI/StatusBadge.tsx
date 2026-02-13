import React from 'react';
import { CheckCircle, Clock, XCircle, AlertCircle, Pause } from 'lucide-react';

export type StatusType = 
  | 'active' 
  | 'funded' 
  | 'matured' 
  | 'paid' 
  | 'defaulted' 
  | 'closed' 
  | 'paused'
  | 'pending'
  | 'verified'
  | 'rejected';

interface StatusBadgeProps {
  status: StatusType | string;
  size?: 'sm' | 'md' | 'lg';
  showIcon?: boolean;
  className?: string;
}

export const StatusBadge: React.FC<StatusBadgeProps> = ({
  status,
  size = 'md',
  showIcon = true,
  className = ''
}) => {
  const statusLower = status.toLowerCase();

  const getStatusConfig = () => {
    switch (statusLower) {
      case 'active':
      case 'verified':
        return {
          label: statusLower === 'active' ? 'Active' : 'Verified',
          color: 'bg-green-100 text-green-800 border-green-200',
          icon: CheckCircle,
          iconColor: 'text-green-600'
        };
      case 'funded':
        return {
          label: 'Funded',
          color: 'bg-blue-100 text-blue-800 border-blue-200',
          icon: CheckCircle,
          iconColor: 'text-blue-600'
        };
      case 'matured':
        return {
          label: 'Matured',
          color: 'bg-purple-100 text-purple-800 border-purple-200',
          icon: Clock,
          iconColor: 'text-purple-600'
        };
      case 'paid':
        return {
          label: 'Paid',
          color: 'bg-green-100 text-green-800 border-green-200',
          icon: CheckCircle,
          iconColor: 'text-green-600'
        };
      case 'pending':
      case 'pending_verification':
        return {
          label: 'Pending',
          color: 'bg-yellow-100 text-yellow-800 border-yellow-200',
          icon: Clock,
          iconColor: 'text-yellow-600'
        };
      case 'defaulted':
      case 'rejected':
        return {
          label: statusLower === 'defaulted' ? 'Defaulted' : 'Rejected',
          color: 'bg-red-100 text-red-800 border-red-200',
          icon: XCircle,
          iconColor: 'text-red-600'
        };
      case 'closed':
        return {
          label: 'Closed',
          color: 'bg-gray-100 text-gray-800 border-gray-200',
          icon: XCircle,
          iconColor: 'text-gray-600'
        };
      case 'paused':
        return {
          label: 'Paused',
          color: 'bg-orange-100 text-orange-800 border-orange-200',
          icon: Pause,
          iconColor: 'text-orange-600'
        };
      default:
        return {
          label: status,
          color: 'bg-gray-100 text-gray-800 border-gray-200',
          icon: AlertCircle,
          iconColor: 'text-gray-600'
        };
    }
  };

  const config = getStatusConfig();
  const Icon = config.icon;

  const sizeClasses = {
    sm: 'text-xs px-2 py-0.5',
    md: 'text-sm px-2.5 py-1',
    lg: 'text-base px-3 py-1.5'
  };

  const iconSizes = {
    sm: 'w-3 h-3',
    md: 'w-4 h-4',
    lg: 'w-5 h-5'
  };

  return (
    <span
      className={`inline-flex items-center gap-1.5 font-medium rounded-full border ${config.color} ${sizeClasses[size]} ${className}`}
    >
      {showIcon && <Icon className={iconSizes[size] + ' ' + config.iconColor} />}
      {config.label}
    </span>
  );
};

