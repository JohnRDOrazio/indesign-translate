# InDesign Translate Utility

This script allows to export strings (stories) from InDesign files (currently only `IDML` format is supported) to `JSON`
in an [i18next](https://www.i18next.com/) compatible format, so as to allow for translation of such strings / stories to other languages.

Once translated, the `JSON` file with the translated strings can be re-imported to a new `IDML` file that is copied from the original source file,
and you will have a translated copy of the source file.

## Requirements for running the scripts

1. Download and install NodeJS. [Click here to download NodeJS](https://nodejs.org/en/download/).
2. Use git to checkout this repo
3. Run `npm install` from the command line once inside the repo folder

## What is the workflow for translating the Indesign files?

1. The graphic designer creates the original Indesign file, keeping in mind to avoid adding full line breaks in the middle of sentences (soft breaks with <kbd>Shift</kbd> +  <kbd>Enter</kbd> are acceptable, this will insert a 'Line separator' character, but should be used sparingly, only when an actual newline is required).
2. A folder for the project should be created inside the `input` folder (go ahead and create the `input` folder if it doesn't exist yet). If for example the project is called **'Catalogo2022'**, place the Indesign source `IDML` file in `indesign-translate/input/Catalogo2022/Catalogo2022.idml`. The `IDML` file can have any name, for example it could have the name of the source language (`it.idml`, or `en.idml` etc.).
3. A script is run to extract the Source text from the `idml` file for translation: `npm run extract`. This script will create a `translation.json` file in the `translate_json` folder (will be automatically created if it doesn't exist), under a subfolder with the same name as the project. For example, `indesign-translate/translate_json/Catalogo2022/it/translation.json`.
4. A Github repository should be created for the extracted source (in the example, a repository should be initialized in `indesign-translate/translate_json/Catalogo2022`), and a Weblate project for that repository should be created.
5. Translation can be done directly in the Weblate interface for the project, and Weblate will take care of sending translations back to the Github repository.
6. Once translations are complete, and all translations have been commmitted back to the Github repository, and all Pull Requests have been resolved, the local repository should by synchronized with the remote Github repository using `git pull`.
7. A script is then used to generate an InDesign file (in `IDML` format) for each language for which we have translations: `npm run translate`. This will generate an `IDML` file for each language in the `output` folder (will be created if it doesn't exist), under a subfolder with the same name as the project. For example, `indesign-translate/output/Catalogo2022/fr.idml`.
8. These InDesign files must be opened in InDesign to check for any manual adjustments needed. Font sizes may need to be adjusted, text boxes may need to be resized, boxes may require rearranging (for example, in English adjectives precede nouns, whereas in other languages adjectives may sometimes follow a noun; if the adjective and the noun are in separate text boxes, the order of the text boxes may need some rearrangement).
9. Once the translated file has been reviewed in InDesign it is ready to be exported as a PDF.

## What should the graphic designer keep in mind when creating the original InDesign file, so as to support translation?
- English is a relatively compact language. For short peices of text assume that other languages could be up to 300% more characters, and for longer sections up to 170% more characters.
- Expand text boxes as much as possible to support more characters than is in the English version.
- For each story expand the story editor to take up the full width of the screen, and turn on the end of line symbol in the story editor. We want to make sure that each sentence that should be translated as one sentence does not have an unnecessary line break.
- Avoid adjusting the format of specific pieces of text within a story as this causes that piece of text to have to be translated seperately from the rest of the sentence, in order to maintain the formatting.
- For the same reason DO NOT USE KERNING. Kerning results in each indivual letter needing translation.

## How to handle updates to the original InDesign file

1. If any changes are made to the original InDesign file after the translation process has started, it should be saved in IDML format in the project subfolder, under the `input` folder (for example `indesign-translate/input/Catalogo2022/Catalogo2022.idml`).
2. Run the extraction script again, to update the source `translation.json` file: `npm run extract`.
3. In the project folder under `translate_json`, make sure all updates from Github have been imported (run a `git pull`), then commit the changes to the source `translation.json` and push to the remote Github repo, for example:
   ```bash
   cd translate_json/Catalogo2022
   git pull
   git add it/translation.json
   git commit -m "updated the source texts"
   git push
   ```
4. If a weblate webhook has been set up on the Github repository, Weblate will immediately see the changes and adjust all the translation files to reflect the changes in the source file. This may then require reviewing all the language translations, accepting suggestions from previously translated strings that may have new keys to identify them.
