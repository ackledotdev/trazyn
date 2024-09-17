import {
	ButtonInteraction,
	ChatInputCommandInteraction,
	SlashCommandBuilder
} from 'discord.js';
import { CommandHelpEntry } from '../CommandHelpEntry';

export interface Event {
	name: string;
	once: boolean;
	execute: (...args: unknown[]) => Promise<unknown>;
}

export interface Command {
	data: SlashCommandBuilder;
	help?: CommandHelpEntry;
	execute: (interaction: ChatInputCommandInteraction) => Promise<unknown>;
}

export interface Button {
	execute: (interaction: ButtonInteraction) => Promise<unknown>;
	customId: string;
}
