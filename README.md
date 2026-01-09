# Book Search Plus

**Book Search Plus** is a significant modification of the original *Book Search* plugin by anpigon. This version does NOT contain the Naver (Korean) service, but introduces a scraping feature for **Goodreads** and an import of data from local **Calibre** libraries. It retains the option to search via **Google Books**.

## Features

* **Unified Search Selection**: You no longer need to switch services in the settings. Clicking the ribbon icon prompts you to choose your source immediately: Google Books, Goodreads, or Calibre.
* **Google Books Integration**: Search for and import book metadata and covers directly from Google Books.
* **Goodreads Support**: Import book details and covers from Goodreads.
* **Calibre Integration**: Connect to your local Calibre library to import metadata and covers.
* **Language Improvements**: With the original plugin, regardless of the language selected for Google, results are based on the language used in the title. This is problematic when searching for books with universal titles such as “JavaScript” or “Python”. This version forces Google to provide results specifically in your selected language.

## Calibre Setup

To import data from your local Calibre library, you must enable the Calibre Content Server to allow Obsidian to communicate with it.

1.  Open **Calibre**.
2.  Navigate to **Preferences** > **Sharing** > **Sharing over the net**.
3.  Click **Start Server**.
4.  Ensure the port is set to `8080` (or configure the plugin settings to match your custom port).
5.  Go to Obsidian, open the Book Search Plus settings and make sure to put the same port for Calibre. 

## Recommended Template

You can customise the frontmatter to suit your workflow. Below is the recommended configuration, utilising Spanish metadata keys.

> **Note:** The Templater code block included below the frontmatter is specifically required for **Google Books** imports. Both Goodreads and Calibre integrations generally function correctly without this additional logic.

```markdown
---
title: "{{title}}"
originalTitle:
author: "{{author}}"
translator:
foreword:
description: "{{description}}"
pages:
publisher: "{{publisher}}"
narrator:
category: "{{category}}"
isbn10: "{{isbn10}}"
isbn13: "{{isbn13}}"
asin:
publishDate: "{{publishDate}}"
readDate:
cover: "{{coverUrl}}"
tags:
highlights:
read: false
---

<%*
/* 1. Renders the image in the note body using Obsidian embedding syntax */
/* NOTE: This section is only required for Google Books imports */
const cover = tp.frontmatter["cover"];
if (cover && cover !== "undefined" && cover.trim() !== "") {
    /* Since we removed brackets in frontmatter, we add them here */
    tR += `![[${cover}|300]]`;
}
%>

<%*
/* 2. Renaming Logic */
/* NOTE: This section is only required for Google Books imports */
const title = tp.frontmatter["title"] || tp.frontmatter.title || "Untitled";
await tp.file.rename(`${title}`);
%>
```

### Credits

Based on the original [obsidian-book-search-plugin](https://github.com/anpigon/obsidian-book-search-plugin) by [anpigon](https://github.com/anpigon).v


Credits

Based on the original obsidian-book-search-plugin by anpigon.
