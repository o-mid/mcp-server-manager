/**
 * Common type definitions
 */

/** Generic result type for operations */
export interface Result<T = void> {
  success: boolean;
  data?: T;
  error?: string;
}

/** Async result type */
export type AsyncResult<T = void> = Promise<Result<T>>;

/** CLI options passed to command handlers */
export interface CliOptions {
  /** Positional arguments */
  positional: string[];
  /** Named flags */
  flags: Record<string, boolean | string | number>;
}

/** JSON output flag */
export interface JsonOutputOptions {
  json?: boolean;
}

/** Force flag options */
export interface ForceOptions {
  force?: boolean;
  yes?: boolean;
  y?: boolean;
}

/** Pagination options */
export interface PaginationOptions {
  offset?: number;
  limit?: number;
}

/** Sort options */
export interface SortOptions {
  sortBy?: string;
  sortOrder?: "asc" | "desc";
}

/** Filter options */
export interface FilterOptions {
  filter?: string;
  search?: string;
}

/** Common list options */
export interface ListOptions
  extends JsonOutputOptions, PaginationOptions, SortOptions, FilterOptions {}

/** Key-value pair */
export interface KeyValue<T = string> {
  key: string;
  value: T;
}

/** Named item */
export interface NamedItem {
  id: string;
  name: string;
}

/** Item with description */
export interface DescribedItem extends NamedItem {
  description?: string;
}

/** Callback function types */
export type VoidCallback = () => void;
export type AsyncVoidCallback = () => Promise<void>;
export type DataCallback<T> = (data: T) => void;
export type AsyncDataCallback<T> = (data: T) => Promise<void>;

/** Event handler */
export type EventHandler<T = void> = T extends void ? VoidCallback : DataCallback<T>;

/** Cleanup function */
export type CleanupFunction = VoidCallback;
