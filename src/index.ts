import {
  BatchWriteItemCommand,
  DeleteItemCommand,
  GetItemCommand,
  PutItemCommand,
  QueryCommand,
  UpdateItemCommand,
  type AttributeValue,
  type DynamoDBClient,
  type QueryCommandInput,
} from '@aws-sdk/client-dynamodb';
import {
  marshall,
  unmarshall
} from '@aws-sdk/util-dynamodb';
import type {
  Adapter,
  DatabaseSession,
  DatabaseUser,
} from 'lucia';

type DynamoDBAdapterOptions = {
  tableName?: string;
  pk?: string;
  sk?: string;
  gsiName?: string;
  gsipk?: string;
  gsisk?: string;
  expiresAt?: string;
  gsi1Name?: string,
  gsi1pk?: string;
  gsi1sk?: string;
  gsi2Name?: string,
  gsi2pk?: string;
  gsi2sk?: string;
  extraUserAttributes?: string[];
  extraSessionAttributes?: string[];
};

export class DynamoDBAdapter implements Adapter {
  private instance: DynamoDBAdapter1 | DynamoDBAdapter2;
  constructor(client: DynamoDBClient, options?: DynamoDBAdapterOptions) {
    if (options?.gsiName) {
      if (
        options?.gsi1Name
        || options?.gsi1pk
        || options?.gsi1sk
        || options?.gsi2Name
        || options?.gsi2pk
        || options?.gsi2sk
      ) {
        throw new Error('Invalid options: Configurations for GSI1 or GSI2 should not appear when GSI is specified');
      } else {
        this.instance = new DynamoDBAdapter1(client, options);
      }
    } else {
      if (
        options?.gsiName
        || options?.gsipk
        || options?.gsisk
        || options?.expiresAt
      ) {
        throw new Error('Invalid options: Configurations for GSI1 or GSI2 should not appear when GSI is specified');
      } else {
        this.instance = new DynamoDBAdapter2(client, options);
      }
    }
  }

  public async deleteSession(sessionId: string): Promise<void> {
    await this.instance.deleteSession(sessionId);
  }

  public async deleteUserSessions(userId: string): Promise<void> {
    await this.instance.deleteUserSessions(userId);
  }

  public async getSessionAndUser(sessionId: string): Promise<[session: DatabaseSession | null, user: DatabaseUser | null]> {
    return await this.instance.getSessionAndUser(sessionId);
  }

  public async getUserSessions(userId: string): Promise<DatabaseSession[]> {
    return await this.instance.getUserSessions(userId);
  }

  public async setSession(session: DatabaseSession): Promise<void> {
    await this.instance.setSession(session);
  }

  public async updateSessionExpiration(sessionId: string, expiresAt: Date): Promise<void> {
    await this.instance.updateSessionExpiration(sessionId, expiresAt);
  }

  public async deleteExpiredSessions(): Promise<void> {
    await this.instance.deleteExpiredSessions();
  }
}

/**
 * Adapter using a single GSI
 */
class DynamoDBAdapter1 implements Adapter {
  private client: DynamoDBClient;
  private tableName: string = 'LuciaAuthTable';
  private pk: string = 'PK';
  private sk: string = 'SK';
  private gsiName: string = 'GSI';
  private gsipk: string = 'GSIPK';
  private gsisk: string = 'GSISK';
  private expiresAt: string = 'ExpiresAt';
  private extraUserAttributes: string[] = [];
  private extraSessionAttributes: string[] = [];

  constructor(client: DynamoDBClient, options?: DynamoDBAdapterOptions) {
    this.client = client;
    if (options?.tableName) this.tableName = options.tableName;
    if (options?.pk) this.pk = options.pk;
    if (options?.sk) this.sk = options.sk;
    if (options?.gsiName) this.gsiName = options.gsiName;
    if (options?.gsipk) this.gsipk = options.gsipk;
    if (options?.gsisk) this.gsisk = options.gsisk;
    if (options?.expiresAt) this.expiresAt = options.expiresAt;

    if (options?.extraUserAttributes) {
      this.extraUserAttributes = [
        ...this.extraUserAttributes,
        ...options.extraUserAttributes,
      ];
    }
    if (options?.extraSessionAttributes) {
      this.extraSessionAttributes = [
        ...this.extraSessionAttributes,
        ...options.extraSessionAttributes,
      ];
    }
  }

