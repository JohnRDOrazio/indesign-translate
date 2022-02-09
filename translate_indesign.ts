import * as fs from "fs";
import * as path from "path";
import * as AdmZip from "adm-zip";
import * as rmfr from "rmfr";
import { removeSomeForbiddenCharacters, extractStoryMap, getStoriesForSpread, getSpreadIdsInOrder, pageFileNameForSpreadId, TranslationEntry, getIDMLFilePathForName, htmlEntryToTextEntries } from "./shared_functions";
import * as ncp from "ncp";

const inputFolder         = "./input";
const outputFolder        = "./output";
const translateJSONPath   = "./translate_json";
const tempFolder          = "./temp";

async function ncpPromise(from: string, to: string): Promise<any> {
    return new Promise<void>((resolve, reject) => {
        ncp(from, to, { filter: (source) => {
            if( fs.statSync(source).isDirectory() ) {
                return true;
            } else {
                return source.match(/\.idml$/) !== null;
            }
        } }, (err) => err ? reject(err) : resolve());
    });
}

async function translateIDMLFiles() {
    console.log('starting translation process...');
    try {
        await rmfr(tempFolder);
        fs.mkdirSync(tempFolder);
        console.log("Removed temp directory");

        await rmfr(outputFolder);
        fs.mkdirSync(outputFolder);
        console.log("Removed output directory");

        let fileNames = fs.readdirSync(inputFolder);
        const idmlDirectoryNames = fileNames.filter((fileName) => fs.statSync(path.join(inputFolder, fileName)).isDirectory());
        for (let idmlName of idmlDirectoryNames) {
            await ncpPromise(path.join(inputFolder, idmlName), path.join(outputFolder, idmlName));
            console.log("Copied input to output folder for ", path.join(inputFolder, idmlName));
            translateIDML(idmlName);
        }

    } catch (ex) {
        console.error("Error removing or copying directory:", ex);
    }
}

translateIDMLFiles().then(() => {
    console.log("Done");
})

function translateIDML(idmlName: string) {
    let sourceLang: string = 'en';
    // Create temp path for extracted contents of this IDML file
    const tempPath = path.join(tempFolder, idmlName);
    if (!fs.existsSync(tempPath)) {
        fs.mkdirSync(tempPath);
        console.log("Created non existent temp path " + tempPath);
    }

    // Create output folder for this IDML file
    const outputSubPath = path.join(outputFolder, idmlName);
    if (!fs.existsSync(outputSubPath)) {
        fs.mkdirSync(outputSubPath);
        console.log("Created non existent output path " + outputSubPath);
    }

    let inputFilePath = getIDMLFilePathForName(inputFolder, idmlName);
    if (inputFilePath === null) {
        console.warn("Could not find IDML file for ", idmlName);
        return;
    } else {
        sourceLang = inputFilePath.split(/.*[\/|\\]/)[1].split('.')[0];
        console.log("Detected source lang: ", sourceLang);
    }
    let inputZip = new AdmZip(inputFilePath);

    let translateJSONSubPath = path.join(translateJSONPath, idmlName);
    let languageCodes = fs.readdirSync(translateJSONSubPath).filter((langCode) => langCode !== sourceLang );

    for (let langCode of languageCodes) {

        const tempPathTranslated = path.join(tempPath, langCode);
        if (!fs.existsSync(tempPathTranslated)) {
            fs.mkdirSync(tempPathTranslated);
            console.log("Created non existent temp path " + tempPathTranslated);
        }

        // Extract contents of input InDesign into temporary folder
        console.log("Extracting Source IDML into temp folder for", langCode, '...');
        inputZip.extractAllTo(tempPathTranslated);

        // Do actual translation
        translateStoriesXML(tempPathTranslated, langCode, idmlName);

        // Combine files back into ZIP file for output InDesign Markup file
        const outputZip = new AdmZip();
        fs.readdirSync(tempPathTranslated).forEach((file) => {
            try {
                var filePath = path.join(tempPathTranslated, file);
                if (fs.statSync(filePath).isDirectory()) {
                    outputZip.addLocalFolder(filePath, file);
                } else {
                    outputZip.addLocalFile(filePath);
                }
            } catch (ex) {
                console.warn("Error adding file to IDML", ex);
            }
        });
        
        const outputZipPath = path.join(outputSubPath, langCode + ".idml");
        console.log("Writing InDesign Markup File for", idmlName, "for language code", langCode);
        outputZip.writeZip(outputZipPath);
        // rimraf(tempPath, (err) => {});
    }
}

