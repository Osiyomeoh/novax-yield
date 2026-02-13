import React from 'react';
import { Search, Filter, X } from 'lucide-react';
import Button from './Button';
import Input from './Input';

export interface FilterOption {
  id: string;
  label: string;
  value?: string | number;
}

interface FilterBarProps {
  searchQuery: string;
  onSearchChange: (query: string) => void;
  filters?: {
    [key: string]: FilterOption[];
  };
  activeFilters?: {
    [key: string]: string | number;
  };
  onFilterChange?: (filterKey: string, value: string | number | null) => void;
  onClearFilters?: () => void;
  placeholder?: string;
}

export const FilterBar: React.FC<FilterBarProps> = ({
  searchQuery,
  onSearchChange,
  filters = {},
  activeFilters = {},
  onFilterChange,
  onClearFilters,
  placeholder = 'Search pools...'
}) => {
  const hasActiveFilters = Object.keys(activeFilters).length > 0;

  return (
    <div className="space-y-4">
      {/* Search Bar */}
      <div className="relative">
        <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 w-5 h-5 text-gray-400" />
        <Input
          type="text"
          value={searchQuery}
          onChange={(e) => onSearchChange(e.target.value)}
          placeholder={placeholder}
          className="pl-10 pr-4"
        />
      </div>

      {/* Filters */}
      {Object.keys(filters).length > 0 && (
        <div className="flex flex-wrap items-center gap-3">
          {Object.entries(filters).map(([filterKey, options]) => (
            <div key={filterKey} className="flex items-center gap-2">
              <label className="text-sm font-medium text-gray-700 capitalize">
                {filterKey.replace(/([A-Z])/g, ' $1').trim()}:
              </label>
              <select
                value={activeFilters[filterKey] || ''}
                onChange={(e) => {
                  const value = e.target.value;
                  if (onFilterChange) {
                    onFilterChange(filterKey, value === '' ? null : value);
                  }
                }}
                className="px-3 py-1.5 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-600 focus:border-blue-600"
              >
                <option value="">All</option>
                {options.map((option) => (
                  <option key={option.id} value={option.value || option.id}>
                    {option.label}
                  </option>
                ))}
              </select>
            </div>
          ))}

          {hasActiveFilters && onClearFilters && (
            <Button
              variant="outline"
              size="sm"
              onClick={onClearFilters}
              className="flex items-center gap-1"
            >
              <X className="w-4 h-4" />
              Clear Filters
            </Button>
          )}
        </div>
      )}

      {/* Active Filters Display */}
      {hasActiveFilters && (
        <div className="flex flex-wrap gap-2">
          {Object.entries(activeFilters).map(([key, value]) => {
            const filterLabel = filters[key]?.find((opt) => 
              (opt.value || opt.id) === value
            )?.label || value;
            
            return (
              <span
                key={key}
                className="inline-flex items-center gap-1 px-2 py-1 bg-blue-100 text-blue-800 rounded-full text-xs"
              >
                {key}: {filterLabel}
                {onFilterChange && (
                  <button
                    onClick={() => onFilterChange(key, null)}
                    className="hover:bg-blue-200 rounded-full p-0.5"
                  >
                    <X className="w-3 h-3" />
                  </button>
                )}
              </span>
            );
          })}
        </div>
      )}
    </div>
  );
};