  public async deleteSession(sessionId: string): Promise<void> {
    // get key of the session to delete
    const [session, user] = await this.getSessionAndUser(sessionId);
    if (!session) return;

    await this.client.send(new DeleteItemCommand({
      TableName: this.tableName,
      Key: {
        [this.pk]: { S: `USER#${session.userId}` },
        [this.sk]: { S: `SESSION#${sessionId}` },
      },
    }));
  }

  public async deleteUserSessions(userId: string): Promise<void> {
    const keys = [];
    let _lastEvaluatedKey: Record<string, AttributeValue> | undefined = undefined;

    // get all keys to delete
    do {
      const commandInput: QueryCommandInput = {
        TableName: this.tableName,
        KeyConditionExpression: '#pk = :pk AND begins_with(#sk, :sk_prefix)',
        ExpressionAttributeNames: {
          '#pk': this.pk,
          '#sk': this.sk,
        },
        ExpressionAttributeValues: {
          ':pk': { S: `USER#${userId}` },
          ':sk_prefix': { S: 'SESSION#' },
        },
        Select: 'SPECIFIC_ATTRIBUTES',
        ProjectionExpression: '#pk, #sk',
      };
      if (_lastEvaluatedKey) commandInput.ExclusiveStartKey = _lastEvaluatedKey;
      const res = await this.client.send(new QueryCommand(commandInput));
      if (res?.Items?.length) {
        keys.push(...res.Items.map((item) => ({
          [this.pk]: item[this.pk],
          [this.sk]: item[this.sk],
        })));
      }
      _lastEvaluatedKey = res?.LastEvaluatedKey;
    } while (_lastEvaluatedKey)

    // delete all keys
    const BATCH_SIZE = 25; // AWS DynamoDB rejects whole batch if batch size exceeds this limit
    for (let i = 0; i < keys.length; i += BATCH_SIZE) {
      const batch = keys.slice(i, i + BATCH_SIZE);
      await this.client.send(new BatchWriteItemCommand({
        RequestItems: {
          [this.tableName]: batch.map((key) => ({
            DeleteRequest: { Key: key },
          })),
        },
      }));
    }
  }

  public async getSessionAndUser(
    sessionId: string
  ): Promise<[session: DatabaseSession | null, user: DatabaseUser | null]> {
    const sessionRes = await this.client.send(new QueryCommand({
      TableName: this.tableName,
      IndexName: this.gsiName,
      KeyConditionExpression: '#gsipk = :gsipk AND #gsisk = :gsisk',
      ExpressionAttributeNames: {
        '#gsipk': this.gsipk,
        '#gsisk': this.gsisk,
      },
      ExpressionAttributeValues: {
        ':gsipk': { S: 'SESSION' },
        ':gsisk': { S: `SESSION#${sessionId}` },
      },
    }));
    if (!sessionRes?.Items?.length) return [null, null];
    const session = this.itemToSession(sessionRes.Items[0]);
  
    const userRes = await this.client.send(new GetItemCommand({
      TableName: this.tableName,
      Key: {
        [this.pk]: { S: `USER#${session.userId}` },
        [this.sk]: { S: `USER#${session.userId}` },
      },
    }));
    if (!userRes?.Item) return [session, null];
    const user = this.itemToUser(userRes.Item);

    return [session, user];
  }

  public async getUserSessions(userId: string): Promise<DatabaseSession[]> {
    const sessions: DatabaseSession[] = [];
    let _lastEvaluatedKey: Record<string, AttributeValue> | undefined = undefined;

    do {
      const commandInput: QueryCommandInput = {
        TableName: this.tableName,
        ExpressionAttributeNames: {
          '#pk': this.pk,
          '#sk': this.sk,
        },
        ExpressionAttributeValues: {
          ':pk': { S: `USER#${userId}` },
          ':sk_prefix': { S: 'SESSION#' },
        },
        KeyConditionExpression: '#pk = :pk AND begins_with(#sk, :sk_prefix)',
      };
      if (_lastEvaluatedKey) commandInput.ExclusiveStartKey = _lastEvaluatedKey;
      const res = await this.client.send(new QueryCommand(commandInput));
      if (res?.Items?.length) {
        sessions.push(...res.Items.map((x) => this.itemToSession(x)));
      }
      _lastEvaluatedKey = res?.LastEvaluatedKey;
    } while (_lastEvaluatedKey)

    return sessions;
  }

