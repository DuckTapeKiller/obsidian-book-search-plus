import { Book } from "@models/book.model";
import { App, normalizePath, Notice, TFile } from "obsidian";

export async function getTemplateContents(
  app: App,
  templatePath: string | undefined,
): Promise<string> {
  const { metadataCache, vault } = app;
  const normalizedTemplatePath = normalizePath(templatePath ?? "");
  if (templatePath === "/") {
    return "";
  }

  try {
    const templateFile = metadataCache.getFirstLinkpathDest(
      normalizedTemplatePath,
      "",
    );
    // Fix: Added await to ensure we return a string, not a Promise
    return templateFile ? await vault.cachedRead(templateFile) : "";
  } catch (err) {
    console.error(
      `Failed to read the daily note template '${normalizedTemplatePath}'`,
      err,
    );
    new Notice("Failed to read the daily note template");
    return "";
  }
}

export function applyTemplateTransformations(
  rawTemplateContents: string,
): string {
  return rawTemplateContents.replace(
    /{{\s*(date|time)\s*(([+-]\d+)([yqmwdhs]))?\s*(:.+?)?}}/gi,
    (_, _timeOrDate, calc, timeDelta, unit, momentFormat) => {
      const now = window.moment();
      const currentDate = window
        .moment()
        .clone()
        .set({
          hour: now.get("hour"),
          minute: now.get("minute"),
          second: now.get("second"),
        });
      if (calc) {
        // Fix: Cast unit to correct moment type to satisfy linter
        currentDate.add(parseInt(timeDelta, 10), unit as moment.unitOfTime.DurationConstructor);
      }

      if (momentFormat) {
        return currentDate.format(momentFormat.substring(1).trim());
      }
      return currentDate.format("YYYY-MM-DD");
    },
  );
}

export function executeInlineScriptsTemplates(book: Book, text: string) {
  const commandRegex = /<%(?:=)(.+)%>/g;
  const matchedList = [...text.matchAll(commandRegex)];
  return matchedList.reduce((result, [matched, script]) => {
    try {
      // Fix: Direct Function usage. NOTE: This still triggers "Implied Eval" and requires /skip
      const func = new Function(
        "book",
        [
          "const output = " + script,
          'if(typeof output === "string") return output',
          "return JSON.stringify(output)",
        ].join(";")
      );
      const outputs = func(book);
      return result.replace(matched, outputs);
    } catch (err) {
      console.warn(err);
    }
    return result;
  }, text);
}

// Removed getFunctionConstructor as it was unnecessary indirection

export async function useTemplaterPluginInFile(app: App, file: TFile) {
  // @ts-ignore
  const templater = app.plugins.plugins["templater-obsidian"];
  if (templater && !templater?.settings["trigger_on_file_creation"]) {
    await templater.templater.overwrite_file_commands(file);
  }
}
