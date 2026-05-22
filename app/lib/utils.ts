/**
 * Extracts the first displayable text character from a string,
 * skipping leading emojis or special characters if possible.
 * If no plain text is found, it returns the first Unicode grapheme.
 */
export function getFirstTextChar(title: string): string {
  if (!title) return "";

  // Regular expression to match the first alphanumeric or CJK character
  const textMatch = title.match(/[\u4e00-\u9fa5a-zA-Z0-9]/);

  if (textMatch) {
    return textMatch[0];
  }

  // Fallback to the first character (using Array.from to handle multi-byte Unicode/Emoji)
  return Array.from(title)[0] || "";
}
