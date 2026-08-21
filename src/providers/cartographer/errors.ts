export type CartographerAdapterErrorCode =
  | "CARTOGRAPHER_MODEL_NOT_FOUND"
  | "CARTOGRAPHER_MODEL_UNREADABLE"
  | "CARTOGRAPHER_MODEL_INVALID_JSON"
  | "CARTOGRAPHER_MODEL_SHAPE_UNSUPPORTED"
  | "CARTOGRAPHER_ROOT_MISMATCH"
  | "CARTOGRAPHER_DUPLICATE_ID"
  | "CARTOGRAPHER_SLICE_NOT_FOUND"
  | "CARTOGRAPHER_SLICE_ENTITY_NOT_FOUND"
  | "CARTOGRAPHER_EVIDENCE_REFERENCE_INVALID";

export class CartographerAdapterError extends Error {
  readonly code: CartographerAdapterErrorCode;

  constructor(code: CartographerAdapterErrorCode, message: string, options?: ErrorOptions) {
    super(message, options);
    this.name = "CartographerAdapterError";
    this.code = code;
  }
}