  public async setSession(databaseSession: DatabaseSession): Promise<void> {
    await this.client.send(new PutItemCommand({
      TableName: this.tableName,
      Item: marshall({
        [this.pk]: `USER#${databaseSession.userId}`,
        [this.sk]: `SESSION#${databaseSession.id}`,
        [this.gsipk]: 'SESSION',
        [this.gsisk]: `SESSION#${databaseSession.id}`,
        [this.expiresAt]: databaseSession.expiresAt.toISOString(),
        ...databaseSession.attributes,
      }),
    }));
  }

  public async updateSessionExpiration(sessionId: string, expiresAt: Date): Promise<void> {
    // get key of the session to update
    const sessionRes = await this.client.send(new QueryCommand({
      TableName: this.tableName,
      IndexName: this.gsiName,
      KeyConditionExpression: '#gsipk = :gsipk AND #gsisk = :gsisk',
      ExpressionAttributeNames: {
        '#gsipk': this.gsipk,
        '#gsisk': this.gsisk,
      },
      ExpressionAttributeValues: {
        ':gsipk': { S: 'SESSION' },
        ':gsisk': { S: `SESSION#${sessionId}` },
      },
    }));
    if (!sessionRes?.Items?.length) return;
    const session = this.itemToSession(sessionRes.Items[0]);

    // update the session
    await this.client.send(new UpdateItemCommand({
      TableName: this.tableName,
      Key: {
        [this.pk]: { S: `USER#${session.userId}` },
        [this.sk]: { S: `SESSION#${sessionId}` },
      },
      UpdateExpression: 'SET #expires_at = :expires_at',
      ExpressionAttributeNames: {
        '#expires_at': this.expiresAt,
      },
      ExpressionAttributeValues: {
        ':expires_at': { S: expiresAt.toISOString() },
      },
    }));
  }

  public async deleteExpiredSessions(): Promise<void> {
    // get all expired session keys to delete
    let _lastEvaluatedKey: Record<string, AttributeValue> | undefined = undefined;
    const keys = [];

    do {
      const commandInput: QueryCommandInput = {
        TableName: this.tableName,
        IndexName: this.gsiName,
        ExpressionAttributeNames: {
          '#pk': this.pk,
          '#sk': this.sk,
          '#gsipk': this.gsipk,
          '#expires_at': this.expiresAt,
        },
        ExpressionAttributeValues: {
          ':gsipk': { S: 'SESSION' },
          ':expires_at_end': { S: new Date().toISOString() },
        },
        KeyConditionExpression: '#gsipk = :gsipk',
        FilterExpression: '#expires_at < :expires_at_end',
        Select: 'SPECIFIC_ATTRIBUTES',
        ProjectionExpression: '#pk, #sk',
      }
      if (_lastEvaluatedKey) commandInput.ExclusiveStartKey = _lastEvaluatedKey;
      const res = await this.client.send(new QueryCommand(commandInput));
      if (res?.Items?.length) {
        const expiredSessions = res.Items.map((x) => unmarshall(x));
        keys.push(...expiredSessions.map((x) => ({
          [this.pk]: { S: x[this.pk] },
          [this.sk]: { S: x[this.sk] },
        })));
      }
      _lastEvaluatedKey = res?.LastEvaluatedKey;
    } while (_lastEvaluatedKey)

    // delete all expired session keys
    const BATCH_SIZE = 25; // AWS DynamoDB rejects whole batch if batch size exceeds this limit
    for (let i = 0; i < keys.length; i += BATCH_SIZE) {
      const batch = keys.slice(i, i + BATCH_SIZE);
      await this.client.send(new BatchWriteItemCommand({
        RequestItems: {
          [this.tableName]: batch.map((key) => ({
            DeleteRequest: { Key: key },
          })),
        },
      }));
    }
  }

