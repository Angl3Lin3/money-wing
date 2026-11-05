// MoneyWing design tokens: the official brand palette (blue #004C97,
// orange #FC4C02, gold #FFC72C), matching the website.
// Use these instead of typing colors and sizes into each screen.

export const colors = {
  primary: '#FC4C02',        // orange: main buttons, active states
  primaryPressed: '#D94102',
  primarySoft: '#FFF1EA',
  secondary: '#004C97',      // blue: header, accents
  secondarySoft: '#E8F1FB',
  focus: '#5b9bd5',          // light blue input focus border
  accent: '#FFC72C',         // gold accent

  background: '#f3f3f3',
  surface: '#ffffff',
  border: '#e2e2e2',

  text: '#000000',
  textSecondary: '#2c2c2c',
  textMuted: '#777777',
  onPrimary: '#ffffff',

  dev: '#1F2937',            // dark header for the developer area

  success: '#15803d',
  successSoft: '#dcfce7',
  warning: '#92400e',
  warningSoft: '#fef3c7',
  danger: '#b91c1c',
  dangerSoft: '#fee2e2',
};

// Brand font is Calibri. Calibri can't be bundled into an app, so we use
// Carlito: a free font made to match Calibri's shapes and sizes.
// Carlito comes in regular and bold only, so the in-between weights map to those.
export const fonts = {
  light: 'Carlito_400Regular',
  regular: 'Carlito_400Regular',
  medium: 'Carlito_400Regular',
  semibold: 'Carlito_700Bold',
  bold: 'Carlito_700Bold',
};

// Type scale: base 16, from 10 (xs) to 33 (4xl).
export const fontSize = { xs: 10, sm: 14, base: 16, lg: 18, xl: 22, '2xl': 26, '3xl': 30, '4xl': 33 };

export const spacing = { xs: 4, sm: 8, md: 12, lg: 16, xl: 24, '2xl': 32 };

export const radius = { input: 6, button: 12, row: 16, card: 30, pill: 999 };

export const shadow = {
  shadowColor: '#000',
  shadowOpacity: 0.08,
  shadowRadius: 20,
  shadowOffset: { width: 0, height: 8 },
  elevation: 4,
};
