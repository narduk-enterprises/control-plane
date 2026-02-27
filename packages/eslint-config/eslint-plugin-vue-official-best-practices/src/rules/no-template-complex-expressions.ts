/**
 * Rule: vue-official/no-template-complex-expressions
 * 
 * Warns on complex expressions in templates
 */

import type { RuleContext, RuleListener } from 'eslint'
import { VUE_STYLE_GUIDE } from '../utils/vue-docs-urls'

const DEFAULT_WHITELIST = [
  'formatPrice',
  'formatChange',
  'formatPercent',
  'formatDate',
  'formatCurrency',
  'formatNumber',
  'toLocaleString',
  'toString',
  'toFixed',
]

export default {
  meta: {
    type: 'suggestion',
    docs: {
      description: 'disallow complex expressions in templates',
      category: 'Best Practices',
      recommended: true,
      url: VUE_STYLE_GUIDE,
    },
    schema: [
      {
        type: 'object',
        properties: {
          maxTernaryDepth: {
            type: 'number',
            default: 1,
          },
          maxLogicalOps: {
            type: 'number',
            default: 3,
          },
          allowedFunctions: {
            type: 'array',
            items: { type: 'string' },
          },
        },
        additionalProperties: false,
      },
    ],
    messages: {
      complexExpression: 'Template expression is too complex. Move to computed property or method. See: {{url}}',
    },
  },
  create(context: RuleContext<string, any[]>): RuleListener {
    const parserServices = (context.sourceCode?.parserServices ?? context.parserServices) as any
    const options = context.options[0] || {}
    const maxTernaryDepth = options.maxTernaryDepth ?? 1
    const maxLogicalOps = options.maxLogicalOps ?? 3
    const allowedFunctions = options.allowedFunctions || DEFAULT_WHITELIST
    
    if (!parserServices || !parserServices.defineTemplateBodyVisitor) {
      return {}
    }
    
    const countTernaryDepth = (node: any, depth = 0): number => {
      if (node.type === 'ConditionalExpression') {
        const trueDepth = countTernaryDepth(node.consequent, depth + 1)
        const falseDepth = countTernaryDepth(node.alternate, depth + 1)
        return Math.max(trueDepth, falseDepth)
      }
      return depth
    }
    
    const countLogicalOps = (node: any, count = 0): number => {
      if (
        node.type === 'LogicalExpression' &&
        (node.operator === '&&' || node.operator === '||')
      ) {
        const leftCount = countLogicalOps(node.left, count + 1)
        const rightCount = countLogicalOps(node.right, count + 1)
        return Math.max(leftCount, rightCount)
      }
      return count
    }
    
    const checkExpression = (node: any) => {
      // Check ternary depth
      const ternaryDepth = countTernaryDepth(node)
      if (ternaryDepth > maxTernaryDepth) {
        context.report({
          node,
          messageId: 'complexExpression',
          data: { url: VUE_STYLE_GUIDE },
        })
        return
      }
      
      // Check logical ops
      const logicalOps = countLogicalOps(node)
      if (logicalOps > maxLogicalOps) {
        context.report({
          node,
          messageId: 'complexExpression',
          data: { url: VUE_STYLE_GUIDE },
        })
        return
      }
      
      // Recursively check for function calls with arguments (unless whitelisted)
      const checkForDisallowedFunctionCalls = (n: any): void => {
        if (!n || typeof n !== 'object') return
        
        if (n.type === 'CallExpression' && n.arguments.length > 0) {
          const callee = n.callee
          if (
            callee.type === 'Identifier' &&
            !allowedFunctions.includes(callee.name)
          ) {
            context.report({
              node: n,
              messageId: 'complexExpression',
              data: { url: VUE_STYLE_GUIDE },
            })
          }
        }
        
        // Recursively check all child nodes
        for (const key in n) {
          if (key === 'parent' || key === 'loc' || key === 'range') continue
          const child = n[key]
          if (Array.isArray(child)) {
            child.forEach(checkForDisallowedFunctionCalls)
          } else if (child && typeof child === 'object') {
            checkForDisallowedFunctionCalls(child)
          }
        }
      }
      
      checkForDisallowedFunctionCalls(node)
    }
    
    return parserServices.defineTemplateBodyVisitor(
      {
        'VExpressionContainer[expression!=null]'(node: any) {
          checkExpression(node.expression)
        },
      },
      {}
    )
  },
}
