import { Modal, Setting } from "obsidian";
import BookSearchPlugin from "@src/main";

export class ServiceSelectionModal extends Modal {
  constructor(private plugin: BookSearchPlugin) {
    super(plugin.app);
  }

  onOpen() {
    const { contentEl } = this;

    // Add custom class for styling
    this.modalEl.addClass("book-search-service-selection-modal");

    contentEl.createEl("h2", { text: "Select Service" });

    const services = [
      { label: "Goodreads", value: "goodreads" },
      { label: "Calibre", value: "calibre" },
      { label: "OpenLibrary", value: "openlibrary" },
      { label: "Google Books", value: "google" },
    ];

    const buttonContainer = contentEl.createDiv({
      cls: "service-selection-buttons",
    });

    services.forEach((service) => {
      const btn = buttonContainer.createEl("button", {
        text: service.label,
        cls: "mod-cta",
      });

      btn.addEventListener("click", () => {
        this.close();
        this.plugin
          .createNewBookNote(service.value)
          .catch((err) => console.warn(err));
      });
    });
  }

  onClose() {
    const { contentEl } = this;
    contentEl.empty();
  }
}
