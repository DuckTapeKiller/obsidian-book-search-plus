import { Book, FrontMatter } from "@models/book.model";
import { DefaultFrontmatterKeyType } from "@settings/settings";

// == Format Syntax == //
export const NUMBER_REGEX = /^-?[0-9]*$/;
export const DATE_REGEX = /{{DATE(\+-?[0-9]+)?}}/;
export const DATE_REGEX_FORMATTED = /{{DATE:([^}\n\r+]*)(\+-?[0-9]+)?}}/;

export function replaceIllegalFileNameCharactersInString(text: string) {
  return text.replace(/[\\,#%&{}/*<>$":@.?|]/g, "").replace(/\s+/g, " ");
}

export function isISBN(str: string) {
  return /^(97(8|9))?\d{9}(\d|X)$/.test(str);
}

export function makeFileName(
  book: Book,
  fileNameFormat?: string,
  extension = "md",
) {
  let result;
  if (fileNameFormat) {
    result = replaceVariableSyntax(book, replaceDateInString(fileNameFormat));
  } else {
    result = !book.author ? book.title : `${book.title} - ${book.author}`;
  }
  return replaceIllegalFileNameCharactersInString(result) + `.${extension}`;
}

export function changeSnakeCase(book: Book) {
  return Object.entries(book).reduce((acc, [key, value]) => {
    acc[camelToSnakeCase(key)] = value;
    return acc;
  }, {});
}

export function applyDefaultFrontMatter(
  book: Book,
  frontmatter: FrontMatter | string,
  keyType: DefaultFrontmatterKeyType = DefaultFrontmatterKeyType.snakeCase,
) {
  const frontMater =
    keyType === DefaultFrontmatterKeyType.camelCase
      ? book
      : changeSnakeCase(book);

  const extraFrontMatter =
    typeof frontmatter === "string"
      ? parseFrontMatter(frontmatter)
      : frontmatter;
  for (const key in extraFrontMatter) {
    const value = extraFrontMatter[key]?.toString().trim() ?? "";

    // logic to prevent overwriting existing data with empty strings from default template
    if (value === "") {
      if (
        frontMater[key] !== undefined &&
        frontMater[key] !== null &&
        frontMater[key] !== ""
      ) {
        // keep existing value
        continue;
      }
    }

    if (frontMater[key] && frontMater[key] !== value) {
      if (Array.isArray(frontMater[key])) {
        // if array, and we have a new value, we might want to append or ignore.
        // But since value is string, we typically don't merge string into array unless specific logic.
        // For now, if user provides string for array field, we ignore if empty, or replace if not empty (risky but standard behavior)
        // But we already continued if value is empty.
        if (value) {
          // Trying to append string to array? Or replace?
          // Standard behavior was appending string with comma.
          // Let's stick to avoiding mangling if value is present.
          frontMater[key] = `${frontMater[key]}, ${value}`;
        }
      } else {
        frontMater[key] = `${frontMater[key]}, ${value}`;
      }
    } else {
      frontMater[key] = value;
    }
  }

  return frontMater as object;
}

export function replaceVariableSyntax(book: Book, text: string): string {
  if (!text?.trim()) {
    return "";
  }

  const entries = Object.entries(book);

  return entries
    .reduce((result, [key, val = ""]) => {
      if (Array.isArray(val)) {
        const listString = val.map((v) => `\n  - ${v}`).join("");
        // Check if the variable is wrapped in quotes in the template: "{{key}}"
        const quotedRegex = new RegExp(`['"]{{${key}}}['"]`, "ig");
        if (quotedRegex.test(result)) {
          // Replace the entire quoted string with the list string (unquoted)
          // We need to return result with the REPLACED content.
          // BUT we are doing this in a reduce, so we must operate on 'result'.
          return result.replace(quotedRegex, listString);
        }

        return result.replace(new RegExp(`{{${key}}}`, "ig"), listString);
      }
      let stringVal = String(val); // Safely convert numbers/nulls to string
      if (stringVal.includes('"')) {
        let isOpening = true;
        stringVal = stringVal.replace(/"/g, () => {
          const char = isOpening ? "«" : "»";
          isOpening = !isOpening;
          return char;
        });
      }
      return result.replace(new RegExp(`{{${key}}}`, "ig"), stringVal);
    }, text)
    .replace(/{{\w+}}/gi, "")
    .trim();
}

export function camelToSnakeCase(str) {
  return str.replace(/[A-Z]/g, (letter) => `_${letter?.toLowerCase()}`);
}

export function parseFrontMatter(frontMatterString: string) {
  if (!frontMatterString) return {};
  return frontMatterString
    .split("\n")
    .map((item) => {
      const index = item.indexOf(":");
      if (index === -1) return [item.trim(), ""];

      const key = item.slice(0, index)?.trim();
      const value = item.slice(index + 1)?.trim();
      return [key, value];
    })
    .reduce((acc, [key, value]) => {
      if (key) {
        acc[key] = value?.trim() ?? "";
      }
      return acc;
    }, {});
}

export function toStringFrontMatter(frontMatter: object): string {
  return Object.entries(frontMatter)
    .map(([key, newValue]) => {
      if (Array.isArray(newValue)) {
        if (newValue.length === 0) return "";
        const listValues = newValue.map((v) => `  - ${v}`).join("\n");
        return `${key}:\n${listValues}\n`;
      }

      const stringValue = newValue?.toString().trim() ?? "";
      if (/\r|\n/.test(stringValue)) {
        return "";
      }
      if (/:\s/.test(stringValue) || /"/.test(stringValue)) {
        let isOpening = true;
        const escapedValue = stringValue.replace(/"/g, () => {
          const char = isOpening ? "«" : "»";
          isOpening = !isOpening;
          return char;
        });
        return `${key}: "${escapedValue}"\n`;
      }
      return `${key}: ${stringValue}\n`;
    })
    .join("")
    .trim();
}

