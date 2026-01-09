import { App, AbstractInputSuggest } from "obsidian";

export abstract class TextInputSuggest<T> extends AbstractInputSuggest<T> {
  constructor(
    app: App,
    protected inputEl: HTMLInputElement | HTMLTextAreaElement,
  ) {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    super(app, inputEl as any);
  }

  abstract getSuggestions(inputStr: string): T[];
  abstract renderSuggestion(item: T, el: HTMLElement): void;
  abstract selectSuggestion(item: T, evt: MouseEvent | KeyboardEvent): void;
}
