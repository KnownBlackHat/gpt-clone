import { createRequire } from 'module';
const require = createRequire(import.meta.url);
import path from 'path';

console.log('--- MODERN PDF-PARSE FINAL TEST ---');

try {
    const pdfModule = require('pdf-parse');
    const PDFParse = pdfModule.PDFParse;

    const dummyBuffer = Buffer.from('%PDF-1.0\n1 0 obj\n<< /Type /Catalog >>\nendobj\ntrailer\n<< /Root 1 0 R >>\n%%EOF');
    const uint8Array = new Uint8Array(dummyBuffer);

    const fontPath = path.join(process.cwd(), 'node_modules', 'pdfjs-dist', 'standard_fonts', '/');

    console.log('Initializing parser...');
    const parser = new PDFParse({
        data: uint8Array,
        standardFontDataUrl: fontPath
    });

    console.log('Calling getText()...');
    const result = await parser.getText();

    console.log('Result keys:', Object.keys(result));
    console.log('Text content:', result.text);

    if (result.text !== undefined) {
        console.log('SUCCESS: result.text is present.');
    } else {
        console.log('FAILURE: result.text is undefined.');
    }

    await parser.destroy();
} catch (err) {
    console.error('CRITICAL ERROR:', err.message);
}
