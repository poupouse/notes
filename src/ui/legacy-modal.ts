export interface LegacyModalRequest {
  eyebrow: string;
  title: string;
  fields: string;
  submit: string;
  destructive?: boolean;
  save: (data: FormData) => void;
}

export interface LegacyModalBridge {
  open: (request: LegacyModalRequest) => void;
  close: () => void;
  setError: (message: string) => void;
}
