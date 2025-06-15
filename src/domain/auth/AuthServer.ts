export interface AuthServer {
	getPayloadFromToken(token: string): any;
	verifyToken(token: string): Promise<void>;
	createTokens(code: string): Promise<{ accessToken: string; refreshToken: string }>;
}
