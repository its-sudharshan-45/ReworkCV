export const AUTH_ROUTES = {
  login: '/login',
  signup: '/signup',
  forgotPassword: '/forgot-password',
  resetPassword: '/reset-password',
  dashboard: '/analysis',
  profile: '/analysis',
} as const;

export const PROTECTED_ROUTE_PREFIXES = [
  '/analysis',
  '/resume',
] as const;

export const PUBLIC_AUTH_ROUTES = [AUTH_ROUTES.login, AUTH_ROUTES.signup] as const;
