import { createClient, defineScript } from 'redis';
import { itemsViewsKey, itemsKey, itemsByViewsKey } from '../src/services/keys';
const client = createClient({
	socket: {
		host: process.env.REDIS_HOST,
		port: parseInt(process.env.REDIS_PORT!)
	},
	// password: process.env.REDIS_PW
	legacyMode: true
});

client.on('error', (err) => console.log(err));

export { client };
export type Client = typeof client;