  private itemToUser(item: Record<string, AttributeValue>): DatabaseUser {
    const unmarshalled = unmarshall(item);
    const {
      [this.pk]: pk,
      [this.sk]: sk,
      [this.gsipk]: gsi1pk,
      [this.gsisk]: gsi1sk,
      [this.expiresAt]: expiresAt,
      ...rest
    } = unmarshalled;

    const attributes = {};
    for (const key in rest) {
      if (!this.extraUserAttributes.includes(key)) {
        Object.assign(attributes, { [key]: rest[key] });
      }
    }

    return {
      id: pk.split('#')[1],
      attributes,
    };
  }

  private itemToSession(item: Record<string, AttributeValue>): DatabaseSession {
    const unmarshalled = unmarshall(item);
    const {
      [this.pk]: pk,
      [this.sk]: sk,
      [this.gsipk]: gsi1pk,
      [this.gsisk]: gsi1sk,
      [this.expiresAt]: expiresAt,
      ...rest
    } = unmarshalled;

    const attributes = {};
    for (const key in rest) {
      if (!this.extraSessionAttributes.includes(key)) {
        Object.assign(attributes, { [key]: rest[key] });
      }
    }

    return {
      id: sk.split('#')[1],
      userId: pk.split('#')[1],
      expiresAt: new Date(expiresAt),
      attributes,
    };
  }
}

/**
 * Adapter using two GSIs
 */
class DynamoDBAdapter2 implements Adapter {
  private client: DynamoDBClient;
  private tableName: string = 'LuciaAuthTable';
  private pk: string = 'PK';
  private sk: string = 'SK';
  private gsi1Name: string = 'GSI1';
  private gsi1pk: string = 'GSI1PK';
  private gsi1sk: string = 'GSI1SK';
  private gsi2Name: string = 'GSI2';
  private gsi2pk: string = 'GSI2PK';
  private gsi2sk: string = 'GSI2SK';
  private extraUserAttributes: string[] = [];
  private extraSessionAttributes: string[] = [];

  constructor(client: DynamoDBClient, options?: DynamoDBAdapterOptions) {
    this.client = client;
    if (options?.tableName) this.tableName = options.tableName;
    if (options?.pk) this.pk = options.pk;
    if (options?.sk) this.sk = options.sk;
    if (options?.gsi1Name) this.gsi1Name = options.gsi1Name;
    if (options?.gsi1pk) this.gsi1pk = options.gsi1pk;
    if (options?.gsi1sk) this.gsi1sk = options.gsi1sk;
    if (options?.gsi2Name) this.gsi2Name = options.gsi2Name;
    if (options?.gsi2pk) this.gsi2pk = options.gsi2pk;
    if (options?.gsi2sk) this.gsi2sk = options.gsi2sk;
    if (options?.extraUserAttributes) {
      this.extraUserAttributes = [
        ...this.extraUserAttributes,
        ...options.extraUserAttributes,
      ];
    }
    if (options?.extraSessionAttributes) {
      this.extraSessionAttributes = [
        ...this.extraSessionAttributes,
        ...options.extraSessionAttributes,
      ];
    }
  }

  public async deleteSession(sessionId: string): Promise<void> {
    // get key of the session to delete
    const [session, user] = await this.getSessionAndUser(sessionId);
    if (!session) return;

    await this.client.send(new DeleteItemCommand({
      TableName: this.tableName,
      Key: {
        [this.pk]: { S: `USER#${session.userId}` },
        [this.sk]: { S: `SESSION#${sessionId}` },
      },
    }));
  }

  public async deleteUserSessions(userId: string): Promise<void> {
    const keys = [];
    let _lastEvaluatedKey: Record<string, AttributeValue> | undefined = undefined;

    // get all keys to delete
    do {
      const commandInput: QueryCommandInput = {
        TableName: this.tableName,
        KeyConditionExpression: '#pk = :pk AND begins_with(#sk, :sk_prefix)',
        ExpressionAttributeNames: {
          '#pk': this.pk,
          '#sk': this.sk,
        },
        ExpressionAttributeValues: {
          ':pk': { S: `USER#${userId}` },
          ':sk_prefix': { S: 'SESSION#' },
        },
        Select: 'SPECIFIC_ATTRIBUTES',
        ProjectionExpression: '#pk, #sk',
      };
      if (_lastEvaluatedKey) commandInput.ExclusiveStartKey = _lastEvaluatedKey;
      const res = await this.client.send(new QueryCommand(commandInput));
      if (res?.Items?.length) {
        keys.push(...res.Items.map((item) => ({
          [this.pk]: item[this.pk],
          [this.sk]: item[this.sk],
        })));
      }
      _lastEvaluatedKey = res?.LastEvaluatedKey;
    } while (_lastEvaluatedKey)

    // delete all keys
    const BATCH_SIZE = 25; // AWS DynamoDB rejects whole batch if batch size exceeds this limit
    for (let i = 0; i < keys.length; i += BATCH_SIZE) {
      const batch = keys.slice(i, i + BATCH_SIZE);
      await this.client.send(new BatchWriteItemCommand({
        RequestItems: {
          [this.tableName]: batch.map((key) => ({
            DeleteRequest: { Key: key },
          })),
        },
      }));
    }
  }

