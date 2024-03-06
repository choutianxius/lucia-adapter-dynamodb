import type {
  Adapter,
  DatabaseSession,
  DatabaseUser,
} from 'lucia';

export class DynamoDBAdapter implements Adapter {
  public async deleteSession(sessionId: string): Promise<void> {
    /** TODO */
  }

  public async deleteUserSessions(userId: string): Promise<void> {
    /** TODO */
  }

  public async getSessionAndUser(
    sessionId: string
  ): Promise<[session: DatabaseSession | null, user: DatabaseUser | null]> {
    /** TODO */
    return [null, null];
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
