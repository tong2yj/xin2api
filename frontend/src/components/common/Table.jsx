import { ChevronDown, ChevronUp } from 'lucide-react';

/**
 * 通用表格组件
 */
export function Table({
  columns,
  data,
  sortField,
  sortOrder,
  onSort,
  loading = false,
  emptyMessage = '暂无数据',
}) {
  const handleSort = (field) => {
    if (onSort && field) {
      onSort(field);
    }
  };

  return (
    <div className="table-container rounded-xl border border-white/5 overflow-hidden bg-bg-card shadow-sm">
      <div className="overflow-x-auto">
        <table className="w-full text-left border-collapse">
          <thead>
            <tr className="border-b border-white/5 bg-white/[0.02]">
              {columns.map((col) => (
                <th
                  key={col.key}
                  className={`
                    px-6 py-4 text-xs font-medium uppercase tracking-wider text-dark-400
                    ${col.sortable ? 'cursor-pointer hover:text-primary-400 hover:bg-white/5 transition-colors select-none' : ''}
                  `}
                  onClick={() => col.sortable && handleSort(col.key)}
                >
                  <div className="flex items-center gap-1.5">
                    {col.label}
                    {col.sortable && (
                      <span className={`transition-opacity ${sortField === col.key ? 'opacity-100 text-primary-500' : 'opacity-30'}`}>
                        {sortField === col.key && sortOrder === 'desc' ? (
                          <ChevronDown size={14} />
                        ) : (
                          <ChevronUp size={14} />
                        )}
                      </span>
                    )}
                  </div>
                </th>
              ))}
            </tr>
          </thead>
          <tbody className="divide-y divide-white/5">
            {loading ? (
              <tr>
                <td colSpan={columns.length} className="px-6 py-12 text-center text-dark-400">
                  <div className="flex items-center justify-center gap-2">
                    <span className="w-2 h-2 rounded-full bg-primary-500 animate-bounce"></span>
                    <span className="w-2 h-2 rounded-full bg-primary-500 animate-bounce delay-100"></span>
                    <span className="w-2 h-2 rounded-full bg-primary-500 animate-bounce delay-200"></span>
                  </div>
                </td>
              </tr>
            ) : data.length === 0 ? (
              <tr>
                <td colSpan={columns.length} className="px-6 py-12 text-center text-dark-500">
                  {emptyMessage}
                </td>
              </tr>
            ) : (
              data.map((row, idx) => (
                <tr 
                  key={row.id || idx}
                  className="group transition-colors hover:bg-white/[0.02]"
                >
                  {columns.map((col) => (
                    <td 
                      key={col.key} 
                      className={`px-6 py-4 text-sm text-dark-300 ${col.className || ''}`}
                    >
                      {col.render ? col.render(row[col.key], row) : row[col.key]}
                    </td>
                  ))}
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}

export default Table;