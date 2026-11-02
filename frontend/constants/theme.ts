// MoneyWing design tokens (from the project's design system).
// Use these instead of typing colors and sizes into each screen.

export const colors = {
  primary: '#fc4c01',        // orange: main buttons, active states
  primaryPressed: '#d94100',
  primarySoft: '#fff1ea',
  secondary: '#004c96',      // blue: header, accents
  secondarySoft: '#e8f1fb',
  focus: '#5b9bd5',          // light blue input focus border
  accent: '#ffc62d',         // yellow accent

  background: '#f3f3f3',
  surface: '#ffffff',
  border: '#e2e2e2',

  text: '#000000',
  textSecondary: '#2c2c2c',
  textMuted: '#777777',
  onPrimary: '#ffffff',

  success: '#15803d',
  successSoft: '#dcfce7',
  warning: '#92400e',
  warningSoft: '#fef3c7',
  danger: '#b91c1c',
  dangerSoft: '#fee2e2',
};

export const fonts = {
  light: 'Inter_300Light',
  regular: 'Inter_400Regular',
  medium: 'Inter_500Medium',
  semibold: 'Inter_600SemiBold',
  bold: 'Inter_700Bold',
};

// Type scale: base 16, from 10 (xs) to 33 (4xl).
export const fontSize = { xs: 10, sm: 13, base: 16, lg: 18, xl: 22, '2xl': 26, '3xl': 30, '4xl': 33 };

export const spacing = { xs: 4, sm: 8, md: 12, lg: 16, xl: 24, '2xl': 32 };

export const radius = { input: 6, button: 12, row: 16, card: 30, pill: 999 };

export const shadow = {
  shadowColor: '#000',
  shadowOpacity: 0.08,
  shadowRadius: 20,
  shadowOffset: { width: 0, height: 8 },
  elevation: 4,
};
