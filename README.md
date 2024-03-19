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

const adapter = new DynamoDBAdapter(client, {
  // options
});

// pass the adapter to lucia
```

The adapter requires a DynamoDB table with at least two global secondary indexes (GSIs) to work, and the base table key and the GSI keys should all be composite, with partition keys and sort keys belonging to the "S" type. Also, all needed attributes from the base table should be projected to both GSIs.

The schema of the table is deeply inspired by and looks like that of the DynamoDB adapter from [`Auth.js`](https://authjs.dev/reference/adapter/dynamodb):

| *(Usage)* | PK             | SK                   | GSI1PK               | GSI1SK               | GSI2PK          | GSI2SK            |
| --------- | -------------- | -------------------- | -------------------- | -------------------- | --------------- | ----------------- |
| *User*    | USER#[User ID] | USER#[User ID]       |                      |                      |                 |                   |
| *Session* | USER#[User ID] | SESSION#[Session ID] | SESSION#[Session ID] | SESSION#[Session ID] | SESSION_EXPIRES | [ISO time string] |

The schema is designed make it as easy as possible to integrate the authentication system into an existing DynamoDB table. You have total flexibility to add other custom attributes, reuse the key attributes for other types of records, change the names of key attributes, and reuse the GSIs of user records for custom purposes.

Here is an example of creating such a table with [`@aws-sdk/client-dynamodb`](https://docs.aws.amazon.com/AWSJavaScriptSDK/v3/latest/client/dynamodb/):

```typescript
const client = new DynamoDBClient({
  // options
});

await client
  .send(new CreateTableCommand({
    TableName,
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
```

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
