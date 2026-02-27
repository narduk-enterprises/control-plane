import { existsSync, readFileSync } from 'fs';
import { join } from 'path';

// src/utils/vue-docs-urls.ts
var VUE_BEST_PRACTICES = "https://vuejs.org/guide/best-practices/overview.html";
var VUE_STYLE_GUIDE = "https://vuejs.org/style-guide/";
var VUE_COMPOSITION_API = "https://vuejs.org/guide/extras/composition-api-faq.html";
var VUE_SSR_GUIDE = "https://vuejs.org/guide/scaling-up/ssr.html";
var VUE_TYPESCRIPT_GUIDE = "https://vuejs.org/guide/typescript/overview.html";
var PINIA_DOCS = "https://pinia.vuejs.org/";

// src/rules/require-script-setup.ts
var require_script_setup_default = {
  meta: {
    type: "suggestion",
    docs: {
      description: "prefer <script setup> over Options API",
      category: "Best Practices",
      recommended: true,
      url: VUE_STYLE_GUIDE
    },
    schema: [
      {
        type: "object",
        properties: {
          allowOptionsApi: {
            type: "boolean"
          }
        },
        additionalProperties: false
      }
    ],
    messages: {
      preferScriptSetup: "Prefer <script setup> over Options API. See: {{url}}"
    }
  },
  create(context) {
    const parserServices = context.sourceCode?.parserServices ?? context.parserServices;
    const options = context.options[0] || {};
    const allowOptionsApi = options.allowOptionsApi !== false;
    if (!parserServices || !parserServices.defineTemplateBodyVisitor) {
      return {};
    }
    return parserServices.defineTemplateBodyVisitor(
      {},
      {
        // Check for export default with component options
        "ExportDefaultDeclaration"(node) {
          if (allowOptionsApi) {
            return;
          }
          if (node.declaration && node.declaration.type === "ObjectExpression") {
            const hasComponentOptions = node.declaration.properties.some(
              (prop) => {
                const key = prop.key?.name || prop.key?.value;
                return [
                  "data",
                  "methods",
                  "computed",
                  "watch",
                  "props",
                  "emits",
                  "setup"
                  // Options API can have setup too
                ].includes(key);
              }
            );
            if (hasComponentOptions) {
              context.report({
                node,
                messageId: "preferScriptSetup",
                data: { url: VUE_STYLE_GUIDE }
              });
            }
          }
        }
      }
    );
  }
};

