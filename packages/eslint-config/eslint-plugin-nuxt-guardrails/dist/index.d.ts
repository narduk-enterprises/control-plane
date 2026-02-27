import * as eslint from 'eslint';

interface PluginOptions {
    strictness?: 'low' | 'medium' | 'high';
    projectStyle?: 'app-dir' | 'mixed' | 'legacy' | 'auto';
    allowProcessClientServer?: boolean;
    requireStableAsyncDataKeys?: boolean;
}

/**
 * ESLint plugin for Nuxt 4 guardrails
 */
declare const _default: {
    meta: {
        name: string;
        version: string;
    };
    rules: {
        'no-legacy-head': {
            meta: {
                type: string;
                docs: {
                    description: string;
                    category: string;
                    recommended: boolean;
                };
                fixable: string;
                schema: never[];
                messages: {
                    legacyHeadMethod: string;
                    legacyHeadOption: string;
                };
            };
            create(context: eslint.Rule.RuleContext<string, any[]>): eslint.Rule.RuleListener;
        };
        'no-legacy-fetch-hook': {
            meta: {
                type: string;
                docs: {
                    description: string;
                    category: string;
                    recommended: boolean;
                };
                schema: never[];
                messages: {
                    legacyFetch: string;
                };
            };
            create(context: eslint.Rule.RuleContext<string, any[]>): eslint.Rule.RuleListener;
        };
        'prefer-import-meta-client': {
            meta: {
                type: string;
                docs: {
                    description: string;
                    category: string;
                    recommended: boolean;
                };
                fixable: string;
                schema: {
                    type: string;
                    properties: {
                        allowProcessClientServer: {
                            type: string;
                            default: boolean;
                        };
                    };
                    additionalProperties: boolean;
                }[];
                messages: {
                    preferImportMetaClient: string;
                    preferImportMetaServer: string;
                };
            };
            create(context: eslint.Rule.RuleContext<string, PluginOptions[]>): eslint.Rule.RuleListener;
        };
        'no-ssr-dom-access': {
            meta: {
                type: string;
                docs: {
                    description: string;
                    category: string;
                    recommended: boolean;
                };
                schema: never[];
                messages: {
                    unguardedDomAccess: string;
                };
            };
            create(context: eslint.Rule.RuleContext<string, any[]>): eslint.Rule.RuleListener;
        };
        'valid-useAsyncData': {
            meta: {
                type: string;
                docs: {
                    description: string;
                    category: string;
                    recommended: boolean;
                };
                schema: {
                    type: string;
                    properties: {
                        requireStableAsyncDataKeys: {
                            type: string;
                            default: boolean;
                        };
                    };
                    additionalProperties: boolean;
                }[];
                messages: {
                    missingCallback: string;
                    missingKey: string;
                    keyNotLiteral: string;
                    callbackReturnsNothing: string;
                };
            };
            create(context: eslint.Rule.RuleContext<string, PluginOptions[]>): eslint.Rule.RuleListener;
        };
        'valid-useFetch': {
            meta: {
                type: string;
                docs: {
                    description: string;
                    category: string;
                    recommended: boolean;
                };
                schema: never[];
                messages: {
                    missingUrl: string;
                    invalidOptions: string;
                };
            };
            create(context: eslint.Rule.RuleContext<string, any[]>): eslint.Rule.RuleListener;
        };
        'app-structure-consistency': {
            meta: {
                type: string;
                docs: {
                    description: string;
                    category: string;
                    recommended: boolean;
                };
                schema: {
                    type: string;
                    properties: {
                        projectStyle: {
                            type: string;
                            enum: string[];
                            default: string;
                        };
                    };
                    additionalProperties: boolean;
                }[];
                messages: {
                    conflictingStructure: string;
                };
            };
            create(context: eslint.Rule.RuleContext<string, PluginOptions[]>): eslint.Rule.RuleListener;
        };
    };
    configs: {
        recommended: {
            plugins: string[];
            rules: {
                'nuxt-guardrails/no-legacy-head': string;
                'nuxt-guardrails/no-legacy-fetch-hook': string;
                'nuxt-guardrails/prefer-import-meta-client': string;
                'nuxt-guardrails/no-ssr-dom-access': string;
                'nuxt-guardrails/valid-useAsyncData': string;
                'nuxt-guardrails/valid-useFetch': string;
                'nuxt-guardrails/app-structure-consistency': string;
            };
        };
    };
};

export { _default as default };
