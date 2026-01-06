import { useCallback, useState } from 'react';

/**
 * 模态框管理 Hook
 */
export function useModal(initialState = false) {
  const [isOpen, setIsOpen] = useState(initialState);
  const [data, setData] = useState(null);

  const open = useCallback((modalData = null) => {
    setData(modalData);
    setIsOpen(true);
  }, []);

  const close = useCallback(() => {
    setIsOpen(false);
    setData(null);
  }, []);

  const toggle = useCallback(() => {
    setIsOpen((prev) => !prev);
  }, []);

  return {
    isOpen,
    data,
    open,
    close,
    toggle,
  };
}

/**
 * 确认框 Hook
 */
export function useConfirm() {
  const [state, setState] = useState({
    isOpen: false,
    title: '',
    message: '',
    onConfirm: null,
    danger: false,
  });

  const confirm = useCallback(({ title, message, onConfirm, danger = false }) => {
    setState({
      isOpen: true,
      title,
      message,
      onConfirm,
      danger,
    });
  }, []);

  const close = useCallback(() => {
    setState((prev) => ({ ...prev, isOpen: false }));
  }, []);

  const handleConfirm = useCallback(() => {
    if (state.onConfirm) {
      state.onConfirm();
    }
    close();
  }, [state.onConfirm, close]);

  return {
    ...state,
    confirm,
    close,
    handleConfirm,
  };
}

export default useModal;
