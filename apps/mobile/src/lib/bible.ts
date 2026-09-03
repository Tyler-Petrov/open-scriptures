// Book metadata and verse-reference helpers are shared with the backend.
// Scripture text is loaded from Convex by `scripture.ts`.
export {
  BOOKS,
  findBook,
  getBookMeta,
  getChapterCount,
  ref,
  type BookMeta,
} from "@openscripture/core";
