import type {
  Adapter,
  DatabaseSession,
  DatabaseUser,
} from 'lucia';
import {
  type DynamoDBClient,
  GetItemCommand,
  QueryCommand,
} from '@aws-sdk/client-dynamodb';
import { unmarshall } from '@aws-sdk/util-dynamodb';

export class DynamoDBAdapter implements Adapter {
  private client: DynamoDBClient;
  private tableName: string = 'LuciaAuthName';
  private pk: string = 'pk';
  private sk: string = 'sk';
  private gsiName: string = 'GSI1';
  private gsi1pk: string = 'GSI1PK';
  private gsi1sk: string = 'GSI1SK';

  constructor(client: DynamoDBClient, options?: {
    tableName?: string;
    pk?: string;
    sk?: string;
    gsiName?: string,
    gsi1pk?: string;
    gsi1sk?: string;
  }) {
    this.client = client;
    if (options?.tableName) this.tableName = options.tableName;
    if (options?.pk) this.pk = options.pk;
    if (options?.sk) this.sk = options.sk;
    if (options?.gsiName) this.gsiName = options.gsiName;
    if (options?.gsi1pk) this.gsi1pk = options.gsi1pk;
    if (options?.gsi1sk) this.gsi1sk = options.gsi1sk;
  }

  public async deleteSession(sessionId: string): Promise<void> {
    /** TODO */
  }

  public async deleteUserSessions(userId: string): Promise<void> {
    /** TODO */
  }

  public async getSessionAndUser(
    sessionId: string
  ): Promise<[session: DatabaseSession | null, user: DatabaseUser | null]> {
    const sessionRes = await this.client.send(new QueryCommand({
      TableName: this.tableName,
      IndexName: this.gsiName,
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
    const session = unmarshall(sessionRes.Items[0]) as DatabaseSession;
  
    const userRes = await this.client.send(new GetItemCommand({
      TableName: this.tableName,
      Key: {
        [this.pk]: { S: `USER#${session.userId}` },
        [this.sk]: { S: `USER#${session.userId}` },
      },
    }));
    if (!userRes?.Item) return [session, null];
    const user = unmarshall(userRes.Item) as DatabaseUser;

    return [session, user];
  }

  public async getUserSessions(userId: string): Promise<DatabaseSession[]> {
    /** TODO */
    return [];
  }

  public async setSession(databaseSession: DatabaseSession): Promise<void> {
    /** TODO */
  }

  public async updateSessionExpiration(sessionId: string, expiresAt: Date): Promise<void> {
    /** TODO */
  }

  public async deleteExpiredSessions(): Promise<void> {
    /** TODO */
  }

}