// src/utils/ast-utils.ts
function isImportMetaClient(node) {
  return node.type === "MemberExpression" && node.object && node.object.type === "MetaProperty" && node.object.meta && node.object.meta.name === "import" && node.object.property && node.object.property.name === "meta" && node.property && node.property.name === "client";
}
function isImportMetaServer(node) {
  return node.type === "MemberExpression" && node.object && node.object.type === "MetaProperty" && node.object.meta && node.object.meta.name === "import" && node.object.property && node.object.property.name === "meta" && node.property && node.property.name === "server";
}
function isProcessClient(node) {
  return node.type === "MemberExpression" && node.object && node.object.type === "Identifier" && node.object.name === "process" && node.property && node.property.name === "client";
}
function isDomAccess(node) {
  if (node.type !== "MemberExpression" && node.type !== "Identifier") {
    return { type: null, member: null };
  }
  if (node.type === "Identifier") {
    if (node.parent && node.parent.type === "MemberExpression" && node.parent.object === node) {
      return { type: null, member: null };
    }
    if (node.name === "window") {
      return { type: "window", member: null };
    }
    if (node.name === "document") {
      return { type: "document", member: null };
    }
    if (node.name === "localStorage") {
      return { type: "localStorage", member: null };
    }
    return { type: null, member: null };
  }
  if (node.object && node.object.type === "Identifier" && node.object.name === "window") {
    return {
      type: "window",
      member: node.property && node.property.name ? node.property.name : null
    };
  }
  if (node.object && node.object.type === "Identifier" && node.object.name === "document") {
    return {
      type: "document",
      member: node.property && node.property.name ? node.property.name : null
    };
  }
  if (node.object && node.object.type === "Identifier" && node.object.name === "localStorage") {
    return {
      type: "localStorage",
      member: node.property && node.property.name ? node.property.name : null
    };
  }
  return { type: null, member: null };
}
function isInClientContext(node, context) {
  let current = node.parent;
  while (current) {
    if (current.type === "IfStatement" && current.test && (isImportMetaClient(current.test) || isImportMetaServer(current.test))) {
      return isImportMetaClient(current.test);
    }
    if (current.type === "IfStatement" && current.test && current.test.type === "UnaryExpression" && current.test.operator === "!" && isImportMetaClient(current.test.argument)) {
      return true;
    }
    if (current.type === "IfStatement" && current.test && isProcessClient(current.test)) {
      return true;
    }
    if (current.type === "CallExpression" && current.callee && (current.callee.name === "onMounted" || current.callee.name === "onUnmounted" || current.callee.name === "onBeforeUnmount" || current.callee.name === "onUpdated" || current.callee.name === "onBeforeUpdate")) {
      return true;
    }
    current = current.parent;
  }
  return false;
}
function isLiteral(node) {
  return node.type === "Literal" || node.type === "TemplateLiteral" || node.type === "Identifier" && node.name && !node.name.includes("$");
}
function isTopLevel(node) {
  let current = node.parent;
  while (current) {
    if (current.type === "BlockStatement" || current.type === "IfStatement" || current.type === "ForStatement" || current.type === "ForInStatement" || current.type === "ForOfStatement" || current.type === "WhileStatement" || current.type === "SwitchStatement" || current.type === "TryStatement" || current.type === "CatchClause" || current.type === "FunctionDeclaration" || current.type === "FunctionExpression" || current.type === "ArrowFunctionExpression" || current.type === "ClassDeclaration" || current.type === "ClassExpression" || current.type === "MethodDefinition") {
      return false;
    }
    if (current.type === "Program") {
      return true;
    }
    current = current.parent;
  }
  return false;
}
var nuxtCache = null;
var cacheKey = null;
function isNuxtMode(context) {
  const cwd = context.getCwd();
  if (cacheKey === cwd && nuxtCache !== null) {
    return nuxtCache;
  }
  cacheKey = cwd;
  const nuxtConfigFiles = [
    "nuxt.config.ts",
    "nuxt.config.js",
    "nuxt.config.mjs"
  ];
  for (const configFile of nuxtConfigFiles) {
    if (existsSync(join(cwd, configFile))) {
      nuxtCache = true;
      return true;
    }
  }
  try {
    const packageJsonPath = join(cwd, "package.json");
    if (existsSync(packageJsonPath)) {
      const packageJson = JSON.parse(readFileSync(packageJsonPath, "utf-8"));
      const deps = {
        ...packageJson.dependencies,
        ...packageJson.devDependencies
      };
      if (deps.nuxt || deps["@nuxt/core"] || deps["@nuxt/kit"]) {
        nuxtCache = true;
        return true;
      }
    }
  } catch {
  }
  nuxtCache = false;
  return false;
}
function isAllowedNuxtComposable(name) {
  const allowedComposables = [
    "useFetch",
    "useAsyncData",
    "useState",
    "useCookie",
    "navigateTo",
    "useRoute",
    "useRouter",
    "useHead",
    "useNuxtApp",
    "useRuntimeConfig",
    "useRequestHeaders",
    "useRequestEvent",
    "useRequestURL"
  ];
  return allowedComposables.includes(name);
}

// src/rules/no-setup-top-level-side-effects.ts
var no_setup_top_level_side_effects_default = {
  meta: {
    type: "problem",
    docs: {
      description: "disallow top-level side effects in <script setup>",
      category: "Best Practices",
      recommended: true,
      url: VUE_SSR_GUIDE
    },
    schema: [],
    messages: {
      noTopLevelSideEffect: "Avoid top-level side effects in <script setup>. Move to lifecycle hook or user interaction handler. See: {{url}}",
      useNuxtComposable: "Use useFetch() or useAsyncData() instead of fetch() for SSR compatibility. See: {{url}}"
    }
  },
  create(context) {
    const parserServices = context.sourceCode?.parserServices ?? context.parserServices;
    const isNuxt = isNuxtMode(context);
    if (!parserServices || !parserServices.defineTemplateBodyVisitor) {
      return {};
    }
    const checkSideEffect = (node) => {
      if (!isTopLevel(node)) {
        return;
      }
      if (isInClientContext(node)) {
        return;
      }
      if (isNuxt && node.type === "CallExpression" && node.callee && node.callee.type === "Identifier" && isAllowedNuxtComposable(node.callee.name)) {
        return;
      }
      if (node.type === "CallExpression" && node.callee && node.callee.type === "Identifier" && node.callee.name === "fetch") {
        context.report({
          node,
          messageId: isNuxt ? "useNuxtComposable" : "noTopLevelSideEffect",
          data: { url: VUE_SSR_GUIDE }
        });
        return;
      }
      if (node.type === "CallExpression" && node.callee && node.callee.type === "Identifier" && (node.callee.name === "setInterval" || node.callee.name === "setTimeout")) {
        context.report({
          node,
          messageId: "noTopLevelSideEffect",
          data: { url: VUE_SSR_GUIDE }
        });
        return;
      }
      if (node.type === "CallExpression" && node.callee && node.callee.type === "MemberExpression" && node.callee.property && node.callee.property.name === "addEventListener") {
        context.report({
          node,
          messageId: "noTopLevelSideEffect",
          data: { url: VUE_SSR_GUIDE }
        });
        return;
      }
      const domAccess = isDomAccess(node);
      if (domAccess.type) {
        context.report({
          node,
          messageId: "noTopLevelSideEffect",
          data: { url: VUE_SSR_GUIDE }
        });
        return;
      }
    };
    return parserServices.defineTemplateBodyVisitor(
      {},
      {
        "CallExpression": checkSideEffect,
        "MemberExpression": checkSideEffect,
        "Identifier": checkSideEffect
      }
    );
  }
};

