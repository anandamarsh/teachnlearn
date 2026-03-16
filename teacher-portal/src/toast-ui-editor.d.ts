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

  export type ViewerOptions = {
    el: HTMLElement;
    initialValue?: string;
  };

  export class Editor {
    constructor(options: EditorOptions);
    destroy(): void;
    on(eventName: string, handler: () => void): void;
    getMarkdown(): string;
    setMarkdown(value: string, cursorToEnd?: boolean): void;
  }

  export class Viewer {
    constructor(options: ViewerOptions);
    destroy(): void;
    getMarkdown(): string;
    setMarkdown(value: string): void;
  }
}

declare module "@toast-ui/editor/viewer" {
  import type { Viewer, ViewerOptions } from "@toast-ui/editor";
  export type { ViewerOptions };
  const ToastViewer: typeof Viewer;
  export default ToastViewer;
}
