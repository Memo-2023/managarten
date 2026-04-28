import type { ModuleConfig } from '$lib/data/module-registry';

export const formsModuleConfig: ModuleConfig = {
	appId: 'forms',
	tables: [{ name: 'forms' }, { name: 'formResponses' }],
};
