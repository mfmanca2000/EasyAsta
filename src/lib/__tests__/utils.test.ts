import { cn } from '../utils';

describe('utils', () => {
  describe('cn', () => {
    it('should merge class names correctly', () => {
      expect(cn('px-4', 'py-2')).toBe('px-4 py-2');
    });

    it('should handle conditional classes', () => {
      expect(cn('px-4', true && 'py-2', false && 'hidden')).toBe('px-4 py-2');
    });

    it('should handle conflicting Tailwind classes', () => {
      expect(cn('px-4', 'px-2')).toBe('px-2');
    });

    it('should handle empty inputs', () => {
      expect(cn()).toBe('');
      expect(cn('')).toBe('');
      expect(cn(null, undefined)).toBe('');
    });

    it('should handle arrays of classes', () => {
      expect(cn(['px-4', 'py-2'], 'text-center')).toBe('px-4 py-2 text-center');
    });

    it('should handle objects with boolean values', () => {
      expect(cn({
        'px-4': true,
        'py-2': true,
        'hidden': false,
      })).toBe('px-4 py-2');
    });
  });
});