// src/rules/no-async-computed-getter.ts
var no_async_computed_getter_default = {
  meta: {
    type: "problem",
    docs: {
      description: "disallow async computed getters",
      category: "Best Practices",
      recommended: true,
      url: VUE_COMPOSITION_API
    },
    schema: [],
    messages: {
      noAsyncComputed: "Computed properties should not be async. Use watchEffect/watch + ref, or useFetch/useAsyncData for data fetching. See: {{url}}"
    }
  },
  create(context) {
    const parserServices = context.sourceCode?.parserServices ?? context.parserServices;
    if (!parserServices || !parserServices.defineTemplateBodyVisitor) {
      return {};
    }
    return parserServices.defineTemplateBodyVisitor(
      {},
      {
        "CallExpression"(node) {
          if (node.callee && node.callee.type === "Identifier" && node.callee.name === "computed" && node.arguments.length > 0) {
            const firstArg = node.arguments[0];
            if (firstArg.type === "ArrowFunctionExpression" && firstArg.async === true) {
              context.report({
                node,
                messageId: "noAsyncComputed",
                data: { url: VUE_COMPOSITION_API }
              });
              return;
            }
            if ((firstArg.type === "FunctionExpression" || firstArg.type === "FunctionDeclaration") && firstArg.async === true) {
              context.report({
                node,
                messageId: "noAsyncComputed",
                data: { url: VUE_COMPOSITION_API }
              });
            }
          }
        }
      }
    );
  }
};

// src/rules/prefer-shallow-watch.ts
var prefer_shallow_watch_default = {
  meta: {
    type: "suggestion",
    docs: {
      description: "prefer shallow watch over deep watch",
      category: "Performance",
      recommended: true,
      url: VUE_BEST_PRACTICES
    },
    schema: [
      {
        type: "object",
        properties: {
          strict: {
            type: "boolean"
          }
        },
        additionalProperties: false
      }
    ],
    messages: {
      preferShallowWatch: "Avoid deep watches when possible for performance. Use /* vue-official allow-deep-watch */ to suppress. See: {{url}}"
    }
  },
  create(context) {
    const parserServices = context.sourceCode?.parserServices ?? context.parserServices;
    const options = context.options[0] || {};
    const strict2 = options.strict !== false;
    if (!parserServices || !parserServices.defineTemplateBodyVisitor) {
      return {};
    }
    const checkForDeepWatch = (node) => {
      if (node.type === "CallExpression" && node.callee && node.callee.type === "Identifier" && (node.callee.name === "watch" || node.callee.name === "watchEffect")) {
        const optionsArg = node.arguments[node.arguments.length - 1];
        if (optionsArg && optionsArg.type === "ObjectExpression") {
          const hasDeep = optionsArg.properties.some((prop) => {
            const key = prop.key?.name || prop.key?.value;
            return key === "deep" && prop.value?.value === true;
          });
          if (hasDeep) {
            const sourceCode = context.getSourceCode();
            const comments = sourceCode.getCommentsBefore(node);
            const hasSuppression = comments.some(
              (comment) => comment.value.includes("vue-official allow-deep-watch")
            );
            if (!hasSuppression && strict2) {
              context.report({
                node,
                messageId: "preferShallowWatch",
                data: { url: VUE_BEST_PRACTICES }
              });
            }
          }
        }
      }
    };
    return parserServices.defineTemplateBodyVisitor(
      {},
      {
        "CallExpression": checkForDeepWatch
      }
    );
  }
};

