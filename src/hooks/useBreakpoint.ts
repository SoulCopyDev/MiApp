import { useWindowDimensions } from 'react-native';

type Breakpoint = 'mobile' | 'tablet' | 'desktop';

export function useBreakpoint(): Breakpoint {
  const { width } = useWindowDimensions();
  if (width >= 1024) return 'desktop';
  if (width >= 600) return 'tablet';
  return 'mobile';
}
