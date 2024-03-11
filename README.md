# A DynamoDB Adapter For [lucia-auth](https://github.com/lucia-auth/lucia)

## Install

```shell
npm install lucia-auth-dynamodb
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

The adapter requires a DynamoDB table with a composite primary key (partition key + sort key) and at least one global secondary index to work. It is recommended that you project all attributes from the base table to the GSI to make sure that the sessions contain all needed attributes.

The schema of the table is deeply inspired by and looks like that of the DynamoDB adapter from [`Auth.js`](https://authjs.dev/reference/adapter/dynamodb). An example of creating such a table with [`@aws-sdk/client-dynamodb`](https://docs.aws.amazon.com/AWSJavaScriptSDK/v3/latest/client/dynamodb/):

```typescript
const client = new DynamoDBClient({
  // options
});

await client
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
  }));
```

After preparing the DynamoDB table, create an instance of `DynamoDBClient` from the [`@aws-sdk/client-dynamodb`](https://docs.aws.amazon.com/AWSJavaScriptSDK/v3/latest/client/dynamodb/) library and pass it to the adapter constructor. A configuration object may be passed as the second parameter:

```typescript
constructor(client: DynamoDBClient, options?: {
    tableName?: string;
    pk?: string;
    sk?: string;
    gsiName?: string;
    gsi1pk?: string;
    gsi1sk?: string;
    expiresAt?: string;
    extraUserAttributes?: string[];
    extraSessionAttributes?: string[];
});
```

Pay attention to the `extraUserAttributes` and `extraSessionAttributes` options. For example, you might be using username + password authentication, and want to also use the DynamoDB table for user management purposes, which leads to the result that the table contains a `hashed_password` field which you want to restrict lucia from accessing. Then, you can pass `['hashed_password]` to the `extraUserAttributes` option. Note that attributes that are indeed used by lucia should not be passed.

