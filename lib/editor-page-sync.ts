/** Plain contentEditable helpers — visual caret/selection come from letterLayout. */

export function getEditorStoredText(editor: HTMLElement): string {
  return (editor.textContent ?? '').replace(/\r\n/g, '\n');
}

export function setEditorPlainText(editor: HTMLElement, value: string) {
  editor.textContent = value;
}

export function getOffsetFromNode(editor: HTMLElement, node: Node, offset: number): number {
  const walker = document.createTreeWalker(editor, NodeFilter.SHOW_TEXT);
  let total = 0;
  let current = walker.nextNode();

  while (current) {
    if (current === node) {
      return total + offset;
    }
    total += current.textContent?.length ?? 0;
    current = walker.nextNode();
  }

  return total;
}

export function getEditorPlainText(editor: HTMLElement): string {
  return getEditorStoredText(editor);
}
