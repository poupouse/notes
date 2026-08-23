export interface AppModalOption {
  value: string | number;
  label: string;
}

export type AppModalField =
  | {
    kind: 'input';
    name: string;
    label: string;
    value?: string | number;
    inputType?: 'text' | 'number';
    placeholder?: string;
    help?: string;
    required?: boolean;
    min?: number;
    max?: number;
    step?: number;
  }
  | {
    kind: 'textarea';
    name: string;
    label: string;
    value?: string;
    placeholder?: string;
    help?: string;
    required?: boolean;
    rows?: number;
  }
  | {
    kind: 'select';
    name: string;
    label: string;
    value?: string | number;
    help?: string;
    options: AppModalOption[];
  }
  | {
    kind: 'checkbox';
    name: string;
    label: string;
    checked?: boolean;
  }
  | {
    kind: 'message';
    text: string;
    className: 'confirmation-message' | 'form-hint';
  }
  | {
    kind: 'group';
    className: string;
    fields: AppModalField[];
  };

export interface AppModalRequest {
  eyebrow: string;
  title: string;
  fields: AppModalField[];
  submit: string;
  destructive?: boolean;
  save: (data: FormData) => void;
}

export interface AppModalBridge {
  open: (request: AppModalRequest) => void;
  close: () => void;
  setError: (message: string) => void;
}
