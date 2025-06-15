import { AuthServer } from '../../domain/auth/AuthServer';
import { AuthServerConfig } from './AuthServerConfig';
import Logger from '../../domain/Logger';
import jwt from 'jsonwebtoken';

export class FetchAuthServer implements AuthServer {
  constructor(private readonly config: AuthServerConfig, private readonly logger: Logger) {}

  getPayloadFromToken(token: string): any {
    try {
      const payload = jwt.decode(token, {
        complete: true
      });

      if (!payload) {
        throw new Error('Invalid token');
      }

      return payload?.payload;
    } catch (e) {
      throw new Error('Invalid token');
    }
  }

  async verifyToken(accessToken: string): Promise<void> {
    try {
      const response = await fetch(`${this.config.url}/auth/token/validate`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({ accessToken })
      });

      if (response.status !== 200) {
        throw new Error('Invalid token');
      }
    } catch (e) {
      this.logger.error(`Error validating token: ${(e as Error).message}`);
      throw new Error('Invalid token');
    }
  }

  async createTokens(code: string): Promise<{ accessToken: string; refreshToken: string }> {
    try {
      let url = `${this.config.url}/auth/token`;
      const response = await fetch(url, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          clientId: this.config.clientId,
          clientSecret: this.config.clientSecret,
          code: code
        })
      });

      if (response.status !== 200) {
        throw new Error('Invalid token');
      }

      const data = await response.json();

      return {
        accessToken: data.accessToken,
        refreshToken: data.refreshToken
      };
    } catch (e) {
      this.logger.error(`Error creating tokens: ${(e as Error).message}`);
      throw new Error('Invalid token');
    }
  }
}
