# A DynamoDB Adapter For [lucia-auth](https://github.com/lucia-auth/lucia)

## Install

```shell
npm i lucia-adapter-dynamodb
```

## Usage

```javascript
import { DynamoDBClient } from '@aws-sdk/client-dynamodb';
import { DynamoDBAdapter } from 'lucia-adapter-dynamodb';

const client = new DynamoDBClient({
  credentials: {
    accessKeyId: 'xxx',
    secretAccessKey: 'verysecret',
  },
  region: 'xx-xx-#',
});

const adapterWithTwoGSIs = new DynamoDBAdapter(client, {
  // options
});

// or
const adapterWithOneGSI = new DynamoDBAdapter(client, {
  gsiName: 'YourGSIName',
  // other options
});

// pass the adapter to lucia
```

## DynamoDB Table Schemas

The adapter works with a single DynamoDB table and supports two possible table schemas. No matter which schema is used, you always have total flexibility to integrate it with your existing table design, e.g., add other custom attributes, reuse the key attributes for other items, use different names for the key attributes, and reuse the GSIs for custom purposes.

The bare minimum requirement is that the partition keys and sort keys of the base table and all GSIs must be existent and belong to the "S" type.

### With Two GSIs (Default)

| *(Item Type)* | PK             | SK                   | GSI1PK               | GSI1SK               | GSI2PK          | GSI2SK            |
| ------------- | -------------- | -------------------- | -------------------- | -------------------- | --------------- | ----------------- |
| *User*        | USER#[User ID] | USER#[User ID]       |                      |                      |                 |                   |
| *Session*     | USER#[User ID] | SESSION#[Session ID] | SESSION#[Session ID] | SESSION#[Session ID] | SESSION_EXPIRES | [ISO time string] |

### With One GSI

| *(Item Type)* | PK             | SK                   | GSIPK   | GSISK                | ExpiresAt (*Non-Key Attribute*) |
| ------------- | -------------- | -------------------- | ------- | -------------------- | ------------------------------- |
| *User*        | USER#[User ID] | USER#[User ID]       |         |                      |                                 |
| *Session*     | USER#[User ID] | SESSION#[Session ID] | SESSION | SESSION#[Session ID] | [ISO time string]               |

### Table Creation Example

Here is an example of creating such a table with [`@aws-sdk/client-dynamodb`](https://docs.aws.amazon.com/AWSJavaScriptSDK/v3/latest/client/dynamodb/):

```typescript
const client = new DynamoDBClient({
  // DynamoDB configs
});

// with two GSIs
await client
  .send(new CreateTableCommand({
    TableName: 'LuciaAuthTableWithTwoGSIs',
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
  }));

// or, with one GSI
await client
  .send(new CreateTableCommand({
    TableName: 'LuciaAuthTableWithOneGSI',
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
  }));
```

## Constructor Options

The adapter constructor takes a `DynamoDBClient` instance from `@aws-sdk/client-dynamodb` as the first argument. A configuration object can be passed as the second argument.

```typescript
class DynamoDBAdapter {
  constructor(client: DynamoDBClient, options?: DynamoDBAdapterOptions);
}
```

The configuration object can be specified as follows:

### With 2 GSIs

| Option Object Attribute | Type     | Default Value  | Usage                                                        |
| ----------------------- | -------- | -------------- | ------------------------------------------------------------ |
| tableName               | string   | LuciaAuthTable | DynamoDB table name                                          |
| pk                      | string   | PK             | Base table partition key name                                |
| sk                      | string   | SK             | Base table sort key name                                     |
| gsi1Name                | string   | GSI1           | Index name of the first GSI                                  |
| gsi1pk                  | string   | GSI1PK         | First GSI partition key name                                 |
| gsi1sk                  | string   | GSI1SK         | First GSI sort key name                                      |
| gsi2Name                | string   | GSI2           | Index name of the second GSI                                 |
| gsi2pk                  | string   | GSI2PK         | Second GSI partition key name                                |
| gsi2sk                  | string   | GSI2SK         | Second GSI sort key name                                     |
| extraUserAttributes     | string[] | []             | Names of non-key attributes in the DynamoDB table to be excluded from DatabaseUser objects |
| extraSessionAttributes  | string[] | []             | Names of non-key attributes in the DynamoDB table to be excluded from DatabaseSession objects |

### With 1 GSI

| Option Object Attribute | Type     | Default Value  | Usage                                                        |
| ----------------------- | -------- | -------------- | ------------------------------------------------------------ |
| tableName               | string   | LuciaAuthTable | DynamoDB table name                                          |
| pk                      | string   | PK             | Base table partition key name                                |
| sk                      | string   | SK             | Base table sort key name                                     |
| **gsiName**             | string   | GSI            | Index name of the GSI (**Explicitly set it to a non-empty string to use the one-GSI mode**) |
| gsipk                   | string   | GSIPK          | GSI partition key name                                       |
| gsisk                   | string   | GSISK          | GSI sort key name                                            |
| expiresAt               | string   | ExpiresAt      | Name of the DynamoDB table attribute to store session expirations |
| extraUserAttributes     | string[] | []             | Names of non-key attributes in the DynamoDB table to be excluded from DatabaseUser objects |
| extraSessionAttributes  | string[] | []             | Names of non-key attributes in the DynamoDB table to be excluded from DatabaseSession objects |