// src/rules/no-template-complex-expressions.ts
var DEFAULT_WHITELIST = [
  "formatPrice",
  "formatChange",
  "formatPercent",
  "formatDate",
  "formatCurrency",
  "formatNumber",
  "toLocaleString",
  "toString",
  "toFixed"
];
var no_template_complex_expressions_default = {
  meta: {
    type: "suggestion",
    docs: {
      description: "disallow complex expressions in templates",
      category: "Best Practices",
      recommended: true,
      url: VUE_STYLE_GUIDE
    },
    schema: [
      {
        type: "object",
        properties: {
          maxTernaryDepth: {
            type: "number",
            default: 1
          },
          maxLogicalOps: {
            type: "number",
            default: 3
          },
          allowedFunctions: {
            type: "array",
            items: { type: "string" }
          }
        },
        additionalProperties: false
      }
    ],
    messages: {
      complexExpression: "Template expression is too complex. Move to computed property or method. See: {{url}}"
    }
  },
  create(context) {
    const parserServices = context.sourceCode?.parserServices ?? context.parserServices;
    const options = context.options[0] || {};
    const maxTernaryDepth = options.maxTernaryDepth ?? 1;
    const maxLogicalOps = options.maxLogicalOps ?? 3;
    const allowedFunctions = options.allowedFunctions || DEFAULT_WHITELIST;
    if (!parserServices || !parserServices.defineTemplateBodyVisitor) {
      return {};
    }
    const countTernaryDepth = (node, depth = 0) => {
      if (node.type === "ConditionalExpression") {
        const trueDepth = countTernaryDepth(node.consequent, depth + 1);
        const falseDepth = countTernaryDepth(node.alternate, depth + 1);
        return Math.max(trueDepth, falseDepth);
      }
      return depth;
    };
    const countLogicalOps = (node, count = 0) => {
      if (node.type === "LogicalExpression" && (node.operator === "&&" || node.operator === "||")) {
        const leftCount = countLogicalOps(node.left, count + 1);
        const rightCount = countLogicalOps(node.right, count + 1);
        return Math.max(leftCount, rightCount);
      }
      return count;
    };
    const checkExpression = (node) => {
      const ternaryDepth = countTernaryDepth(node);
      if (ternaryDepth > maxTernaryDepth) {
        context.report({
          node,
          messageId: "complexExpression",
          data: { url: VUE_STYLE_GUIDE }
        });
        return;
      }
      const logicalOps = countLogicalOps(node);
      if (logicalOps > maxLogicalOps) {
        context.report({
          node,
          messageId: "complexExpression",
          data: { url: VUE_STYLE_GUIDE }
        });
        return;
      }
      const checkForDisallowedFunctionCalls = (n) => {
        if (!n || typeof n !== "object") return;
        if (n.type === "CallExpression" && n.arguments.length > 0) {
          const callee = n.callee;
          if (callee.type === "Identifier" && !allowedFunctions.includes(callee.name)) {
            context.report({
              node: n,
              messageId: "complexExpression",
              data: { url: VUE_STYLE_GUIDE }
            });
          }
        }
        for (const key in n) {
          if (key === "parent" || key === "loc" || key === "range") continue;
          const child = n[key];
          if (Array.isArray(child)) {
            child.forEach(checkForDisallowedFunctionCalls);
          } else if (child && typeof child === "object") {
            checkForDisallowedFunctionCalls(child);
          }
        }
      };
      checkForDisallowedFunctionCalls(node);
    };
    return parserServices.defineTemplateBodyVisitor(
      {
        "VExpressionContainer[expression!=null]"(node) {
          checkExpression(node.expression);
        }
      },
      {}
    );
  }
};

// src/rules/consistent-defineprops-emits.ts
var consistent_defineprops_emits_default = {
  meta: {
    type: "problem",
    docs: {
      description: "enforce consistent defineProps and defineEmits usage",
      category: "Best Practices",
      recommended: true,
      url: VUE_COMPOSITION_API
    },
    schema: [],
    messages: {
      multipleDefineProps: "defineProps() should be called only once at top-level. See: {{url}}",
      multipleDefineEmits: "defineEmits() should be called only once at top-level. See: {{url}}",
      notTopLevel: "defineProps() and defineEmits() must be called at top-level of <script setup>. See: {{url}}"
    }
  },
  create(context) {
    const parserServices = context.sourceCode?.parserServices ?? context.parserServices;
    if (!parserServices || !parserServices.defineTemplateBodyVisitor) {
      let definePropsCount2 = 0;
      let defineEmitsCount2 = 0;
      const definePropsNodes2 = [];
      const defineEmitsNodes2 = [];
      return {
        "CallExpression"(node) {
          if (node.callee && node.callee.type === "Identifier" && node.callee.name === "defineProps") {
            if (!isTopLevel(node)) {
              context.report({
                node,
                messageId: "notTopLevel",
                data: { url: VUE_COMPOSITION_API }
              });
              return;
            }
            definePropsCount2++;
            definePropsNodes2.push(node);
          }
          if (node.callee && node.callee.type === "Identifier" && node.callee.name === "defineEmits") {
            if (!isTopLevel(node)) {
              context.report({
                node,
                messageId: "notTopLevel",
                data: { url: VUE_COMPOSITION_API }
              });
              return;
            }
            defineEmitsCount2++;
            defineEmitsNodes2.push(node);
          }
        },
        "Program:exit"() {
          if (definePropsCount2 > 1) {
            definePropsNodes2.slice(1).forEach((node) => {
              context.report({
                node,
                messageId: "multipleDefineProps",
                data: { url: VUE_COMPOSITION_API }
              });
            });
          }
          if (defineEmitsCount2 > 1) {
            defineEmitsNodes2.slice(1).forEach((node) => {
              context.report({
                node,
                messageId: "multipleDefineEmits",
                data: { url: VUE_COMPOSITION_API }
              });
            });
          }
        }
      };
    }
    let definePropsCount = 0;
    let defineEmitsCount = 0;
    const definePropsNodes = [];
    const defineEmitsNodes = [];
    const scriptVisitor = {
      "CallExpression"(node) {
        if (node.callee && node.callee.type === "Identifier" && node.callee.name === "defineProps") {
          if (!isTopLevel(node)) {
            context.report({
              node,
              messageId: "notTopLevel",
              data: { url: VUE_COMPOSITION_API }
            });
            return;
          }
          definePropsCount++;
          definePropsNodes.push(node);
        }
        if (node.callee && node.callee.type === "Identifier" && node.callee.name === "defineEmits") {
          if (!isTopLevel(node)) {
            context.report({
              node,
              messageId: "notTopLevel",
              data: { url: VUE_COMPOSITION_API }
            });
            return;
          }
          defineEmitsCount++;
          defineEmitsNodes.push(node);
        }
      }
    };
    const baseVisitor = parserServices.defineTemplateBodyVisitor(
      {},
      scriptVisitor
    );
    return {
      ...baseVisitor,
      "Program:exit"() {
        if (definePropsCount > 1) {
          definePropsNodes.slice(1).forEach((node) => {
            context.report({
              node,
              messageId: "multipleDefineProps",
              data: { url: VUE_COMPOSITION_API }
            });
          });
        }
        if (defineEmitsCount > 1) {
          defineEmitsNodes.slice(1).forEach((node) => {
            context.report({
              node,
              messageId: "multipleDefineEmits",
              data: { url: VUE_COMPOSITION_API }
            });
          });
        }
      }
    };
  }
};

