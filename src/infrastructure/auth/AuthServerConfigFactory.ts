import { AuthServerConfig } from "./AuthServerConfig";

export class AuthServerConfigFactory {
  static create(config: Record<string, any>): AuthServerConfig {
    if (!config.url || !config.clientId || !config.clientSecret) {
      throw new Error('Invalid AuthServer configuration');
    }

    return {
      url: config.url,
      clientId: config.clientId,
      clientSecret: config.clientSecret
    };
  }
}