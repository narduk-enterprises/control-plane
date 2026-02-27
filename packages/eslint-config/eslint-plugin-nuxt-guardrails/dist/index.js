import { existsSync, readFileSync } from 'fs';
import { dirname, join } from 'path';
import { fileURLToPath } from 'url';

// src/utils/spec-loader.ts
function getDirname() {
  try {
    return dirname(fileURLToPath(import.meta.url));
  } catch {
    try {
      return __dirname$1;
    } catch {
      return process.cwd();
    }
  }
}
var __dirname$1 = getDirname();
var cachedSpec = null;
function loadSpec(specPath) {
  if (cachedSpec) {
    return cachedSpec;
  }
  const possiblePaths = [
    specPath,
    join(__dirname$1, "../spec/nuxt4-spec.json"),
    // dist/spec (after build)
    join(__dirname$1, "../../src/spec/nuxt4-spec.json"),
    // src/spec (dev)
    join(process.cwd(), "eslint-plugin-nuxt-guardrails/src/spec/nuxt4-spec.json"),
    // from project root
    join(process.cwd(), "eslint-plugin-nuxt-guardrails/dist/spec/nuxt4-spec.json")
    // from project root dist
  ].filter(Boolean);
  let path = null;
  for (const p of possiblePaths) {
    if (existsSync(p)) {
      path = p;
      break;
    }
  }
  if (!path) {
    return {
      version: "4.2.2",
      generatedAt: (/* @__PURE__ */ new Date()).toISOString(),
      apis: {},
      deprecations: {}
    };
  }
  const content = readFileSync(path, "utf-8");
  cachedSpec = JSON.parse(content);
  return cachedSpec;
}
function getApiSpec(apiName, specPath) {
  const spec = loadSpec(specPath);
  return spec.apis[apiName] || null;
}

// src/rules/no-legacy-head.ts
var no_legacy_head_default = {
  meta: {
    type: "problem",
    docs: {
      description: "disallow legacy Options API head() method or head option",
      category: "Best Practices",
      recommended: true
    },
    fixable: "code",
    schema: [],
    messages: {
      legacyHeadMethod: "Use useHead() composable instead of head() method. See: {{docUrl}}",
      legacyHeadOption: "Use useHead() composable instead of head option. See: {{docUrl}}"
    }
  },
  create(context) {
    const parserServices = context.sourceCode?.parserServices ?? context.parserServices;
    if (!parserServices || !parserServices.defineTemplateBodyVisitor) {
      return {};
    }
    const useHeadSpec = getApiSpec("useHead");
    const docUrl = useHeadSpec?.docUrl || "https://nuxt.com/docs/api/composables/use-head";
    return parserServices.defineTemplateBodyVisitor(
      {},
      {
        // Check script block for Options API patterns
        "Program:exit"(node) {
          for (const statement of node.body) {
            if (statement.type === "ExportDefaultDeclaration" && statement.declaration && statement.declaration.type === "ObjectExpression") {
              const obj = statement.declaration;
              for (const prop of obj.properties) {
                if (prop.type === "Property" && prop.key && (prop.key.type === "Identifier" && prop.key.name === "head" || prop.key.type === "Literal" && prop.key.value === "head")) {
                  if (prop.method) continue;
                  context.report({
                    node: prop,
                    messageId: "legacyHeadOption",
                    data: { docUrl }
                  });
                }
              }
            }
          }
        },
        // Check for head() method
        'Property[key.name="head"]'(node) {
          if (node.method && node.parent?.type === "ObjectExpression" && node.parent.parent?.type === "ExportDefaultDeclaration") {
            context.report({
              node,
              messageId: "legacyHeadMethod",
              data: { docUrl }
            });
          }
        }
      }
    );
  }
};

