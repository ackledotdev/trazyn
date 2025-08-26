import { PermissionFlagsBits, PermissionsBitField } from 'discord.js';

export const clientId = 1409747422154063954;

export const permissionsBits = new PermissionsBitField().add(
	PermissionFlagsBits.AddReactions,
	PermissionFlagsBits.AttachFiles,
	PermissionFlagsBits.EmbedLinks,
	PermissionFlagsBits.ReadMessageHistory,
	PermissionFlagsBits.SendMessages,
	PermissionFlagsBits.SendMessagesInThreads,
	PermissionFlagsBits.ViewChannel
).bitfield;

export const PORT = 8000;

export const Devs = ['817214551740776400'];
