import type { ICredentialType, INodeProperties } from 'n8n-workflow';

/**
 * OAuth2 against Skode's central identity provider (auth.skode.ai) — the same
 * server the Skode Flow Zapier integration authenticates with.
 *
 *   authorize: https://auth.skode.ai/o/authorize/
 *   token:     https://auth.skode.ai/o/token/
 *
 * Two deliberate differences from the Skode CRM node's credential:
 *
 * 1. The OAuth host is FIXED, not derived from the API base URL. Flow's
 *    identity lives at auth.skode.ai while its API lives at
 *    flowserver.skode.ai, so deriving one from the other — which is what the
 *    CRM credential does — would point the browser at an authorize endpoint
 *    that does not exist.
 * 2. PKCE is REQUIRED. auth.skode.ai runs with PKCE_REQUIRED, so an
 *    authorization-code grant without a code challenge is rejected at the
 *    token step, after the user has already approved — which reads to them as
 *    "it just failed at the end".
 *
 * The redirect URL n8n shows on this credential must be registered on the
 * OAuth application:
 *   n8n Cloud:   https://oauth.n8n.cloud/oauth2/callback
 *   self-hosted: https://<your-n8n>/rest/oauth2-credential/callback
 */
export class SkodeFlowOAuth2Api implements ICredentialType {
	name = 'skodeFlowOAuth2Api';

	extends = ['oAuth2Api'];

	// Themed variants so the mark reads correctly on light and dark canvases.
	icon = {
		light: 'file:../nodes/SkodeFlow/skodeflow.light.svg',
		dark: 'file:../nodes/SkodeFlow/skodeflow.dark.svg',
	} as const;

	displayName = 'Skode Flow OAuth2 API';

	documentationUrl = 'https://skode.ai';

	properties: INodeProperties[] = [
		{
			displayName: 'Flow API Base URL',
			name: 'baseUrl',
			type: 'string',
			default: 'https://flowserver.skode.ai',
			required: true,
			description:
				'Your Skode Flow API origin, no trailing slash. Sign-in happens at auth.skode.ai regardless of this value.',
		},
		{
			displayName: 'Identity Provider URL',
			name: 'authBaseUrl',
			type: 'string',
			default: 'https://auth.skode.ai',
			required: true,
			description:
				'Where you sign in. Change this only for a self-hosted Skode identity server.',
		},
		{
			// PKCE, not plain authorizationCode: auth.skode.ai rejects a code
			// exchange with no verifier, and it does so AFTER consent.
			displayName: 'Grant Type',
			name: 'grantType',
			type: 'hidden',
			default: 'pkce',
		},
		{
			displayName: 'Authorization URL',
			name: 'authUrl',
			type: 'hidden',
			default: '={{$self["authBaseUrl"]}}/o/authorize/',
		},
		{
			displayName: 'Access Token URL',
			name: 'accessTokenUrl',
			type: 'hidden',
			default: '={{$self["authBaseUrl"]}}/o/token/',
		},
		{
			displayName: 'Scope',
			name: 'scope',
			type: 'hidden',
			default: 'openid profile email org',
		},
		{
			displayName: 'Auth URI Query Parameters',
			name: 'authQueryParameters',
			type: 'hidden',
			default: '',
		},
		{
			// django-oauth-toolkit accepts the client secret in the POST body.
			displayName: 'Authentication',
			name: 'authentication',
			type: 'hidden',
			default: 'body',
		},
	];
}
