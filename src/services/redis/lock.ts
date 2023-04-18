import { randomBytes } from 'crypto';
import { client } from './client';
export const withLock = async (key: string, cb: () => any) => {
	// Initialize a few variables to control retry behavior

	const retryDelaysMs = 100;
	let retries = 20;

	// Generate a random value to store at the lock key
	const token = randomBytes(6).toString('hex');
	// create the lock key

	const lockKey = `lock:${key}`;

	// set up a while loop to implement retry behaviour

	while (retries-- > 0) {
		// try to do a SET NX operation
		const state = await client.set(lockKey, token, {
			NX: true
		});
		if (state) {
			client.del(lockKey);
			const result = await cb();
			return result;
		}

		await pause(retryDelaysMs);
	}
};

const buildClientProxy = () => {};

const pause = (duration: number) => {
	return new Promise((resolve) => {
		setTimeout(resolve, duration);
	});
};
