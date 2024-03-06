import { testAdapter } from '@lucia-auth/adapter-test';
import { DynamoDBAdapter } from '../src/index.js';
import { DynamoDBClient } from '@aws-sdk/client-dynamodb';

const client = new DynamoDBClient({});

const adapter = new DynamoDBAdapter(client);

await testAdapter(adapter);