// src/rules/prefer-typed-defineprops.ts
var prefer_typed_defineprops_default = {
  meta: {
    type: "suggestion",
    docs: {
      description: "prefer typed defineProps in TypeScript",
      category: "Best Practices",
      recommended: true,
      url: VUE_TYPESCRIPT_GUIDE
    },
    schema: [],
    messages: {
      preferTypedProps: "Prefer typed defineProps<{...}>() for better type safety. See: {{url}}"
    }
  },
  create(context) {
    const parserServices = context.sourceCode?.parserServices ?? context.parserServices;
    const filename = context.filename ?? context.getFilename?.();
    const isTypeScript = filename.endsWith(".ts") || filename.endsWith(".vue");
    if (!isTypeScript) {
      return {};
    }
    if (!parserServices || !parserServices.defineTemplateBodyVisitor) {
      if (filename.endsWith(".ts")) {
        return {
          "CallExpression"(node) {
            if (node.callee && node.callee.type === "Identifier" && node.callee.typeParameters === void 0 && node.callee.typeArguments === void 0 && node.typeParameters === void 0 && node.typeArguments === void 0 && node.callee.name === "defineProps") {
              context.report({
                node,
                messageId: "preferTypedProps",
                data: { url: VUE_TYPESCRIPT_GUIDE }
              });
            }
          }
        };
      }
      return {};
    }
    return parserServices.defineTemplateBodyVisitor(
      {},
      {
        "CallExpression"(node) {
          if (node.callee && node.callee.type === "Identifier" && node.callee.name === "defineProps" && node.callee.typeParameters === void 0 && node.callee.typeArguments === void 0 && node.typeParameters === void 0 && node.typeArguments === void 0) {
            if (node.arguments.length > 0) {
              const firstArg = node.arguments[0];
              if (firstArg.type === "ObjectExpression") {
                context.report({
                  node,
                  messageId: "preferTypedProps",
                  data: { url: VUE_TYPESCRIPT_GUIDE }
                });
              }
            } else {
              context.report({
                node,
                messageId: "preferTypedProps",
                data: { url: VUE_TYPESCRIPT_GUIDE }
              });
            }
          }
        }
      }
    );
  }
};

