import React from 'react';
import { ArrowUpDown, ArrowUp, ArrowDown } from 'lucide-react';
import Button from './Button';

export interface SortOption {
  id: string;
  label: string;
  icon?: React.ReactNode;
}

interface SortDropdownProps {
  options: SortOption[];
  selectedOption: string;
  sortOrder: 'asc' | 'desc';
  onOptionChange: (optionId: string) => void;
  onOrderChange: (order: 'asc' | 'desc') => void;
  className?: string;
}

export const SortDropdown: React.FC<SortDropdownProps> = ({
  options,
  selectedOption,
  sortOrder,
  onOptionChange,
  onOrderChange,
  className = ''
}) => {
  const selectedOptionLabel = options.find(opt => opt.id === selectedOption)?.label || selectedOption;

  return (
    <div className={`flex items-center gap-2 ${className}`}>
      <div className="relative">
        <select
          value={selectedOption}
          onChange={(e) => onOptionChange(e.target.value)}
          className="appearance-none px-4 py-2 pr-8 border border-gray-300 rounded-lg text-sm font-medium text-gray-700 bg-white focus:ring-2 focus:ring-blue-600 focus:border-blue-600 cursor-pointer"
        >
          {options.map((option) => (
            <option key={option.id} value={option.id}>
              {option.label}
            </option>
          ))}
        </select>
        <ArrowUpDown className="absolute right-2 top-1/2 transform -translate-y-1/2 w-4 h-4 text-gray-400 pointer-events-none" />
      </div>

      <Button
        variant="outline"
        size="sm"
        onClick={() => onOrderChange(sortOrder === 'asc' ? 'desc' : 'asc')}
        className="flex items-center gap-1"
        title={`Sort ${sortOrder === 'asc' ? 'Ascending' : 'Descending'}`}
      >
        {sortOrder === 'asc' ? (
          <ArrowUp className="w-4 h-4" />
        ) : (
          <ArrowDown className="w-4 h-4" />
        )}
      </Button>
    </div>
  );
};

