import { replaceDateInString } from "@utils/utils";
import { App, Notice, PluginSettingTab, Setting } from "obsidian";

import { ServiceProvider } from "@src/constants";
import languages from "@utils/languages";
import { SettingServiceProviderModal } from "@views/setting_service_provider_modal";
import BookSearchPlugin from "../main";
import { FileNameFormatSuggest } from "./suggesters/FileNameFormatSuggester";
import { FileSuggest } from "./suggesters/FileSuggester";
import { FolderSuggest } from "./suggesters/FolderSuggester";

const docUrl = "https://github.com/anpigon/obsidian-book-search-plugin";

export enum DefaultFrontmatterKeyType {
  snakeCase = "Snake Case",
  camelCase = "Camel Case",
}

export interface BookSearchPluginSettings {
  folder: string; // new file location
  fileNameFormat: string; // new file name format
  frontmatter: string; // frontmatter that is inserted into the file
  content: string; // what is automatically written to the file.
  useDefaultFrontmatter: boolean;
  defaultFrontmatterKeyType: DefaultFrontmatterKeyType;
  templateFile: string;
  serviceProvider: ServiceProvider;
  localePreference: string;
  apiKey: string;
  openPageOnCompletion: boolean;
  showCoverImageInSearch: boolean;
  enableCoverImageSave: boolean;
  enableCoverImageEdgeCurl: boolean;
  coverImagePath: string;
  askForLocale: boolean;
  calibreServerUrl: string;
  calibreLibraryId: string;
}

export const DEFAULT_SETTINGS: BookSearchPluginSettings = {
  folder: "",
  fileNameFormat: "",
  frontmatter: "",
  content: "",
  useDefaultFrontmatter: true,
  defaultFrontmatterKeyType: DefaultFrontmatterKeyType.camelCase,
  templateFile: "",
  serviceProvider: ServiceProvider.google,
  localePreference: "default",
  apiKey: "",
  openPageOnCompletion: true,
  showCoverImageInSearch: false,
  enableCoverImageSave: false,
  enableCoverImageEdgeCurl: true,
  coverImagePath: "",
  askForLocale: true,
  calibreServerUrl: "http://localhost:8080",
  calibreLibraryId: "calibre",
};

export class BookSearchSettingTab extends PluginSettingTab {
  constructor(
    app: App,
    private plugin: BookSearchPlugin,
  ) {
    super(app, plugin);
  }

  private createGeneralSettings(containerEl) {
    this.createHeader("General settings", containerEl);
    this.createFileLocationSetting(containerEl);
    this.createFileNameFormatSetting(containerEl);
  }

  private createHeader(title: string, containerEl: HTMLElement) {
    return new Setting(containerEl).setHeading().setName(title);
  }

  private createFileLocationSetting(containerEl) {
    new Setting(containerEl)
      .setName("New file location")
      .setDesc("New book notes will be placed here.")
      .addSearch((cb) => {
        try {
          new FolderSuggest(this.app, cb.inputEl);
        } catch (e) {
          console.error(e); // Improved error handling
        }
        cb.setPlaceholder("Example: folder1/folder2")
          .setValue(this.plugin.settings.folder)
          .onChange((new_folder) => {
            this.plugin.settings.folder = new_folder;
            void this.plugin.saveSettings().catch((err) => console.warn(err));
          });
      });
  }

  private createFileNameFormatSetting(containerEl) {
    const newFileNameHint = document.createDocumentFragment().createEl("code", {
      text:
        replaceDateInString(this.plugin.settings.fileNameFormat) ||
        "{{title}} - {{author}}",
    });
    new Setting(containerEl)
      .setClass("book-search-plugin__settings--new_file_name")
      .setName("New file name")
      .setDesc("The file name format.")
      .addSearch((cb) => {
        try {
          new FileNameFormatSuggest(this.app, cb.inputEl);
        } catch (e) {
          console.error(e); // Improved error handling
        }
        cb.setPlaceholder("Example: {{title}} - {{author}}")
          .setValue(this.plugin.settings.fileNameFormat)
          .onChange((newValue) => {
            this.plugin.settings.fileNameFormat = newValue?.trim();
            void this.plugin.saveSettings().catch((err) => console.warn(err));

            newFileNameHint.textContent =
              replaceDateInString(newValue) || "{{title}} - {{author}}";
          });
      });
    containerEl
      .createEl("div", {
        cls: [
          "setting-item-description",
          "book-search-plugin__settings--new_file_name_hint",
        ],
      })
      .append(newFileNameHint);
  }

