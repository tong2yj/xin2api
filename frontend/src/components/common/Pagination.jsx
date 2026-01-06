/**
 * 分页组件
 */
export function Pagination({
  currentPage,
  totalPages,
  onPageChange,
  showFirstLast = true,
  className = '',
}) {
  if (totalPages <= 1) return null;

  return (
    <div className={`flex items-center justify-center gap-2 mt-4 ${className}`}>
      {showFirstLast && (
        <button
          onClick={() => onPageChange(1)}
          disabled={currentPage === 1}
          className="px-3 py-1 bg-dark-700 rounded disabled:opacity-50 disabled:cursor-not-allowed hover:bg-dark-600"
        >
          首页
        </button>
      )}
      <button
        onClick={() => onPageChange(Math.max(1, currentPage - 1))}
        disabled={currentPage === 1}
        className="px-3 py-1 bg-dark-700 rounded disabled:opacity-50 disabled:cursor-not-allowed hover:bg-dark-600"
      >
        上一页
      </button>
      <span className="px-4 py-1 text-gray-400">
        第 {currentPage} / {totalPages} 页
      </span>
      <button
        onClick={() => onPageChange(Math.min(totalPages, currentPage + 1))}
        disabled={currentPage === totalPages}
        className="px-3 py-1 bg-dark-700 rounded disabled:opacity-50 disabled:cursor-not-allowed hover:bg-dark-600"
      >
        下一页
      </button>
      {showFirstLast && (
        <button
          onClick={() => onPageChange(totalPages)}
          disabled={currentPage === totalPages}
          className="px-3 py-1 bg-dark-700 rounded disabled:opacity-50 disabled:cursor-not-allowed hover:bg-dark-600"
        >
          末页
        </button>
      )}
    </div>
  );
}

export default Pagination;
