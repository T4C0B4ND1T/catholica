/**
 * Splits text into chunks of at most `max` characters for text to speech (long utterances get cut off by some
 * browsers). Breaks fall on sentence ends where possible, otherwise between words, never inside one; a single
 * word longer than `max` stays whole.
 */
export function speakChunks(text: string, max = 200): string[] {
  const sentences = text.replace(/\s+/g, ' ').trim().match(/[^.!?]+(?:[.!?]+["'”’)\]]*|$)/g) ?? [];
  const chunks: string[] = [];
  let current = '';

  const flush = () => {
    if (current) chunks.push(current);
    current = '';
  };

  for (const raw of sentences) {
    const sentence = raw.trim();
    if (!sentence) continue;
    if (sentence.length > max) {
      flush();
      for (const word of sentence.split(' ')) {
        if (current && current.length + 1 + word.length > max) flush();
        current = current ? `${current} ${word}` : word;
      }
      continue;
    }
    if (current && current.length + 1 + sentence.length > max) flush();
    current = current ? `${current} ${sentence}` : sentence;
  }
  flush();
  return chunks;
}
