import { definePreset } from '@primeuix/themes';
import Aura from '@primeuix/themes/aura';

export const carnetTheme = definePreset(Aura, {
  primitive: {
    borderRadius: {
      none: '0',
      xs: '4px',
      sm: '6px',
      md: '8px',
      lg: '11px',
      xl: '14px',
    },
  },
  semantic: {
    primary: {
      50: '#f3f7f5',
      100: '#e8f0ec',
      200: '#cfdfd7',
      300: '#aac5b9',
      400: '#7fa596',
      500: '#41695a',
      600: '#385d50',
      700: '#325448',
      800: '#29443b',
      900: '#233a32',
      950: '#14231e',
    },
  },
});
