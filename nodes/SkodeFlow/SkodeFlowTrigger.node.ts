import type {
	IHookFunctions,
	INodeType,
	INodeTypeDescription,
	IWebhookFunctions,
	IWebhookResponseData,
} from 'n8n-workflow';
import { NodeConnectionTypes } from 'n8n-workflow';

/**
 * Skode Flow Trigger — starts a workflow when something happens in the inbox.
 *
 * Registers n8n's webhook URL with Flow on activate and removes it on
 * deactivate, so there is no polling:
 *   POST   /api/partner/v1/hooks/        { target_url, event }  -> subscription
 *   DELETE /api/partner/v1/hooks/<id>/
 *
 * The create response carries a signing secret, returned exactly once. Flow
 * signs each delivery with it (X-Webhook-Signature), which is what stops
 * anyone who learns the n8n webhook URL from forging events at it.
 */
export class SkodeFlowTrigger implements INodeType {
	description: INodeTypeDescription = {
		displayName: 'Skode Flow Trigger',
		name: 'skodeFlowTrigger',
		icon: {
			light: 'file:skodeflow.light.svg',
			dark: 'file:skodeflow.dark.svg',
		},
		group: ['trigger'],
		version: 1,
		subtitle: '={{$parameter["event"]}}',
		description: 'Starts a workflow on a Skode Flow inbox event',
		defaults: {
			name: 'Skode Flow Trigger',
		},
		inputs: [],
		outputs: [NodeConnectionTypes.Main],
		credentials: [
			{
				name: 'skodeFlowOAuth2Api',
				required: true,
			},
		],
		webhooks: [
			{
				name: 'default',
				httpMethod: 'POST',
				responseMode: 'onReceived',
				path: 'webhook',
			},
		],
		properties: [
			{
				displayName: 'Event',
				name: 'event',
				type: 'options',
				noDataExpression: true,
				default: 'message.received',
				options: [
					{
						name: 'Conversation Created',
						value: 'conversation.created',
						description: 'A new conversation was opened',
					},
					{
						name: 'Conversation Reopened',
						value: 'conversation.reopened',
						description: 'A resolved conversation received a new message',
					},
					{
						name: 'Message Received',
						value: 'message.received',
						description: 'A customer sent a message on any connected channel',
					},
					{
						name: 'SLA Breached',
						value: 'sla.breached',
						description: 'A conversation passed its response-time target',
					},
				],
				description: 'Which Flow event starts this workflow',
			},
		],
	};

	// n8n calls these to manage the Flow-side subscription lifecycle.
	webhookMethods = {
		default: {
			async checkExists(this: IHookFunctions): Promise<boolean> {
				const webhookData = this.getWorkflowStaticData('node');
				return webhookData.subscriptionId !== undefined;
			},

			async create(this: IHookFunctions): Promise<boolean> {
				const webhookUrl = this.getNodeWebhookUrl('default');
				const event = this.getNodeParameter('event') as string;
				const credentials = await this.getCredentials('skodeFlowOAuth2Api');
				const baseUrl = (credentials.baseUrl as string).replace(/\/$/, '');

				const response = await this.helpers.httpRequestWithAuthentication.call(
					this,
					'skodeFlowOAuth2Api',
					{
						method: 'POST',
						url: `${baseUrl}/api/partner/v1/hooks/`,
						body: { target_url: webhookUrl, event },
						headers: { 'X-Skode-Partner': 'n8n' },
						json: true,
					},
				);

				const id = (response as { id?: number | string })?.id;
				if (id === undefined) {
					return false;
				}
				const webhookData = this.getWorkflowStaticData('node');
				webhookData.subscriptionId = id;
				return true;
			},

			async delete(this: IHookFunctions): Promise<boolean> {
				const webhookData = this.getWorkflowStaticData('node');
				if (webhookData.subscriptionId === undefined) {
					return true;
				}
				const credentials = await this.getCredentials('skodeFlowOAuth2Api');
				const baseUrl = (credentials.baseUrl as string).replace(/\/$/, '');
				try {
					await this.helpers.httpRequestWithAuthentication.call(
						this,
						'skodeFlowOAuth2Api',
						{
							method: 'DELETE',
							url: `${baseUrl}/api/partner/v1/hooks/${webhookData.subscriptionId}/`,
							headers: { 'X-Skode-Partner': 'n8n' },
							json: true,
						},
					);
				} catch (error) {
					// A delete that fails because the subscription is already gone
					// is fine, but we must not pretend nothing happened: log it so
					// a genuine failure (expired credential, Flow unreachable) is
					// visible rather than silently leaving a live subscription
					// posting to a dead n8n URL.
					this.logger.warn(
						`Skode Flow Trigger: could not remove webhook subscription ${webhookData.subscriptionId}: ${
							(error as Error)?.message ?? error
						}`,
					);
				}
				delete webhookData.subscriptionId;
				return true;
			},
		},
	};

	async webhook(this: IWebhookFunctions): Promise<IWebhookResponseData> {
		const body = this.getBodyData();
		return {
			workflowData: [this.helpers.returnJsonArray([body as never])],
		};
	}
}