function translateStoriesXML(folder: string, langCode: string, idmlName: string) {
    const storiesPath = path.join(folder, "Stories");
    const spreadsPath = path.join(folder, "Spreads");
    const spreadIdsInOrder = getSpreadIdsInOrder(folder);
    const translateObjPath = path.join(translateJSONPath, idmlName, langCode, 'translation.json');
    console.log('Parsing JSON from ',translateObjPath,'...');
    const translationObj = JSON.parse(fs.readFileSync(translateObjPath).toString());
    fs.readdirSync(spreadsPath).forEach((spreadFile) => {
        const spreadId = spreadFile.replace("Spread_", "").replace(".xml", "");
        const spreadFilePath = path.join(spreadsPath, spreadFile);
        console.log("Reading spread file",spreadFilePath,'...');
        const spreadFileContents = fs.readFileSync(spreadFilePath).toString();
        const storyIds = getStoriesForSpread(spreadFileContents);
        console.log('Extracted storyIds:',storyIds.join(','),'from spreadFile',spreadFilePath);
        let perStoryTranslateMap: { [storyId: string]: { [srcLang: string]: string } } = {};
        let nonStoryTranslateMap: { [srcLang: string]: string } = {};
        storyIds.forEach((storyId) => perStoryTranslateMap[storyId] = {});
        console.log( perStoryTranslateMap );
        //let pageFileName: string;
        let spreadTranslateEntries: TranslationEntry[] = [];
        let pageId: string;
        let pageObj: object;
        //let spreadTranslateEntries = [];
        try {
            //pageFileName = pageFileNameForSpreadId(spreadIdsInOrder, spreadId);
            pageId = pageFileNameForSpreadId(spreadIdsInOrder, spreadId);
            console.log('spreadId',spreadId,'translates to pageId',pageId);
            console.log('Retrieving translation strings for page',pageId,'...');
            //const pageFilePath = path.join(translateJSONPath, idmlName, langCode, pageFileName);
            //spreadTranslateEntries = JSON.parse(fs.readFileSync(pageFilePath).toString());
            let objx: TranslationEntry;
            if( translationObj.hasOwnProperty(pageId) ) {
                console.log( 'Found pageId',pageId,'in translationObj, now retrieving pageObj...');
                pageObj = translationObj[pageId];
                spreadTranslateEntries = Object.keys(pageObj).reduce((previousValue, storyId) => {
                    Object.keys(pageObj[storyId]).forEach(srcText => {
                        objx = {
                            sourceText: srcText,
                            text: pageObj[storyId][srcText],
                            storyId: storyId,
                            note: '',
                            type: srcText.startsWith('<a id=') && srcText.endsWith('</a>') ? 'html' : 'text'
                        };
                        previousValue.push(objx);
                    });
                    return previousValue;
                },[]);
                console.log('spreadTranslateEntries has ' + spreadTranslateEntries.length + ' entries');
                //console.log(spreadTranslateEntries);
                for (let entry of spreadTranslateEntries) {
                    if (entry.type === "html") {
                        console.log('  >>  dealing with html entry...');
                        let subEntries = htmlEntryToTextEntries(entry);
                        for (let subEntry of subEntries) {
                            if (subEntry.storyId) {
                                perStoryTranslateMap[subEntry.storyId][subEntry.sourceText] = subEntry.text;
                            }
                            nonStoryTranslateMap[subEntry.sourceText] = subEntry.text;
                        }
                    } else {
                        console.log('  >>  dealing with text entry...');
                        console.log(entry);
                        if (entry.storyId) {
                            console.log('adding mapping for storyId =',entry.storyId,', sourceText =',entry.sourceText,', text = ',entry.text,'...');
                            perStoryTranslateMap[entry.storyId][entry.sourceText] = entry.text;
                        }
                        nonStoryTranslateMap[entry.sourceText] = entry.text;
                    }
                }
            } else {
                console.log('Could not find pageId',pageId,'in translationObj');
            }
            //console.log(pageObj);
        } catch (ex) {
            console.debug(ex);
            if( pageId ) {
                console.log("In InDesign file", idmlName, ("Missing pageId " + pageId + " in translation file for language"), langCode);
            } else {
                console.log("In InDesign file", idmlName, "Missing translation file for spread id", spreadId, "for language", langCode);
            }
            process.exit();
            //return;
        }
        storyIds.forEach((storyId) => {
            let storyFile = `Story_${storyId}.xml`;
            console.log('Reading story file',path.join(storiesPath, storyFile));
            const storyFileContents = fs.readFileSync(path.join(storiesPath, storyFile)).toString();
            let modifiedXML = removeSomeForbiddenCharacters(storyFileContents);
            let storyTranslateMap = extractStoryMap(storyFileContents);
            Object.keys(storyTranslateMap).forEach((key) => {
                if (perStoryTranslateMap[storyId][key]) {
                    modifiedXML = modifiedXML.replace(key, perStoryTranslateMap[storyId][key]);
                } else if (nonStoryTranslateMap[key]) {
                    console.warn("Translation used but no story id", key, nonStoryTranslateMap[key]);
                    modifiedXML.replace(key, nonStoryTranslateMap[key]);
                } else {
                    console.warn("In InDesign file", idmlName, "Missing translation for", key);
                }
            })
            console.log('Writing translated story file',path.join(storiesPath, storyFile));
            fs.writeFileSync(path.join(storiesPath, storyFile), modifiedXML, { flag: "w+" });
        });
    });
}