// src/rules/no-legacy-fetch-hook.ts
var no_legacy_fetch_hook_default = {
  meta: {
    type: "problem",
    docs: {
      description: "disallow legacy Nuxt 2 fetch() hook",
      category: "Best Practices",
      recommended: true
    },
    schema: [],
    messages: {
      legacyFetch: "Use useFetch() or useAsyncData() instead of fetch() hook. See: {{docUrl}}"
    }
  },
  create(context) {
    const parserServices = context.sourceCode?.parserServices ?? context.parserServices;
    if (!parserServices || !parserServices.defineTemplateBodyVisitor) {
      return {};
    }
    const useFetchSpec = getApiSpec("useFetch");
    const useAsyncDataSpec = getApiSpec("useAsyncData");
    const docUrl = useFetchSpec?.docUrl || useAsyncDataSpec?.docUrl || "https://nuxt.com/docs/api/composables/use-fetch";
    return parserServices.defineTemplateBodyVisitor(
      {},
      {
        // Check for fetch() method in Options API
        'Property[key.name="fetch"]'(node) {
          if (node.method && node.parent?.type === "ObjectExpression" && node.parent.parent?.type === "ExportDefaultDeclaration") {
            context.report({
              node,
              messageId: "legacyFetch",
              data: { docUrl }
            });
          }
        }
      }
    );
  }
};

