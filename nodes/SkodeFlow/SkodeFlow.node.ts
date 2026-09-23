import type { INodeType, INodeTypeDescription } from 'n8n-workflow';
import { NodeConnectionTypes } from 'n8n-workflow';

/**
 * Skode Flow — send WhatsApp/Instagram/Facebook messages and manage contacts.
 *
 * Talks to the Partner Integration API (/api/partner/v1/…), NOT the Zapier
 * surface. That surface exists so partner traffic has its own rate limits and
 * its own attribution: requests carry X-Skode-Partner: n8n, and webhook
 * subscriptions are stamped with it, so integration history does not report
 * n8n work as Zapier.
 *
 * `NodeConnectionTypes.Main` rather than the string 'main' is deliberate:
 * @n8n/eslint-plugin-community-nodes (the ruleset the Creator Portal's
 * verification runs) rejects the string literal, while the older
 * eslint-plugin-n8n-nodes-base demanded it. The two contradict each other and
 * only the former gates verification.
 */
export class SkodeFlow implements INodeType {
	description: INodeTypeDescription = {
		displayName: 'Skode Flow',
		name: 'skodeFlow',
		icon: {
			light: 'file:skodeflow.light.svg',
			dark: 'file:skodeflow.dark.svg',
		},
		group: ['transform'],
		version: 1,
		subtitle: '={{$parameter["operation"] + ": " + $parameter["resource"]}}',
		description: 'Send messages and manage contacts in Skode Flow',
		usableAsTool: true,
		defaults: {
			name: 'Skode Flow',
		},
		inputs: [NodeConnectionTypes.Main],
		outputs: [NodeConnectionTypes.Main],
		credentials: [
			{
				name: 'skodeFlowOAuth2Api',
				required: true,
			},
		],
		requestDefaults: {
			baseURL: '={{$credentials.baseUrl}}/api/partner/v1',
			headers: {
				Accept: 'application/json',
				'Content-Type': 'application/json',
				// Attribution, declared rather than inferred. Flow stamps this on
				// anything this node creates.
				'X-Skode-Partner': 'n8n',
			},
		},
		properties: [
			{
				displayName: 'Resource',
				name: 'resource',
				type: 'options',
				noDataExpression: true,
				default: 'message',
				options: [
					{ name: 'Contact', value: 'contact' },
					{ name: 'Message', value: 'message' },
				],
			},

			// ── Message ────────────────────────────────────────────────────
			{
				displayName: 'Operation',
				name: 'operation',
				type: 'options',
				noDataExpression: true,
				displayOptions: { show: { resource: ['message'] } },
				default: 'send',
				options: [
					{
						name: 'Send',
						value: 'send',
						description: 'Send a free-form message',
						action: 'Send a message',
						routing: {
							request: { method: 'POST', url: '/messages/send/' },
						},
					},
					{
						name: 'Send Template',
						value: 'sendTemplate',
						description: 'Send an approved template. Required outside the 24-hour customer service window.',
						action: 'Send a template message',
						routing: {
							request: { method: 'POST', url: '/templates/send/' },
						},
					},
				],
			},
			{
				displayName: 'Recipient',
				name: 'recipient',
				type: 'string',
				required: true,
				default: '',
				placeholder: '+919876543210',
				displayOptions: {
					show: { resource: ['message'], operation: ['send', 'sendTemplate'] },
				},
				description: 'Phone number in international format, including country code',
				routing: { request: { body: { recipient: '={{$value}}' } } },
			},
			{
				displayName: 'Channel',
				name: 'channel',
				type: 'options',
				default: 'WHATSAPP',
				displayOptions: {
					show: { resource: ['message'], operation: ['send', 'sendTemplate'] },
				},
				options: [
					{ name: 'Facebook', value: 'FACEBOOK' },
					{ name: 'Instagram', value: 'INSTAGRAM' },
					{ name: 'WhatsApp', value: 'WHATSAPP' },
				],
				routing: { request: { body: { channel: '={{$value}}' } } },
			},
			{
				displayName: 'Text',
				name: 'text',
				type: 'string',
				required: true,
				default: '',
				typeOptions: { rows: 3 },
				displayOptions: { show: { resource: ['message'], operation: ['send'] } },
				description: 'Message body. Outside the 24-hour service window this is refused — send a template instead.',
				routing: { request: { body: { text: '={{$value}}' } } },
			},
			{
				displayName: 'Template Name',
				name: 'template',
				type: 'string',
				required: true,
				default: '',
				displayOptions: { show: { resource: ['message'], operation: ['sendTemplate'] } },
				description: 'Exact name of an approved template on your account',
				routing: { request: { body: { template: '={{$value}}' } } },
			},
			{
				displayName: 'Language Code',
				name: 'language',
				type: 'string',
				default: 'en',
				displayOptions: { show: { resource: ['message'], operation: ['sendTemplate'] } },
				description: 'Template language, e.g. en or en_US. Must match the approved template.',
				routing: { request: { body: { language: '={{$value}}' } } },
			},
			{
				displayName: 'Variables',
				name: 'variables',
				type: 'string',
				default: '',
				placeholder: 'Priya,#10234',
				displayOptions: { show: { resource: ['message'], operation: ['sendTemplate'] } },
				description:
					'Comma-separated values for the template placeholders, in order ({{1}}, {{2}}, …)',
				routing: {
					request: {
						body: {
							variables:
								'={{ $value ? $value.split(",").map(v => v.trim()) : [] }}',
						},
					},
				},
			},

			// ── Contact ────────────────────────────────────────────────────
			{
				displayName: 'Operation',
				name: 'operation',
				type: 'options',
				noDataExpression: true,
				displayOptions: { show: { resource: ['contact'] } },
				default: 'upsert',
				options: [
					{
						name: 'Create or Update',
						value: 'upsert',
						description: 'Create a new record, or update the current one if it already exists (upsert)',
						action: 'Create or update a contact',
						routing: { request: { method: 'POST', url: '/contacts/' } },
					},
					{
						name: 'Search',
						value: 'search',
						description: 'Find a contact by phone or email',
						action: 'Search for a contact',
						routing: { request: { method: 'GET', url: '/contacts/search/' } },
					},
				],
			},
			{
				displayName: 'Phone',
				name: 'phone',
				type: 'string',
				required: true,
				default: '',
				placeholder: '+919876543210',
				displayOptions: { show: { resource: ['contact'], operation: ['upsert'] } },
				description: 'Phone number in international format. This is the key the upsert matches on.',
				routing: { request: { body: { phone: '={{$value}}' } } },
			},
			{
				displayName: 'Additional Fields',
				name: 'additionalFields',
				type: 'collection',
				placeholder: 'Add Field',
				default: {},
				displayOptions: { show: { resource: ['contact'], operation: ['upsert'] } },
				options: [
					{
						displayName: 'Email',
						name: 'email',
						type: 'string',
						placeholder: 'name@email.com',
						default: '',
						routing: { request: { body: { email: '={{$value}}' } } },
					},
					{
						displayName: 'Name',
						name: 'name',
						type: 'string',
						default: '',
						routing: { request: { body: { name: '={{$value}}' } } },
					},
				],
			},
			{
				displayName: 'Search By',
				name: 'searchBy',
				type: 'options',
				default: 'phone',
				displayOptions: { show: { resource: ['contact'], operation: ['search'] } },
				options: [
					{ name: 'Email', value: 'email' },
					{ name: 'Phone', value: 'phone' },
				],
			},
			{
				displayName: 'Value',
				name: 'searchValue',
				type: 'string',
				required: true,
				default: '',
				displayOptions: { show: { resource: ['contact'], operation: ['search'] } },
				description: 'The phone number or email address to look for',
				routing: {
					request: {
						qs: {
							phone: '={{ $parameter["searchBy"] === "phone" ? $value : undefined }}',
							email: '={{ $parameter["searchBy"] === "email" ? $value : undefined }}',
						},
					},
				},
			},
		],
	};
}
