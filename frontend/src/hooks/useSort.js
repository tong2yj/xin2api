import { useCallback, useMemo, useState } from 'react';

/**
 * 排序 Hook
 */
export function useSort(data, defaultField = null, defaultOrder = 'asc') {
  const [sortField, setSortField] = useState(defaultField);
  const [sortOrder, setSortOrder] = useState(defaultOrder);

  const sortedData = useMemo(() => {
    if (!sortField) return data;

    return [...data].sort((a, b) => {
      const aVal = a[sortField];
      const bVal = b[sortField];

      // 处理 null/undefined
      if (aVal == null && bVal == null) return 0;
      if (aVal == null) return sortOrder === 'asc' ? 1 : -1;
      if (bVal == null) return sortOrder === 'asc' ? -1 : 1;

      // 数字比较
      if (typeof aVal === 'number' && typeof bVal === 'number') {
        return sortOrder === 'asc' ? aVal - bVal : bVal - aVal;
      }

      // 日期比较
      if (aVal instanceof Date && bVal instanceof Date) {
        return sortOrder === 'asc'
          ? aVal.getTime() - bVal.getTime()
          : bVal.getTime() - aVal.getTime();
      }

      // 字符串比较
      const aStr = String(aVal).toLowerCase();
      const bStr = String(bVal).toLowerCase();
      if (sortOrder === 'asc') {
        return aStr.localeCompare(bStr);
      }
      return bStr.localeCompare(aStr);
    });
  }, [data, sortField, sortOrder]);

  const handleSort = useCallback(
    (field) => {
      if (sortField === field) {
        setSortOrder((prev) => (prev === 'asc' ? 'desc' : 'asc'));
      } else {
        setSortField(field);
        setSortOrder('asc');
      }
    },
    [sortField]
  );

  const resetSort = useCallback(() => {
    setSortField(defaultField);
    setSortOrder(defaultOrder);
  }, [defaultField, defaultOrder]);

  return {
    sortedData,
    sortField,
    sortOrder,
    handleSort,
    resetSort,
  };
}

export default useSort;
