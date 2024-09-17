import 'dotenv/config';
import { ActivityType, Events, PresenceUpdateStatus } from 'discord.js';
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

argv.shift();
argv.shift();
if (argv.includes('-d')) {
	logger.level = 'debug';
	logger.debug('Debug mode enabled.');
}

logger.info('Opened database.');

const client = new CommandClient({
	intents: [],
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
	}
);
logger.debug('Created server instance.');

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

client
	.on(Events.ClientReady, () => logger.info('Client#ready'))
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
	.on(Events.Debug, m => logger.debug(m))
	.on(Events.Error, m => logger.error(m))
	.on(Events.Warn, m => logger.warn(m));
logger.debug('Set up client events.');

await client
	.login(process.env.DISCORD_TOKEN)
	.then(() => logger.info('Logged in.'));

process.on('SIGINT', () => {
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
