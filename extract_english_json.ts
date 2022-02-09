import * as fs from "fs"
import * as path from "path"
//import { parse, j2xParser as JS2XMLParser } from "fast-xml-parser"
import * as AdmZip from "adm-zip"
import * as rimraf from "rimraf"
import { getStoriesForSpread, removeForbiddenCharacters, removeSomeForbiddenCharacters, getSpreadIdsInOrder, pageFileNameForSpreadId, TranslationEntry, getIDMLFilePathForName, extractStoryPSRList, psrListToHTML } from "./shared_functions" //extractStoryMap
//import { exit } from "process"

let inputFolder = "./input";
let translateJSONFolder = "./translate_json";
let tempFolder = "./temp";

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
            extractEnglishJSON(idmlName);
        }
    });
    ;
});

function extractEnglishJSON(idmlName: string) {

    const tempPath = path.join(tempFolder, idmlName);
    fs.mkdirSync(tempPath);

    let inputFilePath = getIDMLFilePathForName(inputFolder, idmlName);
    if (inputFilePath === null) {
        console.warn("Could not find IDML file for ", idmlName);
        return;
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

    if (!fs.existsSync(path.join(translateJSONPath, "it"))) {
        fs.mkdirSync(path.join(translateJSONPath, "it"));
        console.log("Created non existent path " + path.join(translateJSONPath, "it") + "...");
    }

    const spreadIdsInOrder = getSpreadIdsInOrder(tempPathFull);

    const spreadsPath = path.join(tempPathFull, "Spreads");
    const storiesPath = path.join(tempPathFull, "Stories");
    // const storyIdsBySpreadFile: { [ spreadFile: string]: string[] } = {};
    const translationObj = {};
    let currentStoryId = '';
    fs.readdirSync(spreadsPath).forEach((spreadFile) => {
        console.log('Reading spread file ' + spreadFile + '...');
        const spreadId = spreadFile.replace("Spread_", "").replace(".xml", "");
        const spreadFilePath = path.join(spreadsPath, spreadFile)
        const spreadFileContents = fs.readFileSync(spreadFilePath).toString();
        const storyIds = getStoriesForSpread(spreadFileContents);
        //let spreadTranslateMap = {};
        const translateStructure: TranslationEntry[] = [];
        const pageFileName = pageFileNameForSpreadId(spreadIdsInOrder, spreadId);
        const pageFileNameShort = pageFileName.split('.')[0];
        translationObj[pageFileNameShort] = {};
        storyIds.forEach((storyId) => {
            let storyFile = `Story_${storyId}.xml`;
            const storyFileContents = fs.readFileSync(path.join(storiesPath, storyFile)).toString();
            const psrList = extractStoryPSRList(storyFileContents);
            const hasLinks = psrList.filter((psr) => psr.type === "hyperlink").length > 0;
            if (hasLinks) {
                let html = psrListToHTML(psrList);
                const entry: TranslationEntry = {
                    sourceText: removeForbiddenCharacters(html),
                    text: removeSomeForbiddenCharacters(html),
                    note: "",
                    type: "html",
                    storyId: storyId
                };
                translateStructure.push(entry);
                if( storyId !== currentStoryId ) {
                    currentStoryId = storyId;
                    translationObj[pageFileNameShort][currentStoryId] = {};
                    translationObj[pageFileNameShort][currentStoryId][removeForbiddenCharacters(html)] = removeSomeForbiddenCharacters(html);
                } else {
                    translationObj[pageFileNameShort][currentStoryId][removeForbiddenCharacters(html)] = removeSomeForbiddenCharacters(html);
                }
            } else {
                psrList.forEach((psr) => {
                    const entry: TranslationEntry = {
                        sourceText: removeForbiddenCharacters(psr.content),
                        text: removeSomeForbiddenCharacters(psr.content),
                        note: "",
                        type: "text",
                        storyId: storyId
                    };
                    translateStructure.push(entry);
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
        //fs.writeFileSync(path.join(translateJSONPath, "it", pageFileName), JSON.stringify(translateStructure, null, 4));
        //console.log("Wrote file " + path.join(translateJSONPath, "it", pageFileName));
    });
    fs.writeFileSync(path.join(translateJSONPath, "it", "translation.json"), JSON.stringify(translationObj, null, 4)); 
    console.log("Wrote file " + path.join(translateJSONPath, "it", "translation.json"));
}