// src/rules/require-use-prefix-for-composables.ts
var DEFAULT_COMPOSABLE_PATHS = ["**/composables/**/*.ts", "**/composables/**/*.js"];
var require_use_prefix_for_composables_default = {
  meta: {
    type: "suggestion",
    docs: {
      description: 'require composable functions to use "use" prefix',
      category: "Best Practices",
      recommended: true,
      url: VUE_STYLE_GUIDE
    },
    schema: [
      {
        type: "object",
        properties: {
          paths: {
            type: "array",
            items: { type: "string" }
          }
        },
        additionalProperties: false
      }
    ],
    messages: {
      requireUsePrefix: 'Composable functions should be named with "use" prefix (e.g., useXxx). See: {{url}}'
    }
  },
  create(context) {
    const filename = context.filename ?? context.getFilename?.();
    const options = context.options[0] || {};
    const paths = options.paths || DEFAULT_COMPOSABLE_PATHS;
    const isComposableFile = paths.some((pattern) => {
      return filename.includes("composable") || filename.includes("use");
    });
    if (!isComposableFile) {
      return {};
    }
    const functionNames = /* @__PURE__ */ new Set();
    return {
      // Track function declarations and expressions
      "FunctionDeclaration"(node) {
        if (node.id?.name) {
          functionNames.add(node.id.name);
        }
      },
      "VariableDeclarator"(node) {
        if (node.id?.name && node.init && (node.init.type === "FunctionExpression" || node.init.type === "ArrowFunctionExpression")) {
          functionNames.add(node.id.name);
        }
      },
      "ExportDefaultDeclaration"(node) {
        if (node.declaration && (node.declaration.type === "FunctionDeclaration" || node.declaration.type === "FunctionExpression" || node.declaration.type === "ArrowFunctionExpression")) {
          const funcName = node.declaration.id?.name || node.declaration.type === "FunctionExpression" && node.declaration.id?.name;
          if (funcName && !funcName.startsWith("use")) {
            context.report({
              node: node.declaration.id || node,
              messageId: "requireUsePrefix",
              data: { url: VUE_STYLE_GUIDE }
            });
          }
        }
      },
      "ExportNamedDeclaration"(node) {
        if (node.declaration && node.declaration.type === "FunctionDeclaration") {
          const funcName = node.declaration.id?.name;
          if (funcName && !funcName.startsWith("use")) {
            context.report({
              node: node.declaration.id || node,
              messageId: "requireUsePrefix",
              data: { url: VUE_STYLE_GUIDE }
            });
          }
        }
        if (node.declaration && node.declaration.type === "VariableDeclaration") {
          node.declaration.declarations.forEach((decl) => {
            if (decl.id?.name && decl.init && (decl.init.type === "FunctionExpression" || decl.init.type === "ArrowFunctionExpression") && !decl.id.name.startsWith("use")) {
              context.report({
                node: decl.id,
                messageId: "requireUsePrefix",
                data: { url: VUE_STYLE_GUIDE }
              });
            }
          });
        }
        if (node.specifiers) {
          node.specifiers.forEach((spec) => {
            if (spec.type === "ExportSpecifier" && spec.exported && !spec.exported.name.startsWith("use")) {
              const exportedName = spec.local.name;
              if (functionNames.has(exportedName)) {
                context.report({
                  node: spec.exported,
                  messageId: "requireUsePrefix",
                  data: { url: VUE_STYLE_GUIDE }
                });
              }
            }
          });
        }
      }
    };
  }
};

// src/rules/no-composable-conditional-hooks.ts
var VUE_COMPOSABLES = [
  "ref",
  "reactive",
  "computed",
  "watch",
  "watchEffect",
  "watchPostEffect",
  "watchSyncEffect",
  "readonly",
  "shallowRef",
  "shallowReactive",
  "shallowReadonly",
  "toRef",
  "toRefs",
  "toValue",
  "unref",
  "isRef",
  "isReactive",
  "isReadonly",
  "isProxy"
];
var no_composable_conditional_hooks_default = {
  meta: {
    type: "problem",
    docs: {
      description: "disallow conditional calls to Vue composables in composables",
      category: "Best Practices",
      recommended: true,
      url: VUE_COMPOSITION_API
    },
    schema: [],
    messages: {
      conditionalHook: "Vue composables (ref, computed, watchEffect, etc.) should be called unconditionally in composables. See: {{url}}"
    }
  },
  create(context) {
    const filename = context.filename ?? context.getFilename?.();
    const isComposableFile = filename.includes("composables/") || filename.includes("composable");
    if (!isComposableFile) {
      return {};
    }
    const checkConditionalHook = (node, parent) => {
      if (node.type === "CallExpression" && node.callee && node.callee.type === "Identifier" && VUE_COMPOSABLES.includes(node.callee.name)) {
        let current = parent;
        while (current) {
          if (current.type === "IfStatement" || current.type === "ForStatement" || current.type === "WhileStatement" || current.type === "SwitchStatement" || current.type === "ConditionalExpression" || current.type === "LogicalExpression") {
            context.report({
              node,
              messageId: "conditionalHook",
              data: { url: VUE_COMPOSITION_API }
            });
            return;
          }
          if (current.type === "FunctionDeclaration" || current.type === "FunctionExpression" || current.type === "ArrowFunctionExpression") {
            break;
          }
          current = current.parent;
        }
      }
    };
    return {
      "CallExpression"(node) {
        checkConditionalHook(node, node.parent);
      }
    };
  }
};

