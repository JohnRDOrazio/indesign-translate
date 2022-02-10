import { XMLParser } from "fast-xml-parser";
import DomParser from "dom-parser";
import { Html5Entities } from "html-entities";
import fs from "fs";
import path from "path";

export type PSRType = "text" | "hyperlink";

export interface PSRSummary {
    content: string;
    type: PSRType;
    self?: string;
    name?: string;
}

export interface TranslationEntry {
    sourceText: string;
    text: string;
    storyId: string;
    note?: string;
    type?: "text" | "html";
}

export function removeForbiddenCharacters(str: string) {
    return str
        .replace(/\u2028/g, "") // Remove Line Separator character
        .replace(/\u2029/g, "") // Remove Paragraph Separator character
}

export function removeSomeForbiddenCharacters(str: string) {
    return str
        .replace(/\u2029/g, "") // Remove Paragraph Separator character
}

export function storyXMLNullCheck(storyXmlParsed: { [x: string]: { Story: { ParagraphStyleRange: string | any[]; }[]; }[]; }): boolean {
    if (storyXmlParsed && storyXmlParsed["idPkg:Story"][0] && storyXmlParsed["idPkg:Story"][0]
        && storyXmlParsed["idPkg:Story"][0].Story[0] && storyXmlParsed["idPkg:Story"][0].Story[0].ParagraphStyleRange
        && storyXmlParsed["idPkg:Story"][0].Story[0].ParagraphStyleRange.length > 0) {
        return true;
    }
    return false;
}


export function extractStoryMap(storyFileContents: string): {[key: string]: string} {
    const alwaysArray = [
        'idPkg:Story',
        'idPkg:Story.Story',
        'idPkg:Story.Story.ParagraphStyleRange',
        'idPkg:Story.Story.ParagraphStyleRange.CharacterStyleRange',
        'idPkg:Story.Story.ParagraphStyleRange.CharacterStyleRange.HyperlinkTextSource'
    ];
    const parser = new XMLParser({
        isArray: (name, jpath, isLeafNode, isAttribute) => { 
            return (alwaysArray.indexOf(jpath) !== -1);
        }
    });
    const storyXmlParsed = parser.parse(storyFileContents);
    //if( storyXmlParsed["idPkg:Story"][0].Story[0] )
    let storyTranslateMap: {[key: string]: string} = {};
    let lastPsr: { CharacterStyleRange: { HyperlinkTextSource: { Content: string; }[]; Content: string | string[]; }[]; }|null = null;
    if (storyXMLNullCheck(storyXmlParsed)) {
        try {
            storyXmlParsed["idPkg:Story"][0].Story[0].ParagraphStyleRange.forEach((psr: { CharacterStyleRange: { HyperlinkTextSource: { Content: string; }[]; Content: string | string[]; }[]; }) => {
                lastPsr = psr;
                if (psr.CharacterStyleRange && psr.CharacterStyleRange.length > 0) {
                    psr.CharacterStyleRange.forEach((csr: { HyperlinkTextSource: { Content: string; }[]; Content: string | string[]; }) => {
                        if (csr.HyperlinkTextSource && csr.HyperlinkTextSource[0] && csr.HyperlinkTextSource[0].Content
                            && typeof csr.HyperlinkTextSource[0].Content === "string") {
                            let str: string = removeForbiddenCharacters(csr.HyperlinkTextSource[0].Content + "");
                            let cont: string = removeSomeForbiddenCharacters(csr.HyperlinkTextSource[0].Content + "")
                            storyTranslateMap[str] = cont;
                        }
                        if (csr.Content) {
                            if (typeof csr.Content === "string" || typeof csr.Content === "number") {
                                let str = removeForbiddenCharacters(csr.Content + "");
                                let cont = removeSomeForbiddenCharacters(csr.Content + "");
                                storyTranslateMap[str] = cont;
                            } else if (Array.isArray(csr.Content)) {
                                csr.Content.forEach((str: string) => {
                                    let strClean = removeForbiddenCharacters(str);
                                    let cont = removeSomeForbiddenCharacters(str);
                                    storyTranslateMap[strClean] = cont;
                                });
                            }
                        }
                    });
                }
            });
        } catch (ex) {
            console.warn("Error parsing story at paragraph style range");
            console.warn(JSON.stringify(lastPsr, null, 4));
            console.debug(ex);
        }
        
    }
    return storyTranslateMap;
}

