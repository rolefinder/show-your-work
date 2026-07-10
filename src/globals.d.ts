import type * as ReactNS from "react";
import type * as ReactDOMNS from "react-dom";

declare global {
  // Vendored UMD builds expose these globals (see index.html).
  // eslint-disable-next-line no-var
  var React: typeof ReactNS;
  // eslint-disable-next-line no-var
  var ReactDOM: typeof ReactDOMNS;

  namespace React {
    type ReactNode = ReactNS.ReactNode;
    type MouseEvent = ReactNS.MouseEvent;
    type KeyboardEvent = ReactNS.KeyboardEvent;
    type ChangeEvent<T = Element> = ReactNS.ChangeEvent<T>;
    type DragEvent = ReactNS.DragEvent;
    type FormEvent = ReactNS.FormEvent;
  }
}

export {};
