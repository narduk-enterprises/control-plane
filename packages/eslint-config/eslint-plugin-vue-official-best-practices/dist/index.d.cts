import * as eslint from 'eslint';

/**
 * ESLint plugin for Vue 3 official best practices
 */
declare const _default: {
    meta: {
        name: string;
        version: string;
    };
    rules: {
        'require-script-setup': {
            meta: {
                type: string;
                docs: {
                    description: string;
                    category: string;
                    recommended: boolean;
                    url: string;
                };
                schema: {
                    type: string;
                    properties: {
                        allowOptionsApi: {
                            type: string;
                        };
                    };
                    additionalProperties: boolean;
                }[];
                messages: {
                    preferScriptSetup: string;
                };
            };
            create(context: eslint.RuleContext<string, any[]>): eslint.RuleListener;
        };
        'no-setup-top-level-side-effects': {
            meta: {
                type: string;
                docs: {
                    description: string;
                    category: string;
                    recommended: boolean;
                    url: string;
                };
                schema: never[];
                messages: {
                    noTopLevelSideEffect: string;
                    useNuxtComposable: string;
                };
            };
            create(context: eslint.RuleContext<string, any[]>): eslint.RuleListener;
        };
        'no-async-computed-getter': {
            meta: {
                type: string;
                docs: {
                    description: string;
                    category: string;
                    recommended: boolean;
                    url: string;
                };
                schema: never[];
                messages: {
                    noAsyncComputed: string;
                };
            };
            create(context: eslint.RuleContext<string, any[]>): eslint.RuleListener;
        };
        'prefer-shallow-watch': {
            meta: {
                type: string;
                docs: {
                    description: string;
                    category: string;
                    recommended: boolean;
                    url: string;
                };
                schema: {
                    type: string;
                    properties: {
                        strict: {
                            type: string;
                        };
                    };
                    additionalProperties: boolean;
                }[];
                messages: {
                    preferShallowWatch: string;
                };
            };
            create(context: eslint.RuleContext<string, any[]>): eslint.RuleListener;
        };
        'no-template-complex-expressions': {
            meta: {
                type: string;
                docs: {
                    description: string;
                    category: string;
                    recommended: boolean;
                    url: string;
                };
                schema: {
                    type: string;
                    properties: {
                        maxTernaryDepth: {
                            type: string;
                            default: number;
                        };
                        maxLogicalOps: {
                            type: string;
                            default: number;
                        };
                        allowedFunctions: {
                            type: string;
                            items: {
                                type: string;
                            };
                        };
                    };
                    additionalProperties: boolean;
                }[];
                messages: {
                    complexExpression: string;
                };
            };
            create(context: eslint.RuleContext<string, any[]>): eslint.RuleListener;
        };
        'consistent-defineprops-emits': {
            meta: {
                type: string;
                docs: {
                    description: string;
                    category: string;
                    recommended: boolean;
                    url: string;
                };
                schema: never[];
                messages: {
                    multipleDefineProps: string;
                    multipleDefineEmits: string;
                    notTopLevel: string;
                };
            };
            create(context: eslint.RuleContext<string, any[]>): eslint.RuleListener;
        };
        'prefer-typed-defineprops': {
            meta: {
                type: string;
                docs: {
                    description: string;
                    category: string;
                    recommended: boolean;
                    url: string;
                };
                schema: never[];
                messages: {
                    preferTypedProps: string;
                };
            };
            create(context: eslint.RuleContext<string, any[]>): eslint.RuleListener;
        };
        'require-use-prefix-for-composables': {
            meta: {
                type: string;
                docs: {
                    description: string;
                    category: string;
                    recommended: boolean;
                    url: string;
                };
                schema: {
                    type: string;
                    properties: {
                        paths: {
                            type: string;
                            items: {
                                type: string;
                            };
                        };
                    };
                    additionalProperties: boolean;
                }[];
                messages: {
                    requireUsePrefix: string;
                };
            };
            create(context: eslint.RuleContext<string, any[]>): eslint.RuleListener;
        };
        'no-composable-conditional-hooks': {
            meta: {
                type: string;
                docs: {
                    description: string;
                    category: string;
                    recommended: boolean;
                    url: string;
                };
                schema: never[];
                messages: {
                    conditionalHook: string;
                };
            };
            create(context: eslint.RuleContext<string, any[]>): eslint.RuleListener;
        };
        'no-composable-dom-access-without-client-guard': {
            meta: {
                type: string;
                docs: {
                    description: string;
                    category: string;
                    recommended: boolean;
                    url: string;
                };
                schema: {
                    type: string;
                    properties: {
                        allowProcessClient: {
                            type: string;
                        };
                    };
                    additionalProperties: boolean;
                }[];
                messages: {
                    noClientGuard: string;
                };
            };
            create(context: eslint.RuleContext<string, any[]>): eslint.RuleListener;
        };
        'pinia-require-defineStore-id': {
            meta: {
                type: string;
                docs: {
                    description: string;
                    category: string;
                    recommended: boolean;
                    url: string;
                };
                schema: never[];
                messages: {
                    requireStoreId: string;
                };
            };
            create(context: eslint.RuleContext<string, any[]>): eslint.RuleListener;
        };
        'pinia-no-direct-state-mutation-outside-actions': {
            meta: {
                type: string;
                docs: {
                    description: string;
                    category: string;
                    recommended: boolean;
                    url: string;
                };
                schema: {
                    type: string;
                    properties: {
                        strict: {
                            type: string;
                        };
                    };
                    additionalProperties: boolean;
                }[];
                messages: {
                    noDirectMutation: string;
                };
            };
            create(context: eslint.RuleContext<string, any[]>): eslint.RuleListener;
        };
        'pinia-prefer-storeToRefs-destructure': {
            meta: {
                type: string;
                docs: {
                    description: string;
                    category: string;
                    recommended: boolean;
                    url: string;
                };
                schema: never[];
                fixable: string;
                messages: {
                    preferStoreToRefs: string;
                };
            };
            create(context: eslint.RuleContext<string, any[]>): eslint.RuleListener;
        };
    };
    configs: {
        recommended: {
            plugins: string[];
            rules: {
                'vue-official/require-script-setup': string;
                'vue-official/no-setup-top-level-side-effects': string;
                'vue-official/no-async-computed-getter': string;
                'vue-official/prefer-shallow-watch': string;
                'vue-official/no-template-complex-expressions': string;
                'vue-official/consistent-defineprops-emits': string;
                'vue-official/prefer-typed-defineprops': string;
                'vue-official/require-use-prefix-for-composables': string;
                'vue-official/no-composable-conditional-hooks': string;
                'vue-official/no-composable-dom-access-without-client-guard': string;
                'vue-official/pinia-require-defineStore-id': string;
                'vue-official/pinia-no-direct-state-mutation-outside-actions': string;
                'vue-official/pinia-prefer-storeToRefs-destructure': string;
            };
        };
        strict: {
            plugins: string[];
            rules: {
                'vue-official/require-script-setup': string;
                'vue-official/no-setup-top-level-side-effects': string;
                'vue-official/no-async-computed-getter': string;
                'vue-official/prefer-shallow-watch': string;
                'vue-official/no-template-complex-expressions': string;
                'vue-official/consistent-defineprops-emits': string;
                'vue-official/prefer-typed-defineprops': string;
                'vue-official/require-use-prefix-for-composables': string;
                'vue-official/no-composable-conditional-hooks': string;
                'vue-official/no-composable-dom-access-without-client-guard': string;
                'vue-official/pinia-require-defineStore-id': string;
                'vue-official/pinia-no-direct-state-mutation-outside-actions': string;
                'vue-official/pinia-prefer-storeToRefs-destructure': string;
            };
        };
    };
};

export { _default as default };
