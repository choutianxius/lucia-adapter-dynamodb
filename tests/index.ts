import { testAdapter, databaseUser } from '@lucia-auth/adapter-test';
import { DynamoDBAdapter } from '../src/index.js';
import {
  CreateTableCommand,
  DescribeTableCommand,
  DynamoDBClient,
  PutItemCommand,
  ResourceNotFoundException,
} from '@aws-sdk/client-dynamodb';
import { marshall } from '@aws-sdk/util-dynamodb';

const TableName = 'LuciaAuthTable';

const client = new DynamoDBClient({
  credentials: {
    accessKeyId: 'dummy',
    secretAccessKey: 'dummy',
  },
  region: 'dummy',
  endpoint: process.env.DYNAMODB_ENDPOINT_URL ?? 'http://127.0.0.1:8000',
});

const adapter = new DynamoDBAdapter(client, {
  tableName: TableName,
});

await prepareDB(client).then(() => testAdapter(adapter)); 


async function prepareDB(client: DynamoDBClient) {
  console.log('\n\x1B[38;5;63;1m[prepare]  \x1B[0mPreparing local DynamoDB table\x1B[0m\n');
  // create table if not exists
  await client.send(new DescribeTableCommand({ TableName }))
    .then(() => console.log('Detected existing auth table!'))
    .catch(async (e) => {
      if (e instanceof ResourceNotFoundException) {
        return await client
          .send(new CreateTableCommand({
            TableName,
            AttributeDefinitions: [
              { AttributeName: 'pk', AttributeType: 'S' },
              { AttributeName: 'sk', AttributeType: 'S' },
              { AttributeName: 'GSI1PK', AttributeType: 'S' },
              { AttributeName: 'GSI1SK', AttributeType: 'S' },
            ],
            KeySchema: [
              { AttributeName: 'pk', KeyType: 'HASH' }, // primary key
              { AttributeName: 'sk', KeyType: 'RANGE' }, // sort key
            ],
            GlobalSecondaryIndexes: [{
              IndexName: 'GSI1',
              Projection: { ProjectionType: 'ALL' },
              KeySchema: [
                { AttributeName: 'GSI1PK', KeyType: 'HASH' }, // GSI primary key
                { AttributeName: 'GSI1SK', KeyType: 'RANGE' }, // GSI sort key
              ],
              ProvisionedThroughput: {
                ReadCapacityUnits: 5,
                WriteCapacityUnits: 5,
              },
            }],
            ProvisionedThroughput: {
              ReadCapacityUnits: 5,
              WriteCapacityUnits: 5,
            },
          }))
          .then(() => new Promise((resolve) => {
            console.log('Wait for table creation to complete...');
            setTimeout(() => resolve(
              console.log('Successfully created auth table!')
            ), 3000); // wait for table creation completion
          }));
      }
      else throw e;
    })
    .then(async () => {
      console.log('Preparing test user...');
      // prepare the test user
      await client.send(new PutItemCommand({
        TableName,
        Item: marshall({
          pk: `USER#${databaseUser.id}`,
          sk: `USER#${databaseUser.id}`,
          GSI1PK : `USER#${databaseUser.id}`,
          GSI1SK: `USER#${databaseUser.id}`,
          ...databaseUser.attributes
        }),
      }));
    }).then(() => {
      console.log('Successfully created test user!');
    });
}