// src/rules/no-composable-dom-access-without-client-guard.ts
var no_composable_dom_access_without_client_guard_default = {
  meta: {
    type: "problem",
    docs: {
      description: "require client guard for DOM access in composables",
      category: "Best Practices",
      recommended: true,
      url: VUE_SSR_GUIDE
    },
    schema: [
      {
        type: "object",
        properties: {
          allowProcessClient: {
            type: "boolean"
          }
        },
        additionalProperties: false
      }
    ],
    messages: {
      noClientGuard: "DOM access (window/document/localStorage) in composable requires client guard. Use if (import.meta.client) or onMounted(). See: {{url}}"
    }
  },
  create(context) {
    const filename = context.filename ?? context.getFilename?.();
    const options = context.options[0] || {};
    const allowProcessClient = options.allowProcessClient === true;
    const isComposableFile = filename.includes("composables/") || filename.includes("composable");
    if (!isComposableFile) {
      return {};
    }
    const checkDomAccess = (node) => {
      const domAccess = isDomAccess(node);
      if (!domAccess.type) {
        return;
      }
      if (isInClientContext(node)) {
        return;
      }
      if (allowProcessClient) {
        let current = node.parent;
        while (current) {
          if (current.type === "IfStatement" && current.test && current.test.type === "MemberExpression" && current.test.object && current.test.object.type === "Identifier" && current.test.object.name === "process" && current.test.property && current.test.property.name === "client") {
            return;
          }
          current = current.parent;
        }
      }
      context.report({
        node,
        messageId: "noClientGuard",
        data: { url: VUE_SSR_GUIDE }
      });
    };
    return {
      "MemberExpression": checkDomAccess,
      "Identifier"(node) {
        if (["window", "document", "localStorage"].includes(node.name)) {
          if (node.parent && node.parent.type === "MemberExpression" && node.parent.object === node) {
            return;
          }
          checkDomAccess(node);
        }
      }
    };
  }
};

// src/rules/pinia-require-defineStore-id.ts
var pinia_require_defineStore_id_default = {
  meta: {
    type: "problem",
    docs: {
      description: "require defineStore to have a string literal id",
      category: "Best Practices",
      recommended: true,
      url: PINIA_DOCS
    },
    schema: [],
    messages: {
      requireStoreId: "defineStore() requires a string literal id as first argument. See: {{url}}"
    }
  },
  create(context) {
    return {
      "CallExpression"(node) {
        if (node.callee && node.callee.type === "Identifier" && node.callee.name === "defineStore") {
          if (node.arguments.length === 0) {
            context.report({
              node,
              messageId: "requireStoreId",
              data: { url: PINIA_DOCS }
            });
            return;
          }
          const firstArg = node.arguments[0];
          if (!isLiteral(firstArg) || firstArg.type !== "Literal" || typeof firstArg.value !== "string") {
            context.report({
              node: firstArg || node,
              messageId: "requireStoreId",
              data: { url: PINIA_DOCS }
            });
          }
        }
      }
    };
  }
};

// src/rules/pinia-no-direct-state-mutation-outside-actions.ts
var pinia_no_direct_state_mutation_outside_actions_default = {
  meta: {
    type: "suggestion",
    docs: {
      description: "disallow direct state mutation outside store actions",
      category: "Best Practices",
      recommended: true,
      url: PINIA_DOCS
    },
    schema: [
      {
        type: "object",
        properties: {
          strict: {
            type: "boolean"
          }
        },
        additionalProperties: false
      }
    ],
    messages: {
      noDirectMutation: "Avoid direct state mutation outside store actions. Use store actions instead. See: {{url}}"
    }
  },
  create(context) {
    const options = context.options[0] || {};
    const strict2 = options.strict !== false;
    if (!strict2) {
      return {};
    }
    const storeScopes = /* @__PURE__ */ new Set();
    return {
      "CallExpression"(node) {
        if (node.callee && node.callee.type === "Identifier" && node.callee.name === "defineStore") {
          let current = node;
          while (current && current.type !== "Program") {
            storeScopes.add(current);
            current = current.parent;
          }
        }
      },
      "AssignmentExpression"(node) {
        if (node.left && node.left.type === "MemberExpression") {
          const left = node.left;
          if (left.object && left.object.type === "MemberExpression" && left.object.property && left.object.property.name === "$state") {
            let current = node;
            let inStore = false;
            while (current && current.type !== "Program") {
              if (storeScopes.has(current)) {
                inStore = true;
                break;
              }
              current = current.parent;
            }
            if (!inStore) {
              context.report({
                node,
                messageId: "noDirectMutation",
                data: { url: PINIA_DOCS }
              });
            }
          } else if (left.object && left.object.type === "Identifier" && left.object.name && left.object.name.endsWith("Store")) {
            let current = node;
            let inStore = false;
            while (current && current.type !== "Program") {
              if (storeScopes.has(current)) {
                inStore = true;
                break;
              }
              current = current.parent;
            }
            if (!inStore) {
              const isStorePattern = left.object.name.includes("Store") || left.object.name.startsWith("use") && left.object.name.endsWith("Store");
              if (isStorePattern) {
                context.report({
                  node,
                  messageId: "noDirectMutation",
                  data: { url: PINIA_DOCS }
                });
              }
            }
          }
        }
      }
    };
  }
};

