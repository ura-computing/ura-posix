import { useState } from "react";
import { INITIAL_USERS, User } from "../data";

interface DynamicTableProps {
  data: Record<string, any>[];
}

export function DynamicTable({ data }: DynamicTableProps) {
  const [users] = useState<Record<string, any>[]>(data);

  // Extract all unique keys from the data
  const getAllKeys = (items: Record<string, any>[]): string[] => {
    if (items.length === 0) return [];
    
    const allKeys = new Set<string>();
    items.forEach(item => {
      Object.keys(item).forEach(key => allKeys.add(key));
    });
    
    return Array.from(allKeys);
  };

  const headers = getAllKeys(users);

  // Format header for display
  const formatHeader = (key: string): string => {
    // Convert camelCase to Title Case
    return key
      .replace(/([A-Z])/g, ' $1')
      .replace(/^./, (str) => str.toUpperCase())
      .trim();
  };

  // Format cell value for display
  const formatCellValue = (value: any): string => {
    if (value === null || value === undefined) return '';
    if (typeof value === 'boolean') return value ? 'Yes' : 'No';
    if (typeof value === 'object') return JSON.stringify(value);
    return String(value);
  };

  if (users.length === 0) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center py-12 px-4">
        <div className="text-center text-gray-500">
          <p className="text-lg">No data available</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50 flex items-start justify-center py-12 px-4">
      <div className="w-full max-w-6xl">
        {/* Table Info
        <div className="mb-6 text-center">
          <h1 className="text-2xl font-bold text-gray-800 mb-2">Dynamic Data Table</h1>
          <p className="text-gray-600">
            Showing {users.length} rows with {headers.length} columns
          </p>
        </div> */}

        {/* Table */}
        <div className="bg-white rounded-2xl shadow-sm overflow-hidden border border-gray-100">
          <div className="overflow-x-auto">
            <table className="w-full text-sm text-gray-700">
              <thead>
                <tr>
                  {headers.map((header, index) => (
                    <th
                      key={header}
                      className={`bg-[#c4a8e8] text-gray-900 font-bold px-6 py-4 text-left ${
                        index === 0 ? 'first:rounded-tl-2xl' : ''
                      } ${
                        index === headers.length - 1 ? 'last:rounded-tr-2xl' : ''
                      }`}
                    >
                      {formatHeader(header)}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {users.map((row, rowIndex) => (
                  <tr
                    key={rowIndex}
                    className={`border-t border-gray-100 ${
                      rowIndex % 2 === 0 ? "bg-white" : "bg-gray-50/50"
                    } hover:bg-purple-50/40 transition-colors`}
                  >
                    {headers.map((header) => (
                      <td key={header} className="px-6 py-4">
                        <div className="truncate" title={formatCellValue(row[header])}>
                          {formatCellValue(row[header])}
                        </div>
                      </td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>

        {/* Data Summary */}
        {/* <div className="mt-6 bg-white rounded-lg border border-gray-200 p-4">
          <h3 className="text-sm font-semibold text-gray-700 mb-2">Data Structure:</h3>
          <div className="flex flex-wrap gap-2">
            {headers.map(header => (
              <span
                key={header}
                className="px-2 py-1 bg-purple-100 text-purple-700 text-xs rounded-md"
              >
                {header}
              </span>
            ))}
          </div>
        </div> */}
      </div>
    </div>
  );
}
