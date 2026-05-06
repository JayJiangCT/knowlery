import { readFileSync } from 'fs';
import { describe, expect, it } from 'vitest';

describe('icon action tooltips', () => {
  it('does not render tooltips with button pseudo-elements', () => {
    const css = readFileSync('styles.css', 'utf8');

    expect(css).not.toContain('.knowlery-icon-action::after');
    expect(css).not.toContain('content: attr(data-tooltip)');
  });
});
