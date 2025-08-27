import 'dotenv/config';
import {
	ActivityType,
	Client,
	Events,
	Message,
	OAuth2Scopes,
	OmitPartialGroupDMChannel,
	Partials,
	PermissionFlagsBits,
	PresenceUpdateStatus
} from 'discord.js';
import { CommandClient } from './lib/bot/discord/Extend';
import { Methods, createServer } from './server';
import { PORT } from './config';
import { argv, cwd, stdout } from 'process';
import { Button, Command, Event } from './lib/bot/discord/types';
import { dirname, join } from 'path';
import { fileURLToPath } from 'url';
import { logger } from './logger';
import { readdirSync } from 'fs';
import { Jsoning, JSONValue } from 'jsoning';
import { sendError } from './lib/bot/process';
import OpenAI from 'openai';
import {
	EasyInputMessage,
	Response
} from 'openai/resources/responses/responses';
// @ts-expect-error
import { chunk } from 'textchunk';

argv.shift();
argv.shift();
if (argv.includes('-d')) {
	logger.level = 'debug';
	logger.debug('Debug mode enabled.');
}

logger.info('Opened database.');

const client = new CommandClient({
	intents: ['DirectMessages', 'Guilds', 'GuildMessages', 'MessageContent'],
	partials: [Partials.Channel, Partials.Message],
	presence: {
		activities: [
			{
				name: 'Warhammer 40,000',
				type: ActivityType.Playing
			}
		],
		afk: false,
		status: PresenceUpdateStatus.Online
	}
});
logger.debug('Created client instance.');

const server = createServer(
	{
		handler: (_req, res) => res.redirect('/status'),
		method: Methods.GET,
		route: '/'
	},
	{
		handler: (_req, res) => res.sendStatus(client.isReady() ? 200 : 503),
		method: Methods.GET,
		route: '/status'
	},
	{
		handler: (req, res) => {
			if (
				req.headers['content-type'] !== 'application/json' &&
				req.headers['content-type'] != undefined
			)
				res.status(415).end();
			else if (client.isReady())
				res
					.status(200)
					.contentType('application/json')
					.send({
						clientPing: client.ws.ping,
						clientReady: client.isReady(),
						commandCount: client.application!.commands.cache.size,
						guildCount: client.application!.approximateGuildCount,
						lastReady: client.readyAt!.valueOf(),
						timestamp: Date.now(),
						uptime: client.uptime
					})
					.end();
			else res.status(503).end();
		},
		method: Methods.GET,
		route: '/bot'
	},
	{
		route: '/invite',
		method: Methods.GET,
		handler: (_req, res) => {
			res.redirect(
				client.generateInvite({
					scopes: [OAuth2Scopes.Bot],
					permissions: [
						PermissionFlagsBits.EmbedLinks,
						PermissionFlagsBits.ReadMessageHistory,
						PermissionFlagsBits.SendMessages,
						PermissionFlagsBits.SendMessagesInThreads,
						PermissionFlagsBits.ViewChannel
					]
				})
			);
		}
	}
);
logger.debug('Created server instance.');

/**
	const commandsPath = join(dirname(fileURLToPath(import.meta.url)), 'commands');
	const commandFiles = readdirSync(commandsPath).filter(file =>
		file.endsWith('.ts')
	);
	const cmndb = new Jsoning('botfiles/cmnds.db.json');
	for (const file of commandFiles) {
		const filePath = join(commandsPath, file);
		const command: Command = await import(filePath);
		client.commands.set(command.data.name, command);
		if (command.help)
			await cmndb.set(
				command.data.name,
				command.help.toJSON() as unknown as JSONValue
			);
	}
	client.commands.freeze();
	logger.info('Loaded commands.');

	const eventsPath = join(cwd(), 'src', 'events');
	const eventFiles = readdirSync(eventsPath).filter(file => file.endsWith('.ts'));
	for (const file of eventFiles) {
		const filePath = join(eventsPath, file);
		const event: Event = await import(filePath);
		if (event.once)
			client.once(event.name, async (...args) => await event.execute(...args));
		else client.on(event.name, async (...args) => await event.execute(...args));
	}
	logger.info('Loaded events.');
*/

