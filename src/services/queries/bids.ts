import { bidHistoryKey, itemsByPriceKey, itemsKey } from '$services/keys';
import { client, withLock } from '$services/redis';
import type { CreateBidAttrs } from '$services/types';
import { DateTime } from 'luxon';
import { getItem, itemsByPrice } from './items';

export const createBid = async (attrs: CreateBidAttrs) => {
	return withLock(attrs.itemId, async () => {
		const item = await getItem(attrs.itemId);
		if (!item) throw new Error('Item does not exist');

		if (item.endingAt.diff(DateTime.now()).toMillis() < 0)
			throw new Error('Item closed to bidding');

		if (item.price >= attrs.amount) throw new Error('Bid too low');

		const serialized = serializeHistory(attrs.amount, attrs.createdAt.toMillis());

		return Promise.all([
			client.rPush(bidHistoryKey(attrs.itemId), serialized),
			client.hSet(itemsKey(item.id), {
				bids: item.bids + 1,
				price: attrs.amount,
				highestBidUserId: attrs.userId
			}),
			client.zAdd(itemsByPriceKey(), {
				value: item.id,
				score: attrs.amount
			})
		]);
	});
	// return client.executeIsolated(async (isolatedClient) => {
	// 	const item = await getItem(attrs.itemId);
	// 	if (!item) throw new Error('Item does not exist');

	// 	if (item.endingAt.diff(DateTime.now()).toMillis() < 0)
	// 		throw new Error('Item closed to bidding');

	// 	if (item.price >= attrs.amount) throw new Error('Bid too low');

	// 	const serialized = serializeHistory(attrs.amount, attrs.createdAt.toMillis());

	// 	return isolatedClient
	// 		.multi()
	// 		.rPush(bidHistoryKey(attrs.itemId), serialized)
	// 		.hSet(itemsKey(item.id), {
	// 			bids: item.bids + 1,
	// 			price: attrs.amount,
	// 			highestBidUserId: attrs.userId
	// 		})
	// 		.zAdd(itemsByPriceKey(), {
	// 			value: item.id,
	// 			score: attrs.amount
	// 		})
	// 		.exec();
	// });
};

export const getBidHistory = async (itemId: string, offset = 0, count = 10) => {
	const startIndex = -1 * offset - count;
	const endIndex = -1 - offset;

	const range = await client.lRange(bidHistoryKey(itemId), startIndex, endIndex);

	return range.map((bid) => deserializeHistory(bid));
};

const serializeHistory = (amount: number, createdAt: number) => {
	return `${amount}:${createdAt}`;
};

const deserializeHistory = (record: string) => {
	const [amount, createdAt] = record.split(':');

	return {
		amount: parseFloat(amount),
		createdAt: DateTime.fromMillis(parseInt(createdAt))
	};
};
