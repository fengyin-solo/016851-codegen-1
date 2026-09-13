import { useState, useEffect, useCallback } from 'react';

interface Breakpoints {
  xs: number;
  sm: number;
  md: number;
  lg: number;
  xl: number;
  xxl: number;
}

const defaultBreakpoints: Breakpoints = {
  xs: 480,
  sm: 576,
  md: 768,
  lg: 992,
  xl: 1200,
  xxl: 1600,
};

interface UseResponsiveReturn {
  width: number;
  height: number;
  isMobile: boolean;
  isTablet: boolean;
  isDesktop: boolean;
  isXs: boolean;
  isSm: boolean;
  isMd: boolean;
  isLg: boolean;
  isXl: boolean;
  isXxl: boolean;
  breakpoint: keyof Breakpoints;
}

/**
 * 响应式布局 Hook
 */
export function useResponsive(breakpoints: Breakpoints = defaultBreakpoints): UseResponsiveReturn {
  const [dimensions, setDimensions] = useState({
    width: typeof window !== 'undefined' ? window.innerWidth : 1024,
    height: typeof window !== 'undefined' ? window.innerHeight : 768,
  });

  const handleResize = useCallback(() => {
    setDimensions({
      width: window.innerWidth,
      height: window.innerHeight,
    });
  }, []);

  useEffect(() => {
    handleResize();
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, [handleResize]);

  const { width, height } = dimensions;

  const isXs = width < breakpoints.xs;
  const isSm = width >= breakpoints.xs && width < breakpoints.sm;
  const isMd = width >= breakpoints.sm && width < breakpoints.md;
  const isLg = width >= breakpoints.md && width < breakpoints.lg;
  const isXl = width >= breakpoints.lg && width < breakpoints.xl;
  const isXxl = width >= breakpoints.xl;

  const isMobile = width < breakpoints.md;
  const isTablet = width >= breakpoints.md && width < breakpoints.lg;
  const isDesktop = width >= breakpoints.lg;

  const getBreakpoint = (): keyof Breakpoints => {
    if (isXs) return 'xs';
    if (isSm) return 'sm';
    if (isMd) return 'md';
    if (isLg) return 'lg';
    if (isXl) return 'xl';
    return 'xxl';
  };

  return {
    width,
    height,
    isMobile,
    isTablet,
    isDesktop,
    isXs,
    isSm,
    isMd,
    isLg,
    isXl,
    isXxl,
    breakpoint: getBreakpoint(),
  };
}
