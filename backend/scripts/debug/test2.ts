import { getAllKbTags } from '../src/admin/admin-db.ts';

try {
  console.log('Testing getAllKbTags...');
  const tags = getAllKbTags();
  console.log('Result:', tags);
} catch (e) {
  console.error('CRASH:', e);
}
