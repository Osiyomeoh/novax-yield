import React from 'react';
import { Link } from 'react-router-dom';
import { TrendingUp } from 'lucide-react';

interface NovaxLogoProps {
  className?: string;
  showText?: boolean;
  size?: 'sm' | 'md' | 'lg';
  onClick?: () => void;
  variant?: 'full' | 'icon' | 'text';
}

const NovaxLogo: React.FC<NovaxLogoProps> = ({ 
  className = '', 
  showText = true,
  size = 'md',
  onClick,
  variant = 'full'
}) => {
  const sizeClasses = {
    sm: 'h-6 w-6',
    md: 'h-8 w-8',
    lg: 'h-12 w-12'
  };

  const textSizeClasses = {
    sm: 'text-lg',
    md: 'text-xl',
    lg: 'text-2xl'
  };

  const iconSizeClasses = {
    sm: 'h-5 w-5',
    md: 'h-6 w-6',
    lg: 'h-8 w-8'
  };

  const Component = onClick ? 'button' : Link;
  const componentProps = onClick 
    ? { onClick, className: `flex items-center space-x-2 ${className}` }
    : { to: '/', className: `flex items-center space-x-2 ${className}` };

  // Icon-only variant
  if (variant === 'icon') {
    return (
      <Component {...componentProps}>
        <div className={`${sizeClasses[size]} rounded-lg bg-gradient-to-br from-green-500 to-emerald-600 flex items-center justify-center shadow-lg`}>
          <TrendingUp className={`${iconSizeClasses[size]} text-white`} />
        </div>
      </Component>
    );
  }

  // Text-only variant
  if (variant === 'text') {
    return (
      <Component {...componentProps}>
        <span className={`font-bold ${textSizeClasses[size]} bg-gradient-to-r from-green-600 to-emerald-600 bg-clip-text text-transparent`}>
          Novax Yield
        </span>
      </Component>
    );
  }

  // Full variant (icon + text)
  return (
    <Component {...componentProps}>
      {/* Novax Yield Icon */}
      <div className={`${sizeClasses[size]} rounded-lg bg-gradient-to-br from-green-500 to-emerald-600 flex items-center justify-center shadow-lg`}>
        <TrendingUp className={`${iconSizeClasses[size]} text-white`} />
      </div>
      
      {/* Novax Yield Text */}
      {showText && (
        <div className="flex flex-col">
          <span className={`font-bold ${textSizeClasses[size]} bg-gradient-to-r from-green-600 to-emerald-600 bg-clip-text text-transparent`}>
            Novax Yield
          </span>
          <span className={`text-xs text-gray-500 dark:text-gray-400`}>
            Yield Platform
          </span>
        </div>
      )}
    </Component>
  );
};

export default NovaxLogo;

