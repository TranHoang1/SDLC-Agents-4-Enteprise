/**
 * KSA-164: CFG Builder — Constructs control flow graphs from AST function nodes.
 * Handles if/else, loops, try/catch, switch, and early returns.
 */

import type { SyntaxNode } from '../../../parsers/types.js';
import { BasicBlock } from './BasicBlock.js';
import { ControlFlowGraph } from './ControlFlowGraph.js';

export class CFGBuilder {
  private blockCounter = 0;
  private cfg!: ControlFlowGraph;

  /** Build CFG from a function AST node. */
  build(functionNode: SyntaxNode, language: string): ControlFlowGraph {
    this.blockCounter = 0;

    const entry = this.newBlock('entry');
    this.cfg = new ControlFlowGraph(entry);

    const exit = this.newBlock('exit');
    this.cfg.addBlock(exit);

    const body = this.getFunctionBody(functionNode, language);
    if (!body) {
      this.cfg.addEdge(entry, exit, 'sequential');
      return this.cfg;
    }

    const lastBlock = this.processStatements(body, entry, exit);
    if (lastBlock && lastBlock !== exit) {
      this.cfg.addEdge(lastBlock, exit, 'sequential');
    }

    return this.cfg;
  }

  private getFunctionBody(node: SyntaxNode, language: string): SyntaxNode | null {
    const body = node.childForFieldName('body');
    if (body) return body;
    for (let i = 0; i < node.namedChildCount; i++) {
      const child = node.namedChild(i);
      if (child && (child.type === 'statement_block' || child.type === 'block')) {
        return child;
      }
    }
    return null;
  }

  private processStatements(blockNode: SyntaxNode, currentBlock: BasicBlock, exitBlock: BasicBlock): BasicBlock | null {
    let active: BasicBlock | null = currentBlock;
    for (let i = 0; i < blockNode.namedChildCount; i++) {
      const stmt = blockNode.namedChild(i);
      if (!stmt || !active) break;
      active = this.processStatement(stmt, active, exitBlock);
    }
    return active;
  }

  private processStatement(stmt: SyntaxNode, currentBlock: BasicBlock, exitBlock: BasicBlock): BasicBlock | null {
    switch (stmt.type) {
      case 'if_statement':
        return this.handleIf(stmt, currentBlock, exitBlock);
      case 'while_statement':
      case 'do_statement':
        return this.handleWhile(stmt, currentBlock, exitBlock);
      case 'for_statement':
      case 'for_in_statement':
        return this.handleFor(stmt, currentBlock, exitBlock);
      case 'try_statement':
        return this.handleTryCatch(stmt, currentBlock, exitBlock);
      case 'switch_statement':
        return this.handleSwitch(stmt, currentBlock, exitBlock);
      case 'return_statement':
        currentBlock.addStatement(stmt);
        this.cfg.addEdge(currentBlock, exitBlock, 'return');
        return null;
      case 'throw_statement':
        currentBlock.addStatement(stmt);
        this.cfg.addEdge(currentBlock, exitBlock, 'exception');
        return null;
      case 'break_statement':
      case 'continue_statement':
        currentBlock.addStatement(stmt);
        return null;
      default:
        currentBlock.addStatement(stmt);
        return currentBlock;
    }
  }

  private handleIf(node: SyntaxNode, currentBlock: BasicBlock, exitBlock: BasicBlock): BasicBlock | null {
    const condNode = node.childForFieldName('condition');
    if (condNode) currentBlock.addStatement(condNode);

    const mergeBlock = this.newBlock('normal');
    this.cfg.addBlock(mergeBlock);

    const consequence = node.childForFieldName('consequence');
    const thenBlock = this.newBlock('normal');
    this.cfg.addBlock(thenBlock);
    this.cfg.addEdge(currentBlock, thenBlock, 'branch-true');

    let thenEnd: BasicBlock | null = thenBlock;
    if (consequence) {
      thenEnd = this.processBlockOrStatement(consequence, thenBlock, exitBlock);
    }
    if (thenEnd) this.cfg.addEdge(thenEnd, mergeBlock, 'sequential');

    const alternative = node.childForFieldName('alternative');
    if (alternative) {
      const elseBlock = this.newBlock('normal');
      this.cfg.addBlock(elseBlock);
      this.cfg.addEdge(currentBlock, elseBlock, 'branch-false');

      const elseBody = alternative.type === 'else_clause' ? alternative.namedChild(0) : alternative;
      let elseEnd: BasicBlock | null = elseBlock;
      if (elseBody) {
        if (elseBody.type === 'if_statement') {
          elseEnd = this.handleIf(elseBody, elseBlock, exitBlock);
        } else {
          elseEnd = this.processBlockOrStatement(elseBody, elseBlock, exitBlock);
        }
      }
      if (elseEnd) this.cfg.addEdge(elseEnd, mergeBlock, 'sequential');
    } else {
      this.cfg.addEdge(currentBlock, mergeBlock, 'branch-false');
    }

    return mergeBlock;
  }

