const fs = require('fs');
const path = require('path');

const transcriptPath = path.join(
  'C:',
  'Users',
  'Marek Zientek',
  '.gemini',
  'antigravity',
  'brain',
  '22eba662-d8f5-46a4-ae0d-f4469668e0c0',
  '.system_generated',
  'logs',
  'transcript.jsonl'
);

try {
  const content = fs.readFileSync(transcriptPath, 'utf8');
  const lines = content.split('\n');
  lines.forEach((line, index) => {
    if (!line.trim()) return;
    try {
      const parsed = JSON.parse(line);
      // Let's print out all MODEL replies where the user asked something like "rozwój" or "plany"
      // or print out all USER inputs to trace the conversation sequence
      if (parsed.type === 'USER_INPUT') {
        console.log(`[Line ${index}] USER: ${parsed.content.substring(0, 400)}`);
      }
      
      // Let's also check for MODEL replies that contain bullet lists of features or "rekomendacje" or "dalszy rozwój"
      if (parsed.source === 'MODEL' && parsed.type === 'PLANNER_RESPONSE' && parsed.content) {
        const text = parsed.content.toLowerCase();
        if (text.includes('dalszy rozwój') || text.includes('rekomendac') || text.includes('kolejn') || text.includes('faza') || text.includes('etap')) {
          console.log(`[Line ${index}] MODEL (matches roadmap/faza/etap): ${parsed.content.substring(0, 500)}...\n`);
        }
      }
    } catch (e) {
      // Ignore JSON parse errors
    }
  });
} catch (err) {
  console.error('Error reading transcript:', err);
}
