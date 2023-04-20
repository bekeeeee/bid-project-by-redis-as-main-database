import { randomBytes } from 'crypto';
import { client } from './client';
export const withLock = async (key: string, cb: (redisClient: Client, signal: any) => any) => {
	// Initialize a few variables to control retry behavior

	const retryDelaysMs = 100;
	let retries = 20;
	let timeoutMs = 2000;

	// Generate a random value to store at the lock key
	const token = randomBytes(6).toString('hex');
	// create the lock key

	const lockKey = `lock:${key}`;
	// await client.

	// set up a while loop to implement retry behaviour

	while (retries-- > 0) {
		// try to do a SET NX operation
		const state = await client.set(lockKey, token, {
			NX: true,
			PX: 2000
		});
		if (!state) {
			await pause(retryDelaysMs);
			continue;
		}
		try {
			const signal = {
				expired: false
			};
			setTimeout(() => {
				signal.expired = true;
			}, timeoutMs);
			const proxiedClient = buildClientProxy(timeoutMs);
			const result = await cb(proxiedClient, signal);
			return result;
		} finally {
			client.unlock(lockKey, token);
		}
	}
};

type Client = typeof client;

const buildClientProxy = (timeoutMs: number) => {
	const startTime = Date.now();

	const handler = {
		get(target: Client, prop: keyof Client) {
			if (Date.now() >= startTime + timeoutMs) throw new Error('Lock has expired');
			const value = target[prop];
			return typeof value === 'function' ? value.bind(target) : value;
		}
	};
	return new Proxy(client, handler) as Client;
};

const pause = (duration: number) => {
	return new Promise((resolve) => {
		setTimeout(resolve, duration);
	});
};
