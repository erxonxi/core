/* eslint-disable @typescript-eslint/no-unsafe-function-type */
import amqplib, { ConsumeMessage } from 'amqplib';
import { ConnectionSettings } from './ConnectionSettings';
import { RabbitMQExchangeNameFormatter } from './RabbitMQExchangeNameFormatter';

export class RabbitMqConnection {
	private connectionSettings: ConnectionSettings;
	private channel?: amqplib.ConfirmChannel;
	private connection?: amqplib.ChannelModel;

	constructor(params: { connectionSettings: ConnectionSettings }) {
		this.connectionSettings = params.connectionSettings;
	}

	async connect() {
		this.connection = await this.amqpConnect();
		this.channel = await this.amqpChannel();
	}

	async exchange(params: { name: string }) {
		return await this.channel?.assertExchange(params.name, 'topic', {
			durable: true
		});
	}

	async queue(params: {
		exchange: string;
		name: string;
		routingKeys: string[];
		deadLetterExchange?: string;
		deadLetterQueue?: string;
		messageTtl?: number;
	}) {
		const durable = true;
		const exclusive = false;
		const autoDelete = false;
		const args = this.getQueueArguments(params);

		await this.channel?.assertQueue(params.name, {
			exclusive,
			durable,
			autoDelete,
			arguments: args
		});
		for (const routingKey of params.routingKeys) {
			await this.channel!.bindQueue(params.name, params.exchange, routingKey);
		}
	}

	private getQueueArguments(params: {
		exchange: string;
		name: string;
		routingKeys: string[];
		deadLetterExchange?: string;
		deadLetterQueue?: string;
		messageTtl?: number;
	}) {
		let args = {};
		if (params.deadLetterExchange) {
			args = { ...args, 'x-dead-letter-exchange': params.deadLetterExchange };
		}
		if (params.deadLetterQueue) {
			args = { ...args, 'x-dead-letter-routing-key': params.deadLetterQueue };
		}
		if (params.messageTtl) {
			args = { ...args, 'x-message-ttl': params.messageTtl };
		}

		return args;
	}

	async deleteQueue(queue: string) {
		return await this.channel!.deleteQueue(queue);
	}

	private async amqpConnect() {
		const { hostname, port, secure } = this.connectionSettings.connection;
		const { username, password, vhost } = this.connectionSettings;
		const protocol = secure ? 'amqps' : 'amqp';

		const connection = await amqplib.connect({
			protocol,
			hostname,
			port,
			username,
			password,
			vhost
		});

		connection.on('error', (err) => {
			Promise.reject(err);
		});

		return connection;
	}

	private async amqpChannel(): Promise<amqplib.ConfirmChannel> {
		if (!this.connection) {
			throw new Error('RabbitMQ connection is not established');
		}
		const channel = await this.connection.createConfirmChannel();
		await channel.prefetch(1);

		return channel;
	}

	async publish(params: {
		exchange: string;
		routingKey: string;
		content: Buffer;
		options: {
			messageId: string;
			contentType: string;
			contentEncoding: string;
			priority?: number;
			headers?: { [key: string]: unknown };
		};
	}) {
		const { routingKey, content, options, exchange } = params;

		return new Promise((resolve: Function, reject: Function) => {
			this.channel!.publish(exchange, routingKey, content, options, (error) =>
				error ? reject(error) : resolve()
			);
		});
	}

	async close() {
		await this.channel?.close();
		if (this.connection) {
			await this.connection.close();
		}
	}

	async consume(queue: string, onMessage: (message: ConsumeMessage) => object) {
		await this.channel!.consume(queue, (message: ConsumeMessage | null) => {
			if (!message) {
				return;
			}
			onMessage(message);
		});
	}

	ack(message: ConsumeMessage) {
		this.channel!.ack(message);
	}

	async retry(message: ConsumeMessage, queue: string, exchange: string) {
		const retryExchange = RabbitMQExchangeNameFormatter.retry(exchange);
		const options = this.getMessageOptions(message);

		return await this.publish({
			exchange: retryExchange,
			routingKey: queue,
			content: message.content,
			options
		});
	}

	async deadLetter(message: ConsumeMessage, queue: string, exchange: string) {
		const deadLetterExchange = RabbitMQExchangeNameFormatter.deadLetter(exchange);
		const options = this.getMessageOptions(message);

		return await this.publish({
			exchange: deadLetterExchange,
			routingKey: queue,
			content: message.content,
			options
		});
	}

	private getMessageOptions(message: ConsumeMessage) {
		const { messageId, contentType, contentEncoding, priority } = message.properties;
		const options = {
			messageId,
			headers: this.incrementRedeliveryCount(message),
			contentType,
			contentEncoding,
			priority
		};
		return options;
	}

	private incrementRedeliveryCount(message: ConsumeMessage) {
		const headers = message.properties.headers || {};
		if (this.hasBeenRedelivered(message)) {
			const count = parseInt(headers['redelivery_count'] || '0');
			headers['redelivery_count'] = count + 1;
		} else {
			headers['redelivery_count'] = 1;
		}

		return headers;
	}

	private hasBeenRedelivered(message: ConsumeMessage) {
		return message.properties.headers?.['redelivery_count'] !== undefined;
	}
}