// src/rules/pinia-prefer-storeToRefs-destructure.ts
var pinia_prefer_storeToRefs_destructure_default = {
  meta: {
    type: "suggestion",
    docs: {
      description: "prefer storeToRefs when destructuring reactive store properties",
      category: "Best Practices",
      recommended: true,
      url: PINIA_DOCS
    },
    schema: [],
    fixable: "code",
    messages: {
      preferStoreToRefs: "Destructure reactive store properties with storeToRefs() to maintain reactivity. See: {{url}}"
    }
  },
  create(context) {
    return {
      "VariableDeclarator"(node) {
        if (node.id && node.id.type === "ObjectPattern" && node.init) {
          const init = node.init;
          if (init.type === "CallExpression" && init.callee && init.callee.type === "Identifier" && init.callee.name.endsWith("Store") && init.callee.name.startsWith("use")) {
            if (init.callee.name === "storeToRefs" || init.callee.type === "MemberExpression" && init.callee.property && init.callee.property.name === "storeToRefs") {
              return;
            }
            const sourceCode = context.getSourceCode();
            const storeCallText = sourceCode.getText(init);
            context.report({
              node,
              messageId: "preferStoreToRefs",
              data: { url: PINIA_DOCS },
              fix(fixer) {
                return fixer.replaceText(
                  init,
                  `storeToRefs(${storeCallText})`
                );
              }
            });
          }
          if (init.type === "Identifier" && init.name.endsWith("Store")) {
            context.report({
              node,
              messageId: "preferStoreToRefs",
              data: { url: PINIA_DOCS },
              fix(fixer) {
                return fixer.replaceText(
                  init,
                  `storeToRefs(${init.name})`
                );
              }
            });
          }
        }
      }
    };
  }
};

// src/configs.ts
var recommended = {
  plugins: ["vue-official"],
  rules: {
    // Component rules
    "vue-official/require-script-setup": "warn",
    "vue-official/no-setup-top-level-side-effects": "error",
    "vue-official/no-async-computed-getter": "error",
    "vue-official/prefer-shallow-watch": "warn",
    "vue-official/no-template-complex-expressions": "warn",
    "vue-official/consistent-defineprops-emits": "error",
    "vue-official/prefer-typed-defineprops": "warn",
    // Composable rules
    "vue-official/require-use-prefix-for-composables": "warn",
    "vue-official/no-composable-conditional-hooks": "warn",
    "vue-official/no-composable-dom-access-without-client-guard": "error",
    // Store rules
    "vue-official/pinia-require-defineStore-id": "error",
    "vue-official/pinia-no-direct-state-mutation-outside-actions": "warn",
    "vue-official/pinia-prefer-storeToRefs-destructure": "warn"
  }
};
var strict = {
  plugins: ["vue-official"],
  rules: {
    // Component rules - all errors
    "vue-official/require-script-setup": "error",
    "vue-official/no-setup-top-level-side-effects": "error",
    "vue-official/no-async-computed-getter": "error",
    "vue-official/prefer-shallow-watch": "error",
    "vue-official/no-template-complex-expressions": "error",
    "vue-official/consistent-defineprops-emits": "error",
    "vue-official/prefer-typed-defineprops": "error",
    // Composable rules - all errors
    "vue-official/require-use-prefix-for-composables": "error",
    "vue-official/no-composable-conditional-hooks": "error",
    "vue-official/no-composable-dom-access-without-client-guard": "error",
    // Store rules - all errors
    "vue-official/pinia-require-defineStore-id": "error",
    "vue-official/pinia-no-direct-state-mutation-outside-actions": "error",
    "vue-official/pinia-prefer-storeToRefs-destructure": "error"
  }
};

// src/index.ts
var index_default = {
  meta: {
    name: "eslint-plugin-vue-official-best-practices",
    version: "1.0.0"
  },
  rules: {
    "require-script-setup": require_script_setup_default,
    "no-setup-top-level-side-effects": no_setup_top_level_side_effects_default,
    "no-async-computed-getter": no_async_computed_getter_default,
    "prefer-shallow-watch": prefer_shallow_watch_default,
    "no-template-complex-expressions": no_template_complex_expressions_default,
    "consistent-defineprops-emits": consistent_defineprops_emits_default,
    "prefer-typed-defineprops": prefer_typed_defineprops_default,
    "require-use-prefix-for-composables": require_use_prefix_for_composables_default,
    "no-composable-conditional-hooks": no_composable_conditional_hooks_default,
    "no-composable-dom-access-without-client-guard": no_composable_dom_access_without_client_guard_default,
    "pinia-require-defineStore-id": pinia_require_defineStore_id_default,
    "pinia-no-direct-state-mutation-outside-actions": pinia_no_direct_state_mutation_outside_actions_default,
    "pinia-prefer-storeToRefs-destructure": pinia_prefer_storeToRefs_destructure_default
  },
  configs: {
    recommended,
    strict
  }
};

export { index_default as default };
//# sourceMappingURL=index.js.map
//# sourceMappingURL=index.js.map