  public async getSessionAndUser(
    sessionId: string
  ): Promise<[session: DatabaseSession | null, user: DatabaseUser | null]> {
    const sessionRes = await this.client.send(new QueryCommand({
      TableName: this.tableName,
      IndexName: this.gsi1Name,
      KeyConditionExpression: '#gsi1pk = :gsi1pk AND #gsi1sk = :gsi1sk',
      ExpressionAttributeNames: {
        '#gsi1pk': this.gsi1pk,
        '#gsi1sk': this.gsi1sk,
      },
      ExpressionAttributeValues: {
        ':gsi1pk': { S: `SESSION#${sessionId}` },
        ':gsi1sk': { S: `SESSION#${sessionId}` },
      },
    }));
    if (!sessionRes?.Items?.length) return [null, null];
    const session = this.itemToSession(sessionRes.Items[0]);
  
    const userRes = await this.client.send(new GetItemCommand({
      TableName: this.tableName,
      Key: {
        [this.pk]: { S: `USER#${session.userId}` },
        [this.sk]: { S: `USER#${session.userId}` },
      },
    }));
    if (!userRes?.Item) return [session, null];
    const user = this.itemToUser(userRes.Item);

    return [session, user];
  }

  public async getUserSessions(userId: string): Promise<DatabaseSession[]> {
    const sessions: DatabaseSession[] = [];
    let _lastEvaluatedKey: Record<string, AttributeValue> | undefined = undefined;

    do {
      const commandInput: QueryCommandInput = {
        TableName: this.tableName,
        ExpressionAttributeNames: {
          '#pk': this.pk,
          '#sk': this.sk,
        },
        ExpressionAttributeValues: {
          ':pk': { S: `USER#${userId}` },
          ':sk_prefix': { S: 'SESSION#' },
        },
        KeyConditionExpression: '#pk = :pk AND begins_with(#sk, :sk_prefix)',
      };
      if (_lastEvaluatedKey) commandInput.ExclusiveStartKey = _lastEvaluatedKey;
      const res = await this.client.send(new QueryCommand(commandInput));
      if (res?.Items?.length) {
        sessions.push(...res.Items.map((x) => this.itemToSession(x)));
      }
      _lastEvaluatedKey = res?.LastEvaluatedKey;
    } while (_lastEvaluatedKey)

    return sessions;
  }

  public async setSession(databaseSession: DatabaseSession): Promise<void> {
    await this.client.send(new PutItemCommand({
      TableName: this.tableName,
      Item: marshall({
        [this.pk]: `USER#${databaseSession.userId}`,
        [this.sk]: `SESSION#${databaseSession.id}`,
        [this.gsi1pk]: `SESSION#${databaseSession.id}`,
        [this.gsi1sk]: `SESSION#${databaseSession.id}`,
        [this.gsi2pk]: 'SESSION_EXPIRES',
        [this.gsi2sk]: databaseSession.expiresAt.toISOString(),
        ...databaseSession.attributes,
      }),
    }));
  }

