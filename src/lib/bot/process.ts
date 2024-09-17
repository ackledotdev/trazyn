import {
	EmbedBuilder,
	codeBlock,
	time,
	TimestampStyles,
	Colors,
	Client
} from 'discord.js';
import { Devs } from '../../config';

export async function sendError(e: Error, client: Client) {
	for (const devId of Devs) {
		client.users.fetch(devId).then(user => {
			const date = new Date();
			user.send({
				embeds: [
					new EmbedBuilder()
						.setTitle('Error Log')
						.setDescription(e.message)
						.addFields({ name: 'Stack Trace', value: codeBlock(e.stack ?? '') })
						.addFields({
							name: 'ISO 8601 Timestamp',
							value: date.toISOString()
						})
						.addFields({
							name: 'Localized DateTime',
							value: time(date, TimestampStyles.LongDateTime)
						})
						.setColor(Colors.Red)
						.setTimestamp()
				]
			});
		});
	}
}
