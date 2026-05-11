import { QueryClient } from '@tanstack/react-query';
import { ApiError } from './api';

export const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 30 * 1000,        // 30s — most lists feel "fresh" for this long
      gcTime:    5 * 60 * 1000,    // 5 min
      retry: (failureCount, error) => {
        if (error instanceof ApiError) {
          // Don't retry auth or client errors.
          if (error.status === 401 || error.status === 403 || error.status === 404) return false;
          if (error.status >= 400 && error.status < 500) return false;
        }
        return failureCount < 2;
      },
      refetchOnWindowFocus: false, // RN doesn't use window focus anyway
    },
    mutations: {
      retry: 0,
    },
  },
});
