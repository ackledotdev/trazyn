import OpenAI from 'openai';
import { Constants } from '.';

const OpenAIClient = new OpenAI();

export const Assistant = await OpenAIClient.beta.assistants.create({
	model: Constants.Model,
	name: Constants.FriendlyName,
	description: Constants.Description,
	instructions: Constants.Instructions,
	tools: [
		{
			type: 'file_search'
		}
	],
	tool_resources: {
		file_search: {
			vector_store_ids: [Constants.VectorStoreId]
		}
	}
});

export async function createThread() {
	return await OpenAIClient.beta.threads.create();
}

export async function createMessage(threadId: string, content: string) {
	return await OpenAIClient.beta.threads.messages.create(threadId, {
		content,
		role: 'user'
	});
}

export async function runStream(threadId: string, assistantId: string) {
	OpenAIClient.beta.threads.runs
		.stream(threadId, {
			assistant_id: assistantId
		})
		.on('textCreated', text => console.log('\nassistant > '))
		.on('textDelta', textDelta => console.log)
		.on('toolCallCreated', toolCall =>
			console.log(`\nassistant > ${toolCall.type}\n\n`)
		)
		.on('toolCallDelta', (toolCallDelta, snapshot) => {});
}