  public async updateSessionExpiration(sessionId: string, expiresAt: Date): Promise<void> {
    // get key of the session to update
    const sessionRes = await this.client.send(new QueryCommand({
      TableName: this.tableName,
      IndexName: this.gsi1Name,
      KeyConditionExpression: '#gsi1pk = :gsi1pk AND #gsi1sk = :gsi1sk',
      ExpressionAttributeNames: {
        '#gsi1pk': this.gsi1pk,
        '#gsi1sk': this.gsi1sk,
      },
      ExpressionAttributeValues: {
        ':gsi1pk': { S: `SESSION#${sessionId}` },
        ':gsi1sk': { S: `SESSION#${sessionId}` },
      },
    }));
    if (!sessionRes?.Items?.length) return;
    const session = this.itemToSession(sessionRes.Items[0]);

    // update the session
    await this.client.send(new UpdateItemCommand({
      TableName: this.tableName,
      Key: {
        [this.pk]: { S: `USER#${session.userId}` },
        [this.sk]: { S: `SESSION#${sessionId}` },
      },
      UpdateExpression: 'SET #gsi2sk = :gsi2sk',
      ExpressionAttributeNames: {
        '#gsi2sk': this.gsi2sk,
      },
      ExpressionAttributeValues: {
        ':gsi2sk': { S: expiresAt.toISOString() },
      },
    }));
  }

  public async deleteExpiredSessions(): Promise<void> {
    // get all expired session keys to delete
    let _lastEvaluatedKey: Record<string, AttributeValue> | undefined = undefined;
    const keys = [];

    do {
      const commandInput: QueryCommandInput = {
        TableName: this.tableName,
        IndexName: this.gsi2Name,
        ExpressionAttributeNames: {
          '#pk': this.pk,
          '#sk': this.sk,
          '#gsi2pk': this.gsi2pk,
          '#gsi2sk': this.gsi2sk,
        },
        ExpressionAttributeValues: {
          ':gsi2pk': { S: 'SESSION_EXPIRES' },
          ':gsi2sk_end': { S: new Date().toISOString() },
        },
        KeyConditionExpression: '#gsi2pk = :gsi2pk AND #gsi2sk < :gsi2sk_end',
        Select: 'SPECIFIC_ATTRIBUTES',
        ProjectionExpression: '#pk, #sk',
      }
      if (_lastEvaluatedKey) commandInput.ExclusiveStartKey = _lastEvaluatedKey;
      const res = await this.client.send(new QueryCommand(commandInput));
      if (res?.Items?.length) {
        const expiredSessions = res.Items.map((x) => unmarshall(x));
        keys.push(...expiredSessions.map((x) => ({
          [this.pk]: { S: x[this.pk] },
          [this.sk]: { S: x[this.sk] },
        })));
      }
      _lastEvaluatedKey = res?.LastEvaluatedKey;
    } while (_lastEvaluatedKey)

    // delete all expired session keys
    const BATCH_SIZE = 25; // AWS DynamoDB rejects whole batch if batch size exceeds this limit
    for (let i = 0; i < keys.length; i += BATCH_SIZE) {
      const batch = keys.slice(i, i + BATCH_SIZE);
      await this.client.send(new BatchWriteItemCommand({
        RequestItems: {
          [this.tableName]: batch.map((key) => ({
            DeleteRequest: { Key: key },
          })),
        },
      }));
    }
  }

  private itemToUser(item: Record<string, AttributeValue>): DatabaseUser {
    const unmarshalled = unmarshall(item);
    const {
      [this.pk]: pk,
      [this.sk]: sk,
      [this.gsi1pk]: gsi1pk,
      [this.gsi1sk]: gsi1sk,
      [this.gsi2pk]: gsi2pk,
      [this.gsi2sk]: gsi2sk,
      ...rest
    } = unmarshalled;

    const attributes = {};
    for (const key in rest) {
      if (!this.extraUserAttributes.includes(key)) {
        Object.assign(attributes, { [key]: rest[key] });
      }
    }

    return {
      id: pk.split('#')[1],
      attributes,
    };
  }

  private itemToSession(item: Record<string, AttributeValue>): DatabaseSession {
    const unmarshalled = unmarshall(item);
    const {
      [this.pk]: pk,
      [this.sk]: sk,
      [this.gsi1pk]: gsi1pk,
      [this.gsi1sk]: gsi1sk,
      [this.gsi2pk]: gsi2pk,
      [this.gsi2sk]: gsi2sk,
      ...rest
    } = unmarshalled;

    const attributes = {};
    for (const key in rest) {
      if (!this.extraSessionAttributes.includes(key)) {
        Object.assign(attributes, { [key]: rest[key] });
      }
    }

    return {
      id: sk.split('#')[1],
      userId: pk.split('#')[1],
      expiresAt: new Date(gsi2sk),
      attributes,
    };
  }

}