  private createTemplateFileSetting(containerEl: HTMLElement) {
    const templateFileDesc = document.createDocumentFragment();
    templateFileDesc.createDiv({
      text: "Files will be available as templates.",
    });
    templateFileDesc.createEl("a", {
      text: "Example template",
      href: `${docUrl}#example-template`,
    });
    new Setting(containerEl)
      .setName("Template file")
      .setDesc(templateFileDesc)
      .addSearch((cb) => {
        try {
          new FileSuggest(this.app, cb.inputEl);
        } catch {
          // ignore
        }
        cb.setPlaceholder("Example: templates/template-file")
          .setValue(this.plugin.settings.templateFile)
          .onChange((newTemplateFile) => {
            this.plugin.settings.templateFile = newTemplateFile;
            void this.plugin.saveSettings().catch((err) => console.warn(err));
          });
      });
  }

  display(): void {
    const { containerEl } = this;
    containerEl.empty();
    containerEl.classList.add("book-search-plugin__settings");

    this.createGeneralSettings(containerEl);
    this.createTemplateFileSetting(containerEl);

    // Service Provider
    let serviceProviderExtraSettingButton: HTMLElement | null = null;
    let preferredLocaleDropdownSetting: Setting | null = null;
    let coverImageEdgeCurlToggleSetting: Setting | null = null;
    let calibreServerUrlSetting: Setting | null = null;
    let calibreLibraryIdSetting: Setting | null = null;
    let calibreSettingsHeader: Setting | null = null;

    const hideServiceProviderExtraSettingButton = () => {
      if (serviceProviderExtraSettingButton !== null)
        serviceProviderExtraSettingButton.addClass("book-search-plugin__hide");
    };
    const showServiceProviderExtraSettingButton = () => {
      if (serviceProviderExtraSettingButton !== null)
        serviceProviderExtraSettingButton.removeClass(
          "book-search-plugin__hide",
        );
    };
    const hideServiceProviderExtraSettingDropdown = () => {
      if (preferredLocaleDropdownSetting !== null)
        preferredLocaleDropdownSetting.settingEl.addClass(
          "book-search-plugin__hide",
        );
    };
    const showServiceProviderExtraSettingDropdown = () => {
      if (preferredLocaleDropdownSetting !== null)
        preferredLocaleDropdownSetting.settingEl.removeClass(
          "book-search-plugin__hide",
        );
    };
    const hideCoverImageEdgeCurlToggle = () => {
      if (coverImageEdgeCurlToggleSetting !== null)
        coverImageEdgeCurlToggleSetting.settingEl.addClass(
          "book-search-plugin__hide",
        );
    };
    const showCoverImageEdgeCurlToggle = () => {
      if (coverImageEdgeCurlToggleSetting !== null)
        coverImageEdgeCurlToggleSetting.settingEl.removeClass(
          "book-search-plugin__hide",
        );
    };
    const showCalibreSettings = () => {
      if (calibreServerUrlSetting !== null)
        calibreServerUrlSetting.settingEl.removeClass(
          "book-search-plugin__hide",
        );
      if (calibreLibraryIdSetting !== null)
        calibreLibraryIdSetting.settingEl.removeClass(
          "book-search-plugin__hide",
        );
      if (calibreSettingsHeader !== null)
        calibreSettingsHeader.settingEl.removeClass("book-search-plugin__hide");
    };
    const hideCalibreSettings = () => {
      if (calibreServerUrlSetting !== null)
        calibreServerUrlSetting.settingEl.addClass("book-search-plugin__hide");
      if (calibreLibraryIdSetting !== null)
        calibreLibraryIdSetting.settingEl.addClass("book-search-plugin__hide");
      if (calibreSettingsHeader !== null)
        calibreSettingsHeader.settingEl.addClass("book-search-plugin__hide");
    };

    const toggleServiceProviderExtraSettings = (
      serviceProvider: ServiceProvider = this.plugin.settings?.serviceProvider,
    ) => {
      if (serviceProvider === ServiceProvider.goodreads) {
        hideServiceProviderExtraSettingButton();
        showServiceProviderExtraSettingDropdown();
        showCoverImageEdgeCurlToggle();
        hideCalibreSettings();
      } else if (serviceProvider === ServiceProvider.calibre) {
        showServiceProviderExtraSettingButton();
        hideServiceProviderExtraSettingDropdown();
        hideCoverImageEdgeCurlToggle();
        showCalibreSettings();
      } else {
        hideServiceProviderExtraSettingButton();
        showServiceProviderExtraSettingDropdown();
        showCoverImageEdgeCurlToggle();
        hideCalibreSettings();
      }
    };

    new Setting(containerEl)
      .setName("Service provider")
      .setDesc(
        "Choose the service provider you want to use to search your books.",
      )
      .setClass("book-search-plugin__settings--service_provider")
      .addDropdown((dropDown) => {
        dropDown.addOption(
          ServiceProvider.google,
          `${ServiceProvider.google} (Global)`,
        );
        dropDown.addOption(
          ServiceProvider.goodreads,
          `${ServiceProvider.goodreads} (Scraping)`,
        );
        dropDown.addOption(
          ServiceProvider.calibre,
          `${ServiceProvider.calibre} (Local Server)`,
        );
        dropDown.setValue(
          this.plugin.settings?.serviceProvider ?? ServiceProvider.google,
        );
        dropDown.onChange((value) => {
          const newValue = value as ServiceProvider;
          toggleServiceProviderExtraSettings(newValue);
          this.plugin.settings["serviceProvider"] = newValue;
          void this.plugin.saveSettings().catch((err) => console.warn(err));
        });
      })
      .addExtraButton((component) => {
        serviceProviderExtraSettingButton = component.extraSettingsEl;
        component.onClick(() => {
          new SettingServiceProviderModal(this.plugin).open();
        });
      });

    calibreSettingsHeader = this.createHeader("Calibre settings", containerEl);

    calibreServerUrlSetting = new Setting(containerEl)
      .setName("Calibre server URL")
      .setDesc("The URL of your Calibre content server.")
      .addText((text) =>
        text
          .setPlaceholder("http://localhost:8080")
          .setValue(this.plugin.settings.calibreServerUrl)
          .onChange((value) => {
            this.plugin.settings.calibreServerUrl = value;
            void this.plugin.saveSettings().catch((err) => console.warn(err));
          }),
      );

    calibreLibraryIdSetting = new Setting(containerEl)
      .setName("Calibre library ID")
      .setDesc(
        "The library ID (default: calibre). This is usually the folder name of your library.",
      )
      .addText((text) =>
        text
          .setPlaceholder("calibre")
          .setValue(this.plugin.settings.calibreLibraryId)
          .onChange((value) => {
            this.plugin.settings.calibreLibraryId = value;
            void this.plugin.saveSettings().catch((err) => console.warn(err));
          }),
      );

    preferredLocaleDropdownSetting = new Setting(containerEl)
      .setName("Preferred locale")
      .setDesc("Sets the preferred locale to use when searching for books.")
      .addDropdown((dropDown) => {
        const defaultLocale = window.moment.locale();
        dropDown.addOption(
          defaultLocale,
          `${languages[defaultLocale] || defaultLocale} (Default Locale)`,
        );
        Object.keys(languages).forEach((locale) => {
          const localeName = languages[locale];
          if (localeName && locale !== defaultLocale)
            dropDown.addOption(locale, localeName);
        });
        const localeValue = this.plugin.settings.localePreference;
        dropDown
          .setValue(
            localeValue === DEFAULT_SETTINGS.localePreference
              ? defaultLocale
              : localeValue,
          )
          .onChange((value) => {
            const newValue = value;
            this.plugin.settings.localePreference = newValue;
            void this.plugin.saveSettings().catch((err) => console.warn(err));
          });
      });

    new Setting(containerEl)
      .setName("Open new book note")
      .setDesc(
        "Enable or disable the automatic opening of the note on creation.",
      )
      .addToggle((toggle) =>
        toggle
          .setValue(this.plugin.settings.openPageOnCompletion)
          .onChange((value) => {
            this.plugin.settings.openPageOnCompletion = value;
            void this.plugin.saveSettings().catch((err) => console.warn(err));
          }),
      );

    new Setting(containerEl)
      .setName("Show cover images in search")
      .setDesc("Toggle to show or hide cover images in the search results.")
      .addToggle((toggle) =>
        toggle
          .setValue(this.plugin.settings.showCoverImageInSearch)
          .onChange((value) => {
            this.plugin.settings.showCoverImageInSearch = value;
            void this.plugin.saveSettings().catch((err) => console.warn(err));
          }),
      );

    // A toggle whether or not to ask for the locale every time a search is made
    new Setting(containerEl)
      .setName("Ask for locale")
      .setDesc(
        "Toggle to enable or disable asking for the locale every time a search is made.",
      )
      .addToggle((toggle) =>
        toggle.setValue(this.plugin.settings.askForLocale).onChange((value) => {
          this.plugin.settings.askForLocale = value;
          void this.plugin.saveSettings().catch((err) => console.warn(err));
        }),
      );

    coverImageEdgeCurlToggleSetting = new Setting(containerEl)
      .setName("Enable cover image edge curl effect")
      .setDesc("Toggle to show or hide page curl effect in cover images.")
      .addToggle((toggle) =>
        toggle
          .setValue(this.plugin.settings.enableCoverImageEdgeCurl)
          .onChange((value) => {
            this.plugin.settings.enableCoverImageEdgeCurl = value;
            void this.plugin.saveSettings().catch((err) => console.warn(err));
          }),
      );

    new Setting(containerEl)
      .setName("Enable cover image save")
      .setDesc("Toggle to enable or disable saving cover images in notes.")
      .addToggle((toggle) =>
        toggle
          .setValue(this.plugin.settings.enableCoverImageSave)
          .onChange((value) => {
            this.plugin.settings.enableCoverImageSave = value;
            void this.plugin.saveSettings().catch((err) => console.warn(err));
          }),
      );

    new Setting(containerEl)
      .setName("Cover image path")
      .setDesc("Specify the path where cover images should be saved.")
      .addSearch((cb) => {
        try {
          new FolderSuggest(this.app, cb.inputEl);
        } catch {
          // eslint-disable
        }
        cb.setPlaceholder("Enter the path (e.g., Images/Covers)")
          .setValue(this.plugin.settings.coverImagePath)
          .onChange((value) => {
            this.plugin.settings.coverImagePath = value.trim();
            void this.plugin.saveSettings().catch((err) => console.warn(err));
          });
      });

    // Google API Settings
    this.createHeader("Google API settings", containerEl);
    new Setting(containerEl)
      .setName("Google API settings description")
      .setDesc(
        "**Warning** Please use this field only if you understand the Google Cloud API and API key security.",
      );

    new Setting(containerEl)
      .setName("Status check")
      .setDesc(
        "Check whether API key is saved. It does not guarantee that the API key is valid or invalid.",
      )
      .addButton((button) => {
        button.setButtonText("API check").onClick(() => {
          if (this.plugin.settings.apiKey.length) {
            new Notice("API key exists.");
          } else {
            new Notice("API key does not exist.");
          }
        });
      });

    const googleAPISetDesc = document.createDocumentFragment();
    googleAPISetDesc.createDiv({ text: "Set your Books API key." });
    googleAPISetDesc.createDiv({
      text: "For security reason, saved API key is not shown in this textarea after saved.",
    });
    let tempKeyValue = "";
    new Setting(containerEl)
      .setName("Set API key")
      .setDesc(googleAPISetDesc)
      .addText((text) => {
        text.inputEl.type = "password";
        text.setValue("").onChange((value) => {
          tempKeyValue = value;
        });
      })
      .addButton((button) => {
        button.setButtonText("Save key").onClick(() => {
          this.plugin.settings.apiKey = tempKeyValue;
          void this.plugin
            .saveSettings()
            .then(() => new Notice("API key saved"));
        });
      });

    // Initialize visibility
    toggleServiceProviderExtraSettings();
  }
}
