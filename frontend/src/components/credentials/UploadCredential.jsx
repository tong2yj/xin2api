import { RefreshCw, Upload } from 'lucide-react';
import { useState } from 'react';

/**
 * 凭证上传组件
 */
export function UploadCredential({
  onUpload,
  uploading = false,
  forceDonate = false,
}) {
  const [files, setFiles] = useState([]);
  const [isPublic, setIsPublic] = useState(true);
  const [dragOver, setDragOver] = useState(false);

  const handleDrop = (e) => {
    e.preventDefault();
    setDragOver(false);
    const droppedFiles = Array.from(e.dataTransfer.files).filter(
      (f) => f.name.endsWith('.json') || f.name.endsWith('.zip')
    );
    if (droppedFiles.length > 0) {
      setFiles((prev) => [...prev, ...droppedFiles]);
    }
  };

  const handleFileChange = (e) => {
    setFiles((prev) => [...prev, ...Array.from(e.target.files)]);
  };

  const handleUpload = async () => {
    if (files.length === 0) return;
    const formData = new FormData();
    files.forEach((file) => formData.append('files', file));
    formData.append('is_public', forceDonate ? true : isPublic);

    const success = await onUpload(formData);
    if (success) {
      setFiles([]);
      // 清空文件选择
      const input = document.getElementById('cred-file-input');
      if (input) input.value = '';
    }
  };

  const clearFiles = () => {
    setFiles([]);
    const input = document.getElementById('cred-file-input');
    if (input) input.value = '';
  };

  return (
    <div className="card p-6">
      <h2 className="text-lg font-semibold mb-4 flex items-center gap-2">
        <Upload className="text-green-400" />
        上传凭证
      </h2>

      <div className="space-y-4">
        {/* 拖拽区域 */}
        <div
          className={`border-2 border-dashed rounded-lg p-6 text-center transition-colors ${
            dragOver
              ? 'border-purple-500 bg-purple-500/10'
              : 'border-dark-600 hover:border-purple-500'
          }`}
          onDragOver={(e) => {
            e.preventDefault();
            setDragOver(true);
          }}
          onDragLeave={() => setDragOver(false)}
          onDrop={handleDrop}
        >
          <input
            type="file"
            accept=".json,.zip"
            multiple
            onChange={handleFileChange}
            className="hidden"
            id="cred-file-input"
          />
          <label htmlFor="cred-file-input" className="cursor-pointer block">
            <Upload size={32} className="mx-auto mb-3 text-gray-400" />
            <div className="text-gray-300 mb-1">
              {files.length > 0
                ? `已选择 ${files.length} 个文件`
                : '点击或拖拽 JSON/ZIP 文件'}
            </div>
            <div className="text-xs text-gray-500">
              支持多选和ZIP压缩包，JSON需包含 refresh_token 字段
            </div>
          </label>
        </div>

        {/* 已选文件列表 */}
        {files.length > 0 && (
          <div className="bg-dark-800 rounded-lg p-3 space-y-2">
            <div className="text-xs text-gray-400 mb-2">已选择的文件：</div>
            {files.map((file, idx) => (
              <div
                key={idx}
                className="flex items-center justify-between text-sm bg-dark-700 rounded px-3 py-2"
              >
                <span className="truncate">{file.name}</span>
                <button
                  onClick={() =>
                    setFiles((prev) => prev.filter((_, i) => i !== idx))
                  }
                  className="text-red-400 hover:text-red-300 ml-2"
                >
                  ✕
                </button>
              </div>
            ))}
            <button
              onClick={clearFiles}
              className="text-xs text-gray-500 hover:text-gray-400"
            >
              清空全部
            </button>
          </div>
        )}

        {/* 操作按钮 */}
        <div className="flex items-center justify-between">
          {/* 捐赠选项 */}
          {!forceDonate && (
            <label className="flex items-center gap-3 cursor-pointer p-3 bg-purple-500/10 border border-purple-500/30 rounded-lg hover:bg-purple-500/20 transition-colors">
              <input
                type="checkbox"
                checked={isPublic}
                onChange={(e) => setIsPublic(e.target.checked)}
                className="w-5 h-5 rounded"
              />
              <div>
                <div className="text-purple-400 font-medium flex items-center gap-2">
                  上传到公共池
                </div>
                <div className="text-xs text-purple-300/70">
                  上传后可使用所有公共凭证
                </div>
              </div>
            </label>
          )}

          <button
            onClick={handleUpload}
            disabled={uploading || files.length === 0}
            className={`px-6 py-3 bg-green-600 hover:bg-green-700 disabled:opacity-50 text-white rounded-lg flex items-center gap-2 font-medium ${
              forceDonate ? 'ml-auto' : ''
            }`}
          >
            {uploading ? (
              <RefreshCw className="animate-spin" size={18} />
            ) : (
              <Upload size={18} />
            )}
            {uploading ? '上传中...' : '上传凭证'}
          </button>
        </div>
      </div>
    </div>
  );
}

export default UploadCredential;
