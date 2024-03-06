import { testAdapter } from '@lucia-auth/adapter-test';
import { DynamoDBAdapter } from '../src/index.js';

const adapter = new DynamoDBAdapter;

await testAdapter(adapter);