// src/utils/ast-utils.ts
function isInClientContext(node, context) {
  let current = node.parent;
  while (current) {
    if (current.type === "IfStatement" && current.test && (isImportMetaClient(current.test) || isImportMetaServer(current.test))) {
      return isImportMetaClient(current.test);
    }
    if (current.type === "IfStatement" && current.test && current.test.type === "UnaryExpression" && current.test.operator === "!" && isImportMetaClient(current.test.argument)) {
      return true;
    }
    if (current.type === "CallExpression" && current.callee && (current.callee.name === "onMounted" || current.callee.name === "onUnmounted" || current.callee.name === "onBeforeUnmount" || current.callee.name === "onUpdated" || current.callee.name === "onBeforeUpdate")) {
      return true;
    }
    current = current.parent;
  }
  return false;
}
function isImportMetaClient(node) {
  return node.type === "MemberExpression" && node.object && node.object.type === "MetaProperty" && node.object.meta && node.object.meta.name === "import" && node.object.property && node.object.property.name === "meta" && node.property && node.property.name === "client";
}
function isImportMetaServer(node) {
  return node.type === "MemberExpression" && node.object && node.object.type === "MetaProperty" && node.object.meta && node.object.meta.name === "import" && node.object.property && node.object.property.name === "meta" && node.property && node.property.name === "server";
}
function isProcessClient(node) {
  return node.type === "MemberExpression" && node.object && node.object.type === "Identifier" && node.object.name === "process" && node.property && node.property.name === "client";
}
function isProcessServer(node) {
  return node.type === "MemberExpression" && node.object && node.object.type === "Identifier" && node.object.name === "process" && node.property && node.property.name === "server";
}
function isDomAccess(node) {
  if (node.type !== "MemberExpression") {
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
function isLiteral(node) {
  return node.type === "Literal" || node.type === "TemplateLiteral";
}

// src/rules/prefer-import-meta-client.ts
var prefer_import_meta_client_default = {
  meta: {
    type: "suggestion",
    docs: {
      description: "prefer import.meta.client/server over process.client/server",
      category: "Best Practices",
      recommended: true
    },
    fixable: "code",
    schema: [
      {
        type: "object",
        properties: {
          allowProcessClientServer: {
            type: "boolean",
            default: false
          }
        },
        additionalProperties: false
      }
    ],
    messages: {
      preferImportMetaClient: "Use import.meta.client instead of process.client. See: https://nuxt.com/docs/4.x/guide/concepts/rendering",
      preferImportMetaServer: "Use import.meta.server instead of process.server. See: https://nuxt.com/docs/4.x/guide/concepts/rendering"
    }
  },
  create(context) {
    const options = context.options[0] || {};
    const allowProcessClientServer = options.allowProcessClientServer || false;
    if (allowProcessClientServer) {
      return {};
    }
    return {
      MemberExpression(node) {
        if (isProcessClient(node)) {
          context.report({
            node,
            messageId: "preferImportMetaClient",
            fix(fixer) {
              return fixer.replaceText(node, "import.meta.client");
            }
          });
        } else if (isProcessServer(node)) {
          context.report({
            node,
            messageId: "preferImportMetaServer",
            fix(fixer) {
              return fixer.replaceText(node, "import.meta.server");
            }
          });
        }
      }
    };
  }
};

// src/rules/no-ssr-dom-access.ts
var no_ssr_dom_access_default = {
  meta: {
    type: "problem",
    docs: {
      description: "disallow unguarded DOM access in server context",
      category: "Best Practices",
      recommended: true
    },
    schema: [],
    messages: {
      unguardedDomAccess: "Unguarded {{type}} access may cause SSR errors. Use onMounted() or guard with import.meta.client. See: https://nuxt.com/docs/4.x/guide/concepts/rendering"
    }
  },
  create(context) {
    const filename = context.getFilename();
    const parserServices = context.parserServices;
    if (filename.includes(".client.") || filename.includes(".client/")) {
      return {};
    }
    if (filename.includes("e2e/") || filename.includes(".spec.ts") || filename.includes(".test.ts")) {
      return {};
    }
    const isVueFile = filename.endsWith(".vue");
    return {
      MemberExpression(node) {
        if (isVueFile && parserServices && parserServices.getTemplateBodyTokenStore) {
          let current2 = node.parent;
          while (current2) {
            if (current2.type && current2.type.startsWith("V")) {
              return;
            }
            current2 = current2.parent;
          }
        }
        const domInfo = isDomAccess(node);
        if (!domInfo.type) {
          return;
        }
        if (isInClientContext(node)) {
          return;
        }
        let checkNode = node;
        while (checkNode) {
          if (checkNode.type === "BlockStatement" && checkNode.body) {
            const nodePos = node.range ? node.range[0] : null;
            if (nodePos) {
              for (const stmt of checkNode.body) {
                if (!stmt.range) continue;
                if (stmt.range[0] > nodePos) break;
                if (stmt.type === "IfStatement" && stmt.test && stmt.test.type === "UnaryExpression" && stmt.test.operator === "!" && isImportMetaClient(stmt.test.argument) && (stmt.consequent.type === "ReturnStatement" || stmt.consequent.type === "BlockStatement" && stmt.consequent.body.some((s) => s.type === "ReturnStatement"))) {
                  return;
                }
                if (stmt.type === "IfStatement" && stmt.test && stmt.test.type === "LogicalExpression" && (stmt.test.left && stmt.test.left.type === "UnaryExpression" && stmt.test.left.operator === "!" && isImportMetaClient(stmt.test.left.argument) || stmt.test.right && stmt.test.right.type === "UnaryExpression" && stmt.test.right.operator === "!" && isImportMetaClient(stmt.test.right.argument)) && (stmt.consequent.type === "ReturnStatement" || stmt.consequent.type === "BlockStatement" && stmt.consequent.body.some((s) => s.type === "ReturnStatement"))) {
                  return;
                }
              }
            }
            break;
          }
          if (checkNode.type === "FunctionDeclaration" || checkNode.type === "FunctionExpression" || checkNode.type === "ArrowFunctionExpression") {
            const body = checkNode.body;
            if (body && body.type === "BlockStatement" && body.body) {
              const nodePos = node.range ? node.range[0] : null;
              if (nodePos) {
                for (const stmt of body.body) {
                  if (!stmt.range) continue;
                  if (stmt.range[0] > nodePos) break;
                  if (stmt.type === "IfStatement" && stmt.test && stmt.test.type === "UnaryExpression" && stmt.test.operator === "!" && isImportMetaClient(stmt.test.argument) && (stmt.consequent.type === "ReturnStatement" || stmt.consequent.type === "BlockStatement" && stmt.consequent.body.some((s) => s.type === "ReturnStatement"))) {
                    return;
                  }
                  if (stmt.type === "IfStatement" && stmt.test && stmt.test.type === "LogicalExpression" && (stmt.test.left && stmt.test.left.type === "UnaryExpression" && stmt.test.left.operator === "!" && isImportMetaClient(stmt.test.left.argument) || stmt.test.right && stmt.test.right.type === "UnaryExpression" && stmt.test.right.operator === "!" && isImportMetaClient(stmt.test.right.argument)) && (stmt.consequent.type === "ReturnStatement" || stmt.consequent.type === "BlockStatement" && stmt.consequent.body.some((s) => s.type === "ReturnStatement"))) {
                    return;
                  }
                }
              }
              break;
            }
          }
          checkNode = checkNode.parent;
        }
        let current = node.parent;
        while (current) {
          if (current.type === "ArrowFunctionExpression") {
            const body = current.body;
            if (body && body.type === "BlockStatement") {
              for (const stmt of body.body) {
                if (stmt.range && node.range && stmt.range[0] <= node.range[0] && stmt.range[1] >= node.range[1]) {
                  break;
                }
                if (stmt.type === "IfStatement" && stmt.test && stmt.test.type === "UnaryExpression" && stmt.test.operator === "!" && isImportMetaClient(stmt.test.argument) && (stmt.consequent.type === "ReturnStatement" || stmt.consequent.type === "BlockStatement" && stmt.consequent.body.some((s) => s.type === "ReturnStatement"))) {
                  return;
                }
              }
            } else if (body && body.type === "ConditionalExpression") {
              if (body.test && body.test.type === "UnaryExpression" && body.test.operator === "!" && isImportMetaClient(body.test.argument)) {
                return;
              }
            }
          }
          if (current.type === "CallExpression" && current.callee && current.callee.name === "computed") {
            const arg = current.arguments && current.arguments[0];
            if (arg && arg.type === "ArrowFunctionExpression") {
              const body = arg.body;
              if (body && body.type === "BlockStatement") {
                for (const stmt of body.body) {
                  if (stmt.range && node.range && stmt.range[0] <= node.range[0] && stmt.range[1] >= node.range[1]) {
                    break;
                  }
                  if (stmt.type === "IfStatement" && stmt.test && stmt.test.type === "UnaryExpression" && stmt.test.operator === "!" && isImportMetaClient(stmt.test.argument) && (stmt.consequent.type === "ReturnStatement" || stmt.consequent.type === "BlockStatement" && stmt.consequent.body.some((s) => s.type === "ReturnStatement"))) {
                    return;
                  }
                }
              }
            }
          }
          if (current.type === "IfStatement" && current.test) {
            if (isImportMetaClient(current.test)) {
              return;
            }
            if (current.test.type === "LogicalExpression" && (isImportMetaClient(current.test.left) || isImportMetaClient(current.test.right))) {
              return;
            }
          }
          current = current.parent;
        }
        context.report({
          node,
          messageId: "unguardedDomAccess",
          data: { type: domInfo.type }
        });
      }
    };
  }
};

// src/rules/valid-useAsyncData.ts
function isValidAsyncDataKey(node) {
  if (isLiteral(node)) {
    return true;
  }
  if (node.type === "ArrowFunctionExpression") {
    const body = node.body;
    if (body && (body.type === "Literal" || body.type === "TemplateLiteral")) {
      return true;
    }
    if (body && body.type === "BlockStatement" && body.body) {
      for (const stmt of body.body) {
        if (stmt.type === "ReturnStatement" && stmt.argument) {
          if (stmt.argument.type === "Literal" || stmt.argument.type === "TemplateLiteral") {
            return true;
          }
        }
      }
    }
    return false;
  }
  if (node.type === "FunctionExpression") {
    const body = node.body;
    if (body && body.type === "BlockStatement" && body.body) {
      for (const stmt of body.body) {
        if (stmt.type === "ReturnStatement" && stmt.argument) {
          if (stmt.argument.type === "Literal" || stmt.argument.type === "TemplateLiteral") {
            return true;
          }
        }
      }
    }
    return false;
  }
  if (node.type === "Identifier") {
    return false;
  }
  return false;
}
var valid_useAsyncData_default = {
  meta: {
    type: "problem",
    docs: {
      description: "enforce valid useAsyncData usage",
      category: "Best Practices",
      recommended: true
    },
    schema: [
      {
        type: "object",
        properties: {
          requireStableAsyncDataKeys: {
            type: "boolean",
            default: true
          }
        },
        additionalProperties: false
      }
    ],
    messages: {
      missingCallback: "useAsyncData requires a callback function as second argument. See: {{docUrl}}",
      missingKey: "useAsyncData requires a key as first argument. See: {{docUrl}}",
      keyNotLiteral: "useAsyncData key should be a string literal for stable caching. See: {{docUrl}}",
      callbackReturnsNothing: "useAsyncData callback should return a value. See: {{docUrl}}"
    }
  },
  create(context) {
    const options = context.options[0] || {};
    const requireStableKeys = options.requireStableAsyncDataKeys !== false;
    const useAsyncDataSpec = getApiSpec("useAsyncData");
    const docUrl = useAsyncDataSpec?.docUrl || "https://nuxt.com/docs/api/composables/use-async-data";
    return {
      CallExpression(node) {
        if (!node.callee || node.callee.type !== "Identifier" && node.callee.type !== "MemberExpression" || node.callee.type === "Identifier" && node.callee.name !== "useAsyncData" || node.callee.type === "MemberExpression" && node.callee.property && node.callee.property.name !== "useAsyncData") {
          return;
        }
        const args = node.arguments || [];
        if (args.length === 0) {
          context.report({
            node,
            messageId: "missingKey",
            data: { docUrl }
          });
          return;
        }
        if (requireStableKeys && !isValidAsyncDataKey(args[0])) {
          context.report({
            node: args[0],
            messageId: "keyNotLiteral",
            data: { docUrl }
          });
        }
        if (args.length < 2) {
          context.report({
            node,
            messageId: "missingCallback",
            data: { docUrl }
          });
          return;
        }
        const callback = args[1];
        if (callback.type !== "ArrowFunctionExpression" && callback.type !== "FunctionExpression") {
          context.report({
            node: callback,
            messageId: "missingCallback",
            data: { docUrl }
          });
          return;
        }
        if (callback.body) {
          const hasReturn = (body) => {
            if (body.type === "BlockStatement") {
              for (const stmt of body.body) {
                if (stmt.type === "ReturnStatement") {
                  return true;
                }
                if (stmt.type === "IfStatement" && stmt.consequent) {
                  if (hasReturn(stmt.consequent)) return true;
                  if (stmt.alternate && hasReturn(stmt.alternate)) return true;
                }
              }
              return false;
            }
            return body.type !== "BlockStatement";
          };
          if (callback.body.type === "BlockStatement" && !hasReturn(callback.body)) ;
        }
      }
    };
  }
};

// src/rules/valid-useFetch.ts
var valid_useFetch_default = {
  meta: {
    type: "problem",
    docs: {
      description: "enforce valid useFetch usage",
      category: "Best Practices",
      recommended: true
    },
    schema: [],
    messages: {
      missingUrl: "useFetch requires a URL as first argument. See: {{docUrl}}",
      invalidOptions: "useFetch options may be invalid. See: {{docUrl}}"
    }
  },
  create(context) {
    const useFetchSpec = getApiSpec("useFetch");
    const docUrl = useFetchSpec?.docUrl || "https://nuxt.com/docs/api/composables/use-fetch";
    return {
      CallExpression(node) {
        if (!node.callee || node.callee.type !== "Identifier" && node.callee.type !== "MemberExpression" || node.callee.type === "Identifier" && node.callee.name !== "useFetch" || node.callee.type === "MemberExpression" && node.callee.property && node.callee.property.name !== "useFetch") {
          return;
        }
        const args = node.arguments || [];
        if (args.length === 0) {
          context.report({
            node,
            messageId: "missingUrl",
            data: { docUrl }
          });
          return;
        }
        const urlArg = args[0];
        if (urlArg.type !== "Literal" && urlArg.type !== "TemplateLiteral" && urlArg.type !== "ArrowFunctionExpression" && urlArg.type !== "FunctionExpression") ;
        if (args.length > 1 && args[1].type === "ObjectExpression" && useFetchSpec?.options) {
          const options = args[1];
          const validOptionKeys = new Set(Object.keys(useFetchSpec.options));
          for (const prop of options.properties) {
            if (prop.type === "Property" && prop.key && prop.key.type === "Identifier") {
              const key = prop.key.name;
              const commonOptions = /* @__PURE__ */ new Set(["server", "default", "key", "lazy", "immediate", "watch", "getCachedData", "pick", "transform"]);
              if (!validOptionKeys.has(key) && !commonOptions.has(key)) ;
            }
          }
        }
      }
    };
  }
};
var app_structure_consistency_default = {
  meta: {
    type: "suggestion",
    docs: {
      description: "enforce consistent directory structure",
      category: "Best Practices",
      recommended: true
    },
    schema: [
      {
        type: "object",
        properties: {
          projectStyle: {
            type: "string",
            enum: ["app-dir", "mixed", "legacy", "auto"],
            default: "auto"
          }
        },
        additionalProperties: false
      }
    ],
    messages: {
      conflictingStructure: "Found both app/pages/ and pages/ directories. This may cause routing conflicts. Prefer app/ structure for Nuxt 4. See: https://nuxt.com/docs/4.x/guide/directory-structure/app"
    }
  },
  create(context) {
    const options = context.options[0] || {};
    const projectStyle = options.projectStyle || "auto";
    let hasChecked = false;
    return {
      "Program:exit"(node) {
        if (hasChecked || projectStyle === "legacy") {
          return;
        }
        hasChecked = true;
        const cwd = context.getCwd ? context.getCwd() : process.cwd();
        const appPagesExists = existsSync(join(cwd, "app/pages"));
        const rootPagesExists = existsSync(join(cwd, "pages"));
        if (appPagesExists && rootPagesExists && projectStyle !== "mixed") {
          context.report({
            node,
            messageId: "conflictingStructure"
          });
        }
      }
    };
  }
};

// src/index.ts
var index_default = {
  meta: {
    name: "eslint-plugin-nuxt-guardrails",
    version: "1.0.0"
  },
  rules: {
    "no-legacy-head": no_legacy_head_default,
    "no-legacy-fetch-hook": no_legacy_fetch_hook_default,
    "prefer-import-meta-client": prefer_import_meta_client_default,
    "no-ssr-dom-access": no_ssr_dom_access_default,
    "valid-useAsyncData": valid_useAsyncData_default,
    "valid-useFetch": valid_useFetch_default,
    "app-structure-consistency": app_structure_consistency_default
  },
  configs: {
    recommended: {
      plugins: ["nuxt-guardrails"],
      rules: {
        "nuxt-guardrails/no-legacy-head": "warn",
        "nuxt-guardrails/no-legacy-fetch-hook": "error",
        "nuxt-guardrails/prefer-import-meta-client": "warn",
        "nuxt-guardrails/no-ssr-dom-access": "error",
        "nuxt-guardrails/valid-useAsyncData": "warn",
        "nuxt-guardrails/valid-useFetch": "warn",
        "nuxt-guardrails/app-structure-consistency": "warn"
      }
    }
  }
};

export { index_default as default };
//# sourceMappingURL=index.js.map
//# sourceMappingURL=index.js.map