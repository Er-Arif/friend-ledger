import { create } from 'zustand';

export type ToastType = 'success' | 'error' | 'info';

interface ToastState {
  visible: boolean;
  message: string;
  type: ToastType;
  show: (message: string, type?: ToastType) => void;
  hide: () => void;
}

let timeoutId: ReturnType<typeof setTimeout> | null = null;

export const useToastStore = create<ToastState>((set) => ({
  visible: false,
  message: '',
  type: 'info',

  show: (message: string, type: ToastType = 'info') => {
    if (timeoutId) {
      clearTimeout(timeoutId);
    }

    set({ visible: true, message, type });

    timeoutId = setTimeout(() => {
      set({ visible: false, message: '' });
      timeoutId = null;
    }, 3500);
  },

  hide: () => {
    if (timeoutId) {
      clearTimeout(timeoutId);
      timeoutId = null;
    }
    set({ visible: false, message: '' });
  },
}));