client
	.on(Events.ClientReady, () => logger.info('Client#ready'))
	/**
		.on(Events.InteractionCreate, async interaction => {
			if (interaction.user.bot) return;
			if (interaction.isChatInputCommand()) {
				const command = client.commands.get(interaction.commandName);
				if (!command) {
					await interaction.reply('Internal error: Command not found');
					await sendError(
						new Error(`Command not found: ${interaction.commandName}`),
						client
					);
					return;
				}
				try {
					await command.execute(interaction);
				} catch (e) {
					if (interaction.replied || interaction.deferred)
						await interaction.editReply(
							'There was an error while running this command.'
						);
					else
						await interaction.reply({
							content: 'There was an error while running this command.',
							ephemeral: true
						});
					if (e instanceof Error) await sendError(e, client);
					logger.error(e);
				}
			}
		})
	*/
	.on(Events.Debug, m => logger.debug(m))
	.on(Events.Error, m => logger.error(m))
	.on(Events.Warn, m => logger.warn(m));
logger.debug('Set up client events.');

const openai = new OpenAI({
	apiKey: process.env.OPENAI_API_KEY
});

await client
	.login(process.env.DISCORD_TOKEN)
	.then(() => logger.info('Logged in.'));

client.on(Events.MessageCreate, async message => {
	try {
		logger.debug(
			`Message received in ${message.channel.id} from ${message.author.tag}: ${message.content}`
		);
		if (message.channel.isDMBased()) logger.debug('DM received.');

		if (
			message.author.bot ||
			(!message.mentions.has((client as Client<true>).user.id) &&
				!message.channel.isDMBased())
		)
			return;

		logger.debug(`Valid message: ${message.content}`);

		let sentYet = false;

		function sendTypingIndicator(
			msg: OmitPartialGroupDMChannel<Message<boolean>>
		) {
			msg.channel.sendTyping().then(() => {
				setTimeout(() => {
					if (!sentYet) sendTypingIndicator(msg);
				}, 9_000);
			});
		}

		message.react('👍').finally(() => sendTypingIndicator(message));

		let context: EasyInputMessage[] = [];
		if (message.reference?.messageId) {
			const referencedMessage = await message.channel.messages.fetch(
				message.reference.messageId
			);
			if (referencedMessage) {
				context.push({
					content: referencedMessage.content,
					role:
						referencedMessage.author.id === message.client.user.id
							? 'assistant'
							: 'user'
				});
			}
		}

		openai.responses
			.create({
				model: 'gpt-5',
				input: [
					...context,
					{
						content: message.content
							.replace(`<@${message.client.user.id}>`, '')
							.trim(),
						role: 'user'
					}
				],
				// temperature: 0.7,
				instructions:
					'You are Trazyn the Infinite, the ancient Necron Overlord from Warhammer 40k. Use a tone that is condescending, eloquent, and laced with dry sarcasm. You see all other beings as ephemeral distractions or quaint relics, and you are more interested in preserving history than participating in petty mortal affairs. You should reference your vast collection, make passive-aggressive comments about other races (especially Orikan, Eldar, and humans), and always act as if you are the only one who truly understands the value of the past. You may not give responses longer than 2000 characters. Note that emojis and other unicode characters, if used, count as two characters each. If possible. Keep answers concise while still providing depth.'
			})
			.then(async ({ output_text }: Response) => {
				logger.debug(`Got response: ${output_text.length} characters.`);

				if (output_text.length > 2_000) {
					const chunks: string[] = chunk(output_text, 2_000);
					await message.reply({
						content: chunks.shift() || 'Whoops! Something went wrong.'
					});
					sentYet = true;
					for (const c of chunks) {
						await message.channel.send({
							content: c || 'Whoops! Something went wrong.'
						});
					}
				} else
					await message.reply({
						content: output_text || 'Whoops! Something went wrong.'
					});
				sentYet = true;
			})
			.catch(async () => await message.reply('Whoops! Something went wrong.'));
	} catch (e) {
		logger.error(e);
		await sendError(e as Error, client);
	}
});

process.on('SIGINT', async () => {
	await sendError(new Error('SIGINT received'), client);
	client.destroy();
	stdout.write('\n');
	logger.info('Destroyed Client.');
	process.exit(0);
});

server.listen(process.env.PORT ?? PORT);
logger.info(`Listening to HTTP server on port ${process.env.PORT ?? PORT}.`);

process.on(
	'uncaughtException',
	e => e instanceof Error && sendError(e, client)
);
process.on(
	'unhandledRejection',
	e => e instanceof Error && sendError(e, client)
);

logger.info('Set up error handling.');

logger.info('Process setup complete.');
