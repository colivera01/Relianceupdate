// Main SDK Index - Export all SDK modules
// Favorites: canonical implementation is `favoritesSDK` (customer id + `x-user-id`); `usersSDK` mirrors list/add/remove via `api` client only.
export * from './auth';
export * from './bookings';
export * from './services';
export * from './availability';
export * from './reviews';
export * from './search';
export * from './users';
export * from './favorites';

// Re-export API client
export { api, API_BASE } from '../lib/api';

// Re-export types
export * from '../types/api';

// Repository exports
export * from '../data/employeesRepo';
export * from '../data/factory';
