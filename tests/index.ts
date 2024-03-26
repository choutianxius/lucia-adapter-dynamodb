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

const TableName1 = 'LuciaAuthTable1';
const TableName2 = 'LuciaAuthTable2';

let client: DynamoDBClient;

await new Promise<void>((resolve) => {
  console.log('Wait for 5 seconds so that db can be ready...')
  // wait for 5 seconds so that db can be ready
  setTimeout(() => {
    client = new DynamoDBClient({
      credentials: {
        accessKeyId: 'dummy',
        secretAccessKey: 'dummy',
      },
      region: 'dummy',
      endpoint: process.env.DYNAMODB_ENDPOINT_URL ?? 'http://127.0.0.1:8000',
    });
    resolve();
  }, 5000);
})
  .then(() => prepareTable1(client))
  .then((adapter) => testAdapter(adapter))
  .then(() => { console.log('  \x1B[32m✓ Test for configuration with 1 GSI passed\x1B[0m\n'); })
  .catch((e) => {
    console.error('  \x1B[31m✗ Test for configuration with 1 GSI failed\x1B[0m\n');
    throw e;
  })
  .then(() => prepareTable2(client))
  .then((adapter) => testAdapter(adapter))
  .then(() => { console.log('  \x1B[32m✓ Test for configuration with 2 GSIs passed\x1B[0m\n'); })
  .catch((e) => {
    console.error('  \x1B[31m✗ Test for configuration with 2 GSIs failed\x1B[0m\n');
    throw e;
  });

async function prepareTable1(client: DynamoDBClient) {
  console.log('\n\x1B[38;5;63;1m[prepare]  \x1B[0mPreparing local DynamoDB table for configuration with 1 GSI\x1B[0m\n');
  // create table if not exists
  await client.send(new DescribeTableCommand({ TableName: TableName1 }))
    .then(() => console.log('Detected existing auth table with 1 GSI!'))
    .catch(async (e) => {
      if (e instanceof ResourceNotFoundException) {
        console.log('Wait for table creation to complete...');
        return await client
          .send(new CreateTableCommand({
            TableName: TableName1,
            AttributeDefinitions: [
              { AttributeName: 'PK', AttributeType: 'S' },
              { AttributeName: 'SK', AttributeType: 'S' },
              { AttributeName: 'GSIPK', AttributeType: 'S' },
              { AttributeName: 'GSISK', AttributeType: 'S' },
            ],
            KeySchema: [
              { AttributeName: 'PK', KeyType: 'HASH' }, // primary key
              { AttributeName: 'SK', KeyType: 'RANGE' }, // sort key
            ],
            GlobalSecondaryIndexes: [
              {
                IndexName: 'GSI',
                Projection: { ProjectionType: 'ALL' },
                KeySchema: [
                  { AttributeName: 'GSIPK', KeyType: 'HASH' }, // GSI primary key
                  { AttributeName: 'GSISK', KeyType: 'RANGE' }, // GSI sort key
                ],
                ProvisionedThroughput: {
                  ReadCapacityUnits: 5,
                  WriteCapacityUnits: 5,
                },
              },
            ],
            ProvisionedThroughput: {
              ReadCapacityUnits: 5,
              WriteCapacityUnits: 5,
            },
          }))
          .then(() => new Promise((resolve) => {
            setTimeout(() => resolve(
              console.log('Successfully created auth table with 1 GSI!')
            ), 3000); // wait for table creation completion
          }));
      }
      else throw e;
    })
    .then(async () => {
      console.log('Preparing test user...');
      // prepare the test user
      await client.send(new PutItemCommand({
        TableName: TableName1,
        Item: marshall({
          PK: `USER#${databaseUser.id}`,
          SK: `USER#${databaseUser.id}`,
          HashedPassword: '123456',
          ...databaseUser.attributes
        }),
      }));
    }).then(() => {
      console.log('Successfully created test user!');
    });

  return new DynamoDBAdapter(client, {
    tableName: TableName1,
    gsiName: 'GSI',
    extraUserAttributes: ['HashedPassword'],
  });
}

async function prepareTable2(client: DynamoDBClient) {
  console.log('\n\x1B[38;5;63;1m[prepare]  \x1B[0mPreparing local DynamoDB table for configuration with 2 GSIs\x1B[0m\n');
  // create table if not exists
  await client.send(new DescribeTableCommand({ TableName: TableName2 }))
    .then(() => console.log('Detected existing auth table with 2 GSIs!'))
    .catch(async (e) => {
      if (e instanceof ResourceNotFoundException) {
        console.log('Wait for table creation to complete...');
        return await client
          .send(new CreateTableCommand({
            TableName: TableName2,
            AttributeDefinitions: [
              { AttributeName: 'PK', AttributeType: 'S' },
              { AttributeName: 'SK', AttributeType: 'S' },
              { AttributeName: 'GSI1PK', AttributeType: 'S' },
              { AttributeName: 'GSI1SK', AttributeType: 'S' },
              { AttributeName: 'GSI2PK', AttributeType: 'S' },
              { AttributeName: 'GSI2SK', AttributeType: 'S' },
            ],
            KeySchema: [
              { AttributeName: 'PK', KeyType: 'HASH' }, // primary key
              { AttributeName: 'SK', KeyType: 'RANGE' }, // sort key
            ],
            GlobalSecondaryIndexes: [
              {
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
              },
              {
                IndexName: 'GSI2',
                Projection: { ProjectionType: 'ALL' },
                KeySchema: [
                  { AttributeName: 'GSI2PK', KeyType: 'HASH' }, // GSI primary key
                  { AttributeName: 'GSI2SK', KeyType: 'RANGE' }, // GSI sort key
                ],
                ProvisionedThroughput: {
                  ReadCapacityUnits: 5,
                  WriteCapacityUnits: 5,
                },
              },
            ],
            ProvisionedThroughput: {
              ReadCapacityUnits: 5,
              WriteCapacityUnits: 5,
            },
          }))
          .then(() => new Promise((resolve) => {
            setTimeout(() => resolve(
              console.log('Successfully created auth table with 2 GSIs!')
            ), 3000); // wait for table creation completion
          }));
      }
      else throw e;
    })
    .then(async () => {
      console.log('Preparing test user...');
      // prepare the test user
      await client.send(new PutItemCommand({
        TableName: TableName2,
        Item: marshall({
          PK: `USER#${databaseUser.id}`,
          SK: `USER#${databaseUser.id}`,
          HashedPassword: '123456',
          ...databaseUser.attributes
        }),
      }));
    }).then(() => {
      console.log('Successfully created test user!');
    });

  return new DynamoDBAdapter(client, {
    tableName: TableName2,
    extraUserAttributes: ['HashedPassword'],
  });
}
