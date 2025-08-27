import { getConnectionPoolStatus, validateOptimization } from './apps/server/src/db/index.ts';

console.log('Testing connection pool status...');
const poolStatus = await getConnectionPoolStatus();
console.log('Pool status:', poolStatus);
console.log('Types:', {
  active_connections: typeof poolStatus.active_connections,
  max_connections: typeof poolStatus.max_connections,
  uptime: typeof poolStatus.uptime,
  queries_executed: typeof poolStatus.queries_executed,
});

console.log('\nTesting PRAGMA validation...');
const settings = await validateOptimization();
console.log('PRAGMA settings:', settings);
console.log('Types:', {
  journal_mode: typeof settings.journal_mode,
  synchronous: typeof settings.synchronous,
  cache_size: typeof settings.cache_size,
  temp_store: typeof settings.temp_store,
  foreign_keys: typeof settings.foreign_keys,
});