export function textToPSRSummary(text: string | number): PSRSummary {
    //let str = removeForbiddenCharacters(text + "");
    let str = removeSomeForbiddenCharacters(text + "");
    return {
        content: str,
        type: "text"
    };
}

export function extractStoryPSRList(storyFileContents: string): PSRSummary[] {
    const alwaysArray = [
        'idPkg:Story',
        'idPkg:Story.Story',
        'idPkg:Story.Story.ParagraphStyleRange',
        'idPkg:Story.Story.ParagraphStyleRange.CharacterStyleRange',
        'idPkg:Story.Story.ParagraphStyleRange.CharacterStyleRange.HyperlinkTextSource'
    ];
    const parser = new XMLParser({
        ignoreAttributes: false,
        isArray: (name, jpath, isLeafNode, isAttribute) => { 
            return (alwaysArray.indexOf(jpath) !== -1);
        }
    });
    const storyXmlParsed = parser.parse(storyFileContents);

    let psrSummaryList: PSRSummary[] = [];
    let lastPsr: any;
    if (storyXMLNullCheck(storyXmlParsed)) {
        try {
            storyXmlParsed["idPkg:Story"][0].Story[0].ParagraphStyleRange.forEach((psr: { CharacterStyleRange: any[]; }) => {
                lastPsr = psr;
                if (psr.CharacterStyleRange && psr.CharacterStyleRange.length > 0) {
                    psr.CharacterStyleRange.forEach((csr) => {
                        if (csr.HyperlinkTextSource && csr.HyperlinkTextSource[0] && csr.HyperlinkTextSource[0].Content
                            && typeof csr.HyperlinkTextSource[0].Content === "string") {
                            let str = removeSomeForbiddenCharacters(csr.HyperlinkTextSource[0].Content + "");
                            let psrSummary: PSRSummary = {
                                content: str,
                                type: "hyperlink",
                                name: csr.HyperlinkTextSource[0]["@_Name"],
                                self: csr.HyperlinkTextSource[0]["@_Self"],
                            };
                            psrSummaryList.push(psrSummary);
                        }
                        if (csr.Content) {
                            if (typeof csr.Content === "string" || typeof csr.Content === "number") {
                                psrSummaryList.push(textToPSRSummary(csr.Content));
                            } else if (Array.isArray(csr.Content)) {
                                for (let str of csr.Content) {
                                    psrSummaryList.push(textToPSRSummary(str));
                                }
                            }
                        }
                    });
                }
            });
        } catch (ex) {
            console.warn("Error parsing story at paragraph style range");
            console.warn(JSON.stringify(lastPsr, null, 4));
            console.debug(ex);
        }
    }
    return psrSummaryList;
}

export function psrListToHTML(psrList: PSRSummary[]): string {
    return psrList.map((psrSummary, index) => {
        let id = psrSummary.self;
        if (!id) {
            id = "item-" + index;
        }
        let title = psrSummary.name;
        if (!title) {
            title = "";
        }
        let text = Html5Entities.encode(psrSummary.content);
        if (psrSummary.type === "hyperlink") {
            return `<a id="${id}" title="${title}">${text}</a>`;
        } else {
            return `<span id="${id}">${text}</span>`;
        }
    }).join("");
}

