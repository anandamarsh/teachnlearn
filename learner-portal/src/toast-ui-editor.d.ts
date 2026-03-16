declare module "@toast-ui/editor" {
  export type EditorOptions = {
    el: HTMLElement;
    initialValue?: string;
    initialEditType?: "markdown" | "wysiwyg";
    previewStyle?: "vertical" | "tab";
    height?: string;
    hideModeSwitch?: boolean;
    usageStatistics?: boolean;
    autofocus?: boolean;
    toolbarItems?: Array<Array<string>>;
  };

  export class Editor {
    constructor(options: EditorOptions);
    destroy(): void;
    on(eventName: string, handler: () => void): void;
    getMarkdown(): string;
    setMarkdown(value: string, cursorToEnd?: boolean): void;
  }
}
