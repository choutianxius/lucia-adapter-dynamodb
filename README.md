# A DynamoDB Adapter For [lucia-auth](https://github.com/lucia-auth/lucia)

## Usage

The adapter requires a DynamoDB table with a composite primary key (partition key + sort key) and at least one global secondary index to work. To make sure that the sessions contain all needed attributes, it is recommended that you project all attributes from the base table to the GSI. The schema of the table looks like that of the DynamoDB adapter from `Auth.js`.

After preparing the DynamoDB table, create an instance of `DynamoDBClient` from the `@aws-sdk/client-dynamodb` library and pass it to the adapter constructor.

```javascript
import { DynamoDBClient } from '@aws-sdk/client-dynamodb';
// make sure also import the adapter class

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

A configuration object may be passed as the second parameter of the constructor:

```typescript
options?: {
  tableName?: string; // DynamoDB table name, default: LuciaAuthTable
  pk?: string; // name of the partition key, default: pk
  sk?: string; // name of the sort key
  gsiName?: string, // name of the GSI, default: GSI1
  gsi1pk?: string; // name of the GSI partition key, default: GSI1PK
  gsi1sk?: string; // name of the GSI sort key, default: GSI1SK
  expiresAt?: string; // name of the TTL attribute
  extraUserAttributes?: string[]; // names of extra user attributes not used by lucia, default: []
  extraSessionAttributes?: string[]; // names of extra session attributes not used by lucia, default: []
}
```

Pay attention to the `extraUserAttributes` and `extraSessionAttributes` options. For example, you might be using username + password authentication, and want to also use the DynamoDB table for user management purposes, and as a result the table contains a `hashed_password` field which you want to restrict lucia from accessing. Then pass `['hashed_password]` to the `extraUserAttributes` option. Note that attributes that are indeed used by lucia should not be passed.

