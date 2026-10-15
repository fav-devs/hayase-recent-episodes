import { clsx } from 'clsx';
import { twMerge } from 'tailwind-merge';
import { readable } from 'svelte/store';
export const cn = (...inputs) => twMerge(clsx(inputs));
export const breakpoints = readable({ md: innerWidth >= 768 }, set => {
  const change = () => set({ md: innerWidth >= 768 });
  addEventListener('resize', change);
  return () => removeEventListener('resize', change);
});