export function htmlEntryToTextEntries(translateEntry: TranslationEntry): TranslationEntry[] {
    let textEntries: TranslationEntry[]         = [];
    let domParser: DomParser                    = new DomParser();
    let sourceParsed: DomParser.Dom             = domParser.parseFromString("<html><body>" + translateEntry.sourceText + "</body></html>");
    let translationParsed: DomParser.Dom        = domParser.parseFromString("<html><body>" + translateEntry.text + "</body></html>");
    let sourceLinkElements: DomParser.Node[] | null = sourceParsed.getElementsByTagName("a");
    if( sourceLinkElements !== null && sourceLinkElements.length > 0 ) {
        for (let i: number = 0; i < sourceLinkElements.length; i++) {
            let id: string|null     = sourceLinkElements[i].getAttribute("id");
            if( id !== null ) {
                let sourceText: string  = Html5Entities.decode(sourceLinkElements[i].textContent);
                let elId: DomParser.Node|null = translationParsed.getElementById(id);
                if( elId !== null ){
                    let text: string        = Html5Entities.decode(elId.textContent);
                    let note: string        = "";
                    if (sourceLinkElements[i].getAttribute("title") !== null) {
                        note = "" + sourceLinkElements[i].getAttribute("title");
                    }
                    textEntries.push({
                        sourceText: sourceText,
                        storyId: translateEntry.storyId,
                        text: text,
                        note: note,
                        type: "text"
                    });
                }
            }
        }
    }
    let sourceSpanElements: DomParser.Node[]|null = sourceParsed.getElementsByTagName("span");
    if( sourceSpanElements !== null && sourceSpanElements.length > 0 ) {
        for (let i: number = 0; i < sourceSpanElements.length; i++) {
            let id: string|null = sourceSpanElements[i].getAttribute("id");
            if( id !== null ) {
                let sourceText: string  = Html5Entities.decode(sourceSpanElements[i].textContent);
                let elId: DomParser.Node|null = translationParsed.getElementById(id);
                if( elId !== null ) {
                    let text: string        = Html5Entities.decode(elId.textContent);
                    textEntries.push({
                        sourceText: sourceText,
                        storyId: translateEntry.storyId,
                        text: text,
                        note: "",
                        type: "text"
                    });
                }
            }
        }
    }
    return textEntries;
}

export function getSpreadIdsInOrder(tempPath: string) {
    const designMapFileContents = fs.readFileSync(path.join(tempPath, "designmap.xml")).toString();
    const parser = new XMLParser({ ignoreAttributes: false });
    const designMapParsed = parser.parse(designMapFileContents);

    let designMapSpreads: any[] = designMapParsed.Document["idPkg:Spread"];
    if (!Array.isArray(designMapSpreads)) {
        designMapSpreads = [designMapParsed.Document["idPkg:Spread"]];
    }
    const spreadIdsInOrder = designMapSpreads.map((spread) => {
        const spreadFilePath: string = spread["@_src"];
        return spreadFilePath.replace("Spreads/Spread_", "").replace(".xml", "");
    });
    return spreadIdsInOrder;
}

export function pageFileNameForSpreadId(spreadIdsInOrder: string[], spreadId: string) : string {
    return `page-${spreadIdsInOrder.indexOf(spreadId) + 1}`;
}

export function getStoriesForSpread(spreadFileContents: string): string[] {
    let tagStartString: string = `<TextFrame Self="`;

    let storyIdMap: string[] = [];
    spreadFileContents.split("\n").forEach((line) => {
        let index: number = line.indexOf(tagStartString);
        if (index > -1 && line.indexOf(`ParentStory="`)) {
            let afterParentStoryIndex: number = line.indexOf(`ParentStory="`) + `ParentStory="`.length;
            let storyId: string = "";
            for (var i: number = afterParentStoryIndex; i < line.length && line[i] !== `"`; i++) {
                storyId += line[i];
            }
            storyIdMap.push(storyId);
        }
    });
    return storyIdMap;
}

export function getIDMLFilePathForName(inputFolder: string, idmlName: string): string|null {
    let inputFilePath: string = path.join(inputFolder, idmlName, idmlName + ".idml");
    if (!fs.existsSync(inputFilePath)) {
        try {
            let actualIDMLFilename: string = fs.readdirSync(path.join(inputFolder, idmlName)).filter((filename) => filename.endsWith(".idml"))[0];
            inputFilePath = path.join(inputFolder, idmlName, actualIDMLFilename);
        } catch (ex) {
            console.warn("Cannot find any IDML file for folder ", path.join(inputFolder, idmlName));
            return null;
        }
    }
    return inputFilePath;
}