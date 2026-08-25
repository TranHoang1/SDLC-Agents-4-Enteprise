import { describe, it, expect } from 'vitest';
import { SlashMenuController } from '../SlashMenuController';

describe('SlashMenuController', () => {
  it('registers and invokes skill', () => {
    const ctrl = new SlashMenuController();
    ctrl.registerSkill('browser-harness', 'Browser automation');
    const items = ctrl.getMenuItems();
    expect(items).toHaveLength(1);
    expect(ctrl.invoke('/browser-harness')).toBe('/browser-harness');
  });
});
