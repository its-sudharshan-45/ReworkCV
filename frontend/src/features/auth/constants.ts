export const AUTH_ROUTES = {
  login: '/login',
  signup: '/signup',
  dashboard: '/analysis',
  profile: '/settings',
} as const;

export const PROTECTED_ROUTE_PREFIXES = [
  '/analysis',
  '/history',
  '/cover-letters',
  '/settings',
] as const;

export const PUBLIC_AUTH_ROUTES = [AUTH_ROUTES.login, AUTH_ROUTES.signup] as const;
