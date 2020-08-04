import * as fs from "fs";
import * as path from "path";
import { parse, j2xParser as JS2XMLParser } from "fast-xml-parser";
import * as AdmZip from "adm-zip";
import * as rimraf from "rimraf";
import { extractStoryMap, getStoriesForSpread, removeForbiddenCharacters } from "./shared_functions";

let inputFilePath = "./input/en.idml";
let translateJSONPath = "./translate_json";
let tempPath = "./temp";

rimraf(tempPath, (err) => {
    if (err) {
        console.error("Error removing temp directory");
    }
    console.log("Removed old temp directory");
    fs.mkdirSync(tempPath);
    generateEnglishJSON();
});

function generateEnglishJSON() {

    console.log("Extracting English IDML");
    const inputZip = new AdmZip(inputFilePath);
    const tempEnPath = path.join(tempPath, "en");
    if (!fs.existsSync(tempEnPath)) {
        fs.mkdirSync(tempEnPath);
    }
    inputZip.extractAllTo(tempEnPath);

    if (!fs.existsSync(translateJSONPath)) {
        fs.mkdirSync(translateJSONPath);
    }

    if (!fs.existsSync(path.join(translateJSONPath, "en"))) {
        fs.mkdirSync(path.join(translateJSONPath, "en"));
    }

    const designMapFileContents = fs.readFileSync(path.join(tempEnPath, "designmap.xml")).toString();
    const designMapParsed = parse(designMapFileContents, { ignoreAttributes: false });
    const designMapSpreads: any[] = designMapParsed.Document["idPkg:Spread"];
    const spreadIdsInOrder = designMapSpreads.map((spread) => { 
        const spreadFilePath: string = spread["@_src"];
        return spreadFilePath.replace("Spreads/Spread_", "").replace(".xml", "");
    });

    const spreadsPath = path.join(tempEnPath, "Spreads");
    const storiesPath = path.join(tempEnPath, "Stories");
    // const storyIdsBySpreadFile: { [ spreadFile: string]: string[] } = {};
    fs.readdirSync(spreadsPath).forEach((spreadFile) => {
        const spreadId = spreadFile.replace("Spread_", "").replace(".xml", "");
        const spreadFilePath = path.join(spreadsPath, spreadFile)
        const spreadFileContents = fs.readFileSync(spreadFilePath).toString();
        const storyIds = getStoriesForSpread(spreadFileContents);
        let spreadTranslateMap = {};
        storyIds.forEach((storyId) => {
            let storyFile = `Story_${storyId}.xml`;
            const storyFileContents = fs.readFileSync(path.join(storiesPath, storyFile)).toString();
            let storyTranslateMap = extractStoryMap(storyFileContents);
            Object.keys(storyTranslateMap).forEach((key, idx) => {
                // console.log(spreadFile + "\t" + idx + "\t" + key);
                spreadTranslateMap[key] = key;
            });
        });
        const translateStructure = [];
        Object.keys(spreadTranslateMap).forEach((key, idx) => {
            translateStructure.push({
                text: removeForbiddenCharacters(key),
                note: ""
            });
        });
        const pageNumber = spreadIdsInOrder.indexOf(spreadId) + 1;
        fs.writeFileSync(path.join(translateJSONPath, "en", `page-${pageNumber}.json`), JSON.stringify(translateStructure, null, 4));
    });

    fs.readdirSync(storiesPath).forEach((storyFile) => {
        const storyFileContents = fs.readFileSync(path.join(storiesPath, storyFile)).toString();


    });
    
    
}