export function getDate(input?: { format?: string; offset?: number }) {
  let duration;

  if (
    input?.offset !== null &&
    input?.offset !== undefined &&
    typeof input.offset === "number"
  ) {
    duration = window.moment.duration(input.offset, "days");
  }

  return input?.format
    ? window.moment().add(duration).format(input?.format)
    : window.moment().add(duration).format("YYYY-MM-DD");
}

export function replaceDateInString(input: string) {
  let output: string = input;

  while (DATE_REGEX.test(output)) {
    const dateMatch = DATE_REGEX.exec(output);
    let offset = 0;

    if (dateMatch?.[1]) {
      const offsetString = dateMatch[1].replace("+", "").trim();
      const offsetIsInt = NUMBER_REGEX.test(offsetString);
      if (offsetIsInt) offset = parseInt(offsetString);
    }
    output = replacer(output, DATE_REGEX, getDate({ offset }));
  }

  while (DATE_REGEX_FORMATTED.test(output)) {
    const dateMatch = DATE_REGEX_FORMATTED.exec(output);
    const format = dateMatch?.[1];
    let offset = 0;

    if (dateMatch?.[2]) {
      const offsetString = dateMatch[2].replace("+", "").trim();
      const offsetIsInt = NUMBER_REGEX.test(offsetString);
      if (offsetIsInt) offset = parseInt(offsetString);
    }

    output = replacer(
      output,
      DATE_REGEX_FORMATTED,
      getDate({ format, offset }),
    );
  }

  return output;
}

function replacer(str: string, reg: RegExp, replaceValue) {
  return str.replace(reg, function () {
    return replaceValue;
  });
}

export function createBookTags(book: Book): string[] {
  const sanitize = (str: string) => {
    return str
      .toLowerCase()
      .replace(/\s+/g, "_")
      .replace(/[^\p{L}\p{N}_]/gu, ""); // Allow all unicode letters/numbers (accents supported)
  };

  const tags = [];
  if (book.author) {
    tags.push(sanitize(book.author));
  }
  if (book.title) {
    tags.push(sanitize(book.title));
  }
  return tags;
}
