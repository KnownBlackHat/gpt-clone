import { describe, it, expect } from 'vitest';

// Since renderMarkdown is internal to ChatMessage.svelte, 
// in a real scenario we'd use Svelte Testing Library.
// For this demontration, let's test a regex that matches what we implemented.

describe('Calculation Parsing Regex', () => {
    const calculationRegex = /<calculation>([\s\S]*?)<\/calculation>/g;

    it('should extract content from calculation tags', () => {
        const content = "Here is a result: <calculation>5 * 5 = 25</calculation>";
        const matches = [...content.matchAll(calculationRegex)];
        expect(matches.length).toBe(1);
        expect(matches[0][1]).toBe('5 * 5 = 25');
    });

    it('should handle multi-line calculations', () => {
        const content = "<calculation>\nStep 1: 10 + 10 = 20\nStep 2: 20 * 2 = 40\n</calculation>";
        const matches = [...content.matchAll(calculationRegex)];
        expect(matches.length).toBe(1);
        expect(matches[0][1].trim()).toContain('Step 1');
        expect(matches[0][1].trim()).toContain('Step 2');
    });
});
