import { Modal, Setting, Platform } from "obsidian";
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

      btn.addEventListener("click", async () => {
        // 1. Start slide-down animation
        const closePromise = this.animateClose();

        // 2. Wait a tiny bit to let animation start smoothly (avoid jank)
        await new Promise((resolve) => setTimeout(resolve, 50));

        // 3. Trigger next modal (Search)
        // This overlaps with the tail end of the slide-down.
        // It prevents the "300ms freeze" feeling while keeping the shade active.
        try {
          // Wrap in slight timeout to ensure render frame is pushed
          await new Promise<void>((resolve, reject) => {
            setTimeout(() => {
              this.plugin
                .createNewBookNote(service.value)
                .then(resolve)
                .catch(reject);
            }, 10);
          });
        } catch (err) {
          console.warn(err);
        } finally {
          // Ensure animation is mostly done before finalizing close
          await closePromise;
          this.close();
        }
      });
    });
  }

  // Graceful close animation - Visual only
  async animateClose(): Promise<void> {
    this.modalEl.addClass("is-closing");
    // Wait for animation duration (250ms)
    await new Promise((resolve) => setTimeout(resolve, 250));
  }

  onClose() {
    const { contentEl } = this;
    contentEl.empty();
  }
}
