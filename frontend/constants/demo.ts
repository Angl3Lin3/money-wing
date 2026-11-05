// While MoneyWing isn't live, the app shows that it's a demo and that the
// rate is a sample. When it really launches, set EXPO_PUBLIC_DEMO_MODE=false
// in frontend/.env (or flip the default below) and the demo labels disappear.
export const IS_DEMO = process.env.EXPO_PUBLIC_DEMO_MODE !== 'false';

export const DEMO_MESSAGE = 'Demo version: no real money is sent';
