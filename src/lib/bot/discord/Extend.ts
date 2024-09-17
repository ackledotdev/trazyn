import { Client, ClientOptions } from 'discord.js';
import { Collection, ReadonlyCollection } from '@discordjs/collection';
import { Command, Button } from './types';

class ExtendedCollection<K, V> extends Collection<K, V> {
	constructor(entries?: readonly (readonly [K, V])[] | null) {
		super(entries);
	}
	public freeze(): ReadonlyCollection<K, V> {
		return Object.freeze(this);
	}
}

export class CommandClient extends Client {
	commands: ExtendedCollection<string, Command>;
	buttons: ExtendedCollection<string, Button>;

	constructor(options: ClientOptions) {
		super(options);

		this.commands = new ExtendedCollection<string, Command>();

		this.buttons = new ExtendedCollection<string, Button>();
	}
}
