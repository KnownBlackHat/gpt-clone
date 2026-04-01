const fs = require('fs');
const file = 'src/routes/(app)/quiz/+page.svelte';
let content = fs.readFileSync(file, 'utf-8');

// Replace all occurrences of word 'state' that are not preceded by '$'
content = content.replace(/(?<!\$)\bstate\b/g, 'quizState');

fs.writeFileSync(file, content);
console.log('Fixed state variable');
