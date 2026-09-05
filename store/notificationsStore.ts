import { create } from 'zustand';

interface NotificationsState {
  unreadCount: number;
  unreadRoomsCount: number;
  setUnreadCount: (count: number) => void;
  setUnreadRoomsCount: (count: number) => void;
  incrementUnread: () => void;
  decrementUnread: () => void;
  reset: () => void;
}

export const useNotificationsStore = create<NotificationsState>((set) => ({
  unreadCount: 0,
  unreadRoomsCount: 0,
  setUnreadCount: (unreadCount) => set({ unreadCount }),
  setUnreadRoomsCount: (unreadRoomsCount) => set({ unreadRoomsCount }),
  incrementUnread: () => set((state) => ({ unreadCount: state.unreadCount + 1 })),
  decrementUnread: () => set((state) => ({ unreadCount: Math.max(0, state.unreadCount - 1) })),
  reset: () => set({ unreadCount: 0, unreadRoomsCount: 0 }),
}));
