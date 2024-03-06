import { testAdapter, databaseUser } from '@lucia-auth/adapter-test';
import { DynamoDBAdapter } from '../src/index.js';
import { DynamoDBClient, PutItemCommand } from '@aws-sdk/client-dynamodb';
import { marshall } from '@aws-sdk/util-dynamodb';
import 'dotenv/config';

const client = new DynamoDBClient({
  credentials: {
    accessKeyId: process.env.AWS_ACCESS_KEY_ID as string,
    secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY as string,
  },
  region: process.env.AWS_REGION as string,
});

const adapter = new DynamoDBAdapter(client, {
  tableName: process.env.AWS_DYNAMODB_TABLE_NAME as string,
});

// prepare the test user
await client.send(new PutItemCommand({
  TableName: process.env.AWS_DYNAMODB_TABLE_NAME as string,
  Item: marshall({
    pk: `USER#${databaseUser.id}`,
    sk: `USER#${databaseUser.id}`,
    GSI1PK : `USER#${databaseUser.id}`,
    GSI1SK: `USER#${databaseUser.id}`,
    ...databaseUser.attributes
  }),
}));

await testAdapter(adapter);
