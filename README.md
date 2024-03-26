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

| *(Item Type)* | PK             | SK                   | GSIPK   | GSISK                | ExpiresAt (Non-Key Attribute) |
| ------------- | -------------- | -------------------- | ------- | -------------------- | ----------------------------- |
| *User*        | USER#[User ID] | USER#[User ID]       |         |                      |                               |
| *Session*     | USER#[User ID] | SESSION#[Session ID] | SESSION | SESSION#[Session ID] | [ISO time string]             |

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

After preparing the DynamoDB table, create an instance of `DynamoDBClient` from the [`@aws-sdk/client-dynamodb`](https://docs.aws.amazon.com/AWSJavaScriptSDK/v3/latest/client/dynamodb/) library and pass it to the adapter constructor. A configuration object may be passed as the second parameter, where you can customize the adapter according to your table configurations:

```typescript
class DynamoDBAdapter {
  constructor(client: DynamoDBClient, options?: {
    tableName?: string;
    pk?: string; // base table partition key name
    sk?: string; // base tabe sort key name
    gsi1Name?: string, // name of the first gsi
    gsi1pk?: string; // partition key name of the first gsi
    gsi1sk?: string; // sort key name of the first gsi
    gsi2Name?: string, // name of the second gsi
    gsi2pk?: string; // partition key name of the second gsi
    gsi2sk?: string; // sort key name of the second gsi
    extraUserAttributes?: string[]; // extra table attributes to be excluded in DatabaseUser
    extraSessionAttributes?: string[]; // extra table attributes to be excluded in DatabaseSession
  }) {
    // ...
  };
}
```

By default, the adapter will include **ALL** existing attribute fields other than the base table/GSI keys in the `attributes` fields of the returned `DatabaseUser` and `DatabaseSession` objects, which may contain extra fields than what you want to grant Lucia access to. To exclude these extra attributes from the user and session objects seen by Lucia, pass their names to the `extraUserAttributes` and `extraSessionAttributes` options.