  private handleWhile(node: SyntaxNode, currentBlock: BasicBlock, exitBlock: BasicBlock): BasicBlock | null {
    const headerBlock = this.newBlock('loop-header');
    this.cfg.addBlock(headerBlock);
    this.cfg.addEdge(currentBlock, headerBlock, 'sequential');

    const condNode = node.childForFieldName('condition');
    if (condNode) headerBlock.addStatement(condNode);

    const postLoop = this.newBlock('normal');
    this.cfg.addBlock(postLoop);

    const body = node.childForFieldName('body');
    const bodyBlock = this.newBlock('normal');
    this.cfg.addBlock(bodyBlock);
    this.cfg.addEdge(headerBlock, bodyBlock, 'branch-true');
    this.cfg.addEdge(headerBlock, postLoop, 'loop-exit');

    let bodyEnd: BasicBlock | null = bodyBlock;
    if (body) bodyEnd = this.processBlockOrStatement(body, bodyBlock, exitBlock);
    if (bodyEnd) this.cfg.addEdge(bodyEnd, headerBlock, 'loop-back');

    return postLoop;
  }

  private handleFor(node: SyntaxNode, currentBlock: BasicBlock, exitBlock: BasicBlock): BasicBlock | null {
    const init = node.childForFieldName('initializer');
    if (init) currentBlock.addStatement(init);

    const headerBlock = this.newBlock('loop-header');
    this.cfg.addBlock(headerBlock);
    this.cfg.addEdge(currentBlock, headerBlock, 'sequential');

    const condNode = node.childForFieldName('condition');
    if (condNode) headerBlock.addStatement(condNode);

    const postLoop = this.newBlock('normal');
    this.cfg.addBlock(postLoop);

    const body = node.childForFieldName('body');
    const bodyBlock = this.newBlock('normal');
    this.cfg.addBlock(bodyBlock);
    this.cfg.addEdge(headerBlock, bodyBlock, 'branch-true');
    this.cfg.addEdge(headerBlock, postLoop, 'loop-exit');

    let bodyEnd: BasicBlock | null = bodyBlock;
    if (body) bodyEnd = this.processBlockOrStatement(body, bodyBlock, exitBlock);

    const increment = node.childForFieldName('increment');
    if (increment && bodyEnd) bodyEnd.addStatement(increment);
    if (bodyEnd) this.cfg.addEdge(bodyEnd, headerBlock, 'loop-back');

    return postLoop;
  }

  private handleTryCatch(node: SyntaxNode, currentBlock: BasicBlock, exitBlock: BasicBlock): BasicBlock | null {
    const mergeBlock = this.newBlock('normal');
    this.cfg.addBlock(mergeBlock);

    const tryBody = node.childForFieldName('body');
    const tryBlock = this.newBlock('normal');
    this.cfg.addBlock(tryBlock);
    this.cfg.addEdge(currentBlock, tryBlock, 'sequential');

    let tryEnd: BasicBlock | null = tryBlock;
    if (tryBody) tryEnd = this.processBlockOrStatement(tryBody, tryBlock, exitBlock);
    if (tryEnd) this.cfg.addEdge(tryEnd, mergeBlock, 'sequential');

    const handler = node.childForFieldName('handler');
    if (handler) {
      const catchBlock = this.newBlock('catch');
      this.cfg.addBlock(catchBlock);
      this.cfg.addEdge(tryBlock, catchBlock, 'exception');

      const catchBody = handler.childForFieldName('body');
      let catchEnd: BasicBlock | null = catchBlock;
      if (catchBody) catchEnd = this.processBlockOrStatement(catchBody, catchBlock, exitBlock);
      if (catchEnd) this.cfg.addEdge(catchEnd, mergeBlock, 'sequential');
    }

    const finalizer = node.childForFieldName('finalizer');
    if (finalizer) {
      const finallyBlock = this.newBlock('normal');
      this.cfg.addBlock(finallyBlock);
      this.cfg.addEdge(mergeBlock, finallyBlock, 'sequential');
      const finallyBody = finalizer.namedChild(0);
      if (finallyBody) this.processBlockOrStatement(finallyBody, finallyBlock, exitBlock);
      return finallyBlock;
    }

    return mergeBlock;
  }

  private handleSwitch(node: SyntaxNode, currentBlock: BasicBlock, exitBlock: BasicBlock): BasicBlock | null {
    const value = node.childForFieldName('value');
    if (value) currentBlock.addStatement(value);

    const mergeBlock = this.newBlock('normal');
    this.cfg.addBlock(mergeBlock);

    const body = node.childForFieldName('body');
    if (!body) return mergeBlock;

    for (let i = 0; i < body.namedChildCount; i++) {
      const caseNode = body.namedChild(i);
      if (!caseNode) continue;

      const caseBlock = this.newBlock('normal');
      this.cfg.addBlock(caseBlock);
      this.cfg.addEdge(currentBlock, caseBlock, 'branch-true');

      let caseEnd: BasicBlock | null = caseBlock;
      for (let j = 0; j < caseNode.namedChildCount; j++) {
        const stmt = caseNode.namedChild(j);
        if (!stmt || !caseEnd) break;
        if (stmt.type === 'switch_case' || stmt.type === 'switch_default') continue;
        caseEnd = this.processStatement(stmt, caseEnd, exitBlock);
      }
      if (caseEnd) this.cfg.addEdge(caseEnd, mergeBlock, 'sequential');
    }

    return mergeBlock;
  }

  private processBlockOrStatement(node: SyntaxNode, currentBlock: BasicBlock, exitBlock: BasicBlock): BasicBlock | null {
    if (node.type === 'statement_block' || node.type === 'block') {
      return this.processStatements(node, currentBlock, exitBlock);
    }
    return this.processStatement(node, currentBlock, exitBlock);
  }

  private newBlock(type: BasicBlock['type']): BasicBlock {
    return new BasicBlock(this.blockCounter++, type);
  }
}