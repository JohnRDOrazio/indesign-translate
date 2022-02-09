import fs from "fs"
import path from "path"
import AdmZip from "adm-zip"
import rimraf from "rimraf"
import { getStoriesForSpread, removeForbiddenCharacters, removeSomeForbiddenCharacters, getSpreadIdsInOrder, pageFileNameForSpreadId, getIDMLFilePathForName, extractStoryPSRList, psrListToHTML, PSRSummary } from "./shared_functions"

let inputFolder: string = "./input";
let translateJSONFolder: string = "./translate_json";
let tempFolder: string = "./temp";

rimraf(tempFolder, (err) => {
    if (err) {
        console.error("Error removing temp directory");
    }
    console.log("Removed old temp directory...");
    fs.mkdirSync(tempFolder);
    if (!fs.existsSync(inputFolder)) {
        fs.mkdirSync(inputFolder);
        console.log("Created non existent input folder...");
    }
    fs.readdirSync(inputFolder).forEach((idmlName) => {
        let inputSubPath = path.join(inputFolder, idmlName);
        if (fs.statSync(inputSubPath).isDirectory()) {
            extractSourceJSON(idmlName);
            console.log("Done.");
        }
    });
});

function extractSourceJSON(idmlName: string) {

    const tempPath = path.join(tempFolder, idmlName);
    fs.mkdirSync(tempPath);
    let sourceLang: string = 'en';

    let inputFilePath = getIDMLFilePathForName(inputFolder, idmlName);
    if (inputFilePath === null) {
        console.warn("Could not find IDML file for ", idmlName);
        return;
    } else {
        sourceLang = inputFilePath.split(/.*[\/|\\]/)[1].split('.')[0];
        console.log("Detected source lang: ",sourceLang);
    }

    console.log("Extracting text from " + inputFilePath + "...");
    const inputZip = new AdmZip(inputFilePath);
    const tempPathFull = path.join(tempPath, idmlName);
    if (!fs.existsSync(tempPathFull)) {
        fs.mkdirSync(tempPathFull);
        console.log("Created non existent temp path " + tempPathFull + "...");
    }
    inputZip.extractAllTo(tempPathFull);

    const translateJSONPath = path.join(translateJSONFolder, idmlName);

    if (!fs.existsSync(translateJSONPath)) {
        fs.mkdirSync(translateJSONPath);
        console.log("Created non existent path " + translateJSONPath + "...");
    }

    if (!fs.existsSync(path.join(translateJSONPath, sourceLang))) {
        fs.mkdirSync(path.join(translateJSONPath, sourceLang));
        console.log("Created non existent path " + path.join(translateJSONPath, sourceLang) + "...");
    }

    const spreadIdsInOrder = getSpreadIdsInOrder(tempPathFull);

    const spreadsPath = path.join(tempPathFull, "Spreads");
    const storiesPath = path.join(tempPathFull, "Stories");
    let translationObj: {[key: string]: {[key: string]: {[key: string]: string} } } = {};
    let currentStoryId: string = '';
    fs.readdirSync(spreadsPath).forEach((spreadFile) => {
        console.log('Reading spread file ' + spreadFile + '...');
        const spreadId: string              = spreadFile.replace("Spread_", "").replace(".xml", "");
        const spreadFilePath: string        = path.join(spreadsPath, spreadFile)
        const spreadFileContents: string    = fs.readFileSync(spreadFilePath).toString();
        const storyIds: string[]            = getStoriesForSpread(spreadFileContents);
        const pageFileName: string          = pageFileNameForSpreadId(spreadIdsInOrder, spreadId);
        const pageFileNameShort: string     = pageFileName.split('.')[0];
        translationObj[pageFileNameShort]   = {};
        storyIds.forEach((storyId) => {
            const storyFile: string         = `Story_${storyId}.xml`;
            const storyFileContents: string = fs.readFileSync(path.join(storiesPath, storyFile)).toString();
            const psrList: PSRSummary[]     = extractStoryPSRList(storyFileContents);
            const hasLinks: boolean         = psrList.filter((psr) => psr.type === "hyperlink").length > 0;
            if (hasLinks) {
                let html: string = psrListToHTML(psrList);
                if( storyId !== currentStoryId ) {
                    currentStoryId = storyId;
                    translationObj[pageFileNameShort][currentStoryId] = {};
                    translationObj[pageFileNameShort][currentStoryId][removeForbiddenCharacters(html)] = removeSomeForbiddenCharacters(html);
                } else {
                    translationObj[pageFileNameShort][currentStoryId][removeForbiddenCharacters(html)] = removeSomeForbiddenCharacters(html);
                }
            } else {
                psrList.forEach((psr) => {
                    if( storyId !== currentStoryId ) {
                        currentStoryId = storyId;
                        translationObj[pageFileNameShort][currentStoryId] = {};
                        translationObj[pageFileNameShort][currentStoryId][removeForbiddenCharacters(psr.content)] = removeSomeForbiddenCharacters(psr.content);
                    } else {
                        translationObj[pageFileNameShort][currentStoryId][removeForbiddenCharacters(psr.content)] = removeSomeForbiddenCharacters(psr.content);
                    }
                });
            }
        });
    });
    fs.writeFileSync(path.join(translateJSONPath, sourceLang, "translation.json"), JSON.stringify(translationObj, null, 4)); 
    console.log("Wrote file " + path.join(translateJSONPath, sourceLang, "translation.json"));
}
