// Created By Alyssa Fusato on May 9, 2024

// Variables copy paste - Allows user to copy variables from one file and paste them into another.
// TO USE: Open plugin in one file and hit "copy variables", switch to another file, open plugin and hit "Paste"

/* 
  ----------
  May 2024: For some reason, pasted variables aren't always in the original order. Not exactly sure why.
  In the future, it would be nice to avoid duplicating collections and variables of the same name upon paste.
  ----------
  7/3/2024: Until I figure out how to support external aliases, I want to show a list of aliases that haven't been 
  linked when the user presses "Paste". Originally wanted to show unsupported aliases in the UI but tried and 
  couldn't get it to appear, so they will be displayed in the console with a pink background. Instructions to 
  view the console have been linked in the UI.
*/

var parsedCollections: any;
var parsedVariables: any;

var variableAliases: any;
var invalidAliasList: string[] = [];

const printCurrentVariables = async () => {
  let c = JSON.parse(await figma.clientStorage.getAsync("collections"));
  let v = JSON.parse(await figma.clientStorage.getAsync("variables"));
  console.log("COLLECTIONS");
  console.log(c);
  console.log("VARIABLES:");
  console.log(v);
}

const exportVariableCsv = async () => {
  let c = JSON.parse(await figma.clientStorage.getAsync("collections"));
  let v = JSON.parse(await figma.clientStorage.getAsync("variables"));
  console.log("COLLECTIONS");
  console.log(c);
  console.log("VARIABLES:");
  console.log(v);
  let csvContentArray = [];
  for (let i = 0; i < c.length; i++) {
    for (let j = 0; j < v.length; j++) {
      if (v[j].variableCollectionId == c[i].id) {
        let modeKeys = Object.keys(c[i].modes);
        for (let k = 0; k < modeKeys.length; k++) {
          let varId = v[j].id.split("VariableID:")[1];
          let colName = c[i].name;
          let modeName = c[i]["modes"][k].name;
          let groupName = "";
          let varType = v[j].resolvedType;
          let varName = v[j].name;
          let varValue;
          if (varName.includes("\/")) { // Detect groups in variable name and update groupName
            groupName = varName.slice(0, varName.lastIndexOf("\/") + 1);
            varName = varName.slice(varName.lastIndexOf("\/") + 1);
          }
          if (isAlias(v[j].valuesByMode[c[i].modes[k].modeId])) { // Format alias values for CSV
            varValue = JSON.stringify(v[j].valuesByMode[c[i].modes[k].modeId]).replace(/{\"|\"}/g, "").replace(/\",\"/g, ", ").replace(/\":\"/g, ":");
          }
          else if (varType === "COLOR") { // Format color values for CSV
            varValue = JSON.stringify(v[j].valuesByMode[c[i].modes[k].modeId]).replace("\"r\"", "r").replace("\"g\"", " g").replace("\"b\"", " b").replace("\"a\"", " a");
          }
          else { // Format everything else as-is
            varValue = v[j].valuesByMode[c[i].modes[k].modeId];
          }
          let variableEntry = colName + "," + groupName + "," + varName + "," + varType + "," + modeName + ",\"" + varValue + "\"," + varId;
          csvContentArray.push(variableEntry);
        }
      }
    }
  }
  let finalString = csvContentArray.join("\n");
  let csvHeader = "Collection, Group, Name, Type, Mode, Value, ID\n";
  let encodedUri = csvHeader + finalString;
  console.log(encodedUri);
  figma.ui.postMessage({ type: 'csv', content: encodedUri });
}

function showInvalidAliases() { // Displaying invalid aliases (that reference non-local variables) in console with pink background
  // If there's no invalid alias, return
  if (invalidAliasList.length <= 0) { return };

  console.log("%c" + "//// INVALID ALIASES ////", "color:#C20606; font-weight:bold; background:#FFE3E1;");
  for (let i = 0; i < invalidAliasList.length; i++) {
    let collectionName = invalidAliasList[i].split(" ..... ")[0];
    let modeNumber = invalidAliasList[i].split(" ..... ")[1];
    console.log("%c " + collectionName + ", Mode #" + modeNumber + " ", "color:#C20606; font-weight:bold; background:#FFE3E1;");
    // figma.ui.postMessage({ type: 'invalid-alias', collection: JSON.stringify(collectionName), mode: JSON.stringify(modeNumber) });
  }
  console.log("%c" + "////// END OF LIST //////", "color:#C20606; font-weight:bold; background:#FFE3E1;");
}

function replacer(key: any, value: any) { // Utility for using JSON.stringify() on Maps
  // This is needed to tell the UI which modes belong to which collection
  if (value instanceof Map) {
    return {
      dataType: 'Map',
      value: Array.from(value.entries()),
    };
  } else { return value; }
}

function cloneCollections(c: VariableCollection[]) { // Workaround for stringifying the VariableCollection object
  // Since there's already a stringify method on VariableCollection that only returns its ID, 
  // Needed a way to stringify collections while retaining other properties, this is the workaround
  var clonedArray = [];
  for (let i = 0; i < c.length; i++) {
    const variableCollection = {
      id: c[i]["id"],
      defaultModeId: c[i]["defaultModeId"],
      hiddenFromPublishing: c[i]["hiddenFromPublishing"],
      key: c[i]["key"],
      modes: c[i]["modes"],
      name: c[i]["name"],
      remote: c[i]["remote"],
      variableIds: c[i]["variableIds"]
    };
    clonedArray.push(variableCollection);
  }
  return JSON.stringify(clonedArray);
}

function cloneVariables(v: Variable[]) { // Workaround for stringifying the Variable object
  // Since there's already a stringify method on Variable that only returns its ID, 
  // Needed a way to stringify variables while retaining other properties, this is the workaround
  var clonedArray = [];
  for (let i = 0; i < v.length; i++) { // Creates collections
    const Variable = {
      id: v[i]["id"],
      codeSyntax: v[i]["codeSyntax"],
      description: v[i]["description"],
      hiddenFromPublishing: v[i]["hiddenFromPublishing"],
      key: v[i]["key"],
      name: v[i]["name"],
      remote: v[i]["remote"],
      resolvedType: v[i]["resolvedType"],
      scopes: v[i]["scopes"],
      valuesByMode: v[i]["valuesByMode"],
      variableCollectionId: v[i]["variableCollectionId"]
    };
    console.log("New Var Name: " + Variable.name)
    clonedArray.push(Variable);
  }
  return JSON.stringify(clonedArray);
}

function isAlias(obj: any) { // Takes in a mode value and returns its alias ID if it's an alias, false otherwise
  if (typeof (obj) === "object" && !obj.hasOwnProperty('a')) {
    return obj["id"];
  } else return false;
}

const assignCopiedCollections = async () => { // Gets collections and variables from client storage
  parsedCollections = JSON.parse(await figma.clientStorage.getAsync("collections"));
  parsedVariables = JSON.parse(await figma.clientStorage.getAsync("variables"));
  if (parsedCollections == undefined) { return 0; }
  var collectionNames = [];
  var collectionModes = new Map();
  for (let i = 0; i < parsedCollections.length; i++) {
    let name = parsedCollections[i]["name"];
    let modes = parsedCollections[i]["modes"];
    collectionNames.push(name);
    var currentModes = [];
    for (let j = 0; j < modes.length; j++) {
      currentModes.push(modes[j].name);
    }
    collectionModes.set(name, currentModes);
  }
  figma.ui.postMessage({ type: 'collection-names', names: JSON.stringify(collectionNames), modes: JSON.stringify(collectionModes, replacer) });
}

const setCollections = async () => { // Gets local Collections and Variables
  console.log("Saving current local variable collections to storage...");

  const localVariableCollections = cloneCollections(await figma.variables.getLocalVariableCollectionsAsync());
  const localVariables = cloneVariables(await figma.variables.getLocalVariablesAsync())

  await figma.clientStorage.setAsync("collections", localVariableCollections);
  await figma.clientStorage.setAsync("variables", localVariables);

  console.log(`localVariableCollections = ${localVariableCollections}`);
  console.log(`localVariables = ${localVariables}`);

  // Want to show name of file variables were copied from. Probably need to add it to local storage...
  parsedCollections = JSON.parse(await figma.clientStorage.getAsync("collections"));
  parsedVariables = JSON.parse(await figma.clientStorage.getAsync("variables"));
  console.log("setCollections Complete");
}

const getAliasedVariables = async (av: Variable[]) => { // updates values of aliased variables
  await figma.variables.getLocalVariableCollectionsAsync().then((c) => {
    figma.variables.getLocalVariablesAsync().then((v) => { // Iterate thru remaining variables to find existing variables and update with ref'd values.
      console.log("Running getAliasedVariables \(" + av.length + "\)");
      var backlog = av; // anything still without a value is pushed here to be iterated through again later
      for (let h = 0; h < backlog.length; h++) { // each alias
        for (let i = 0; i < v.length; i++) { // each variable
          if (backlog[h].id == v[i].id) {
            let keys = Object.keys(backlog[h].valuesByMode);
            let actualKeys = Object.keys(v[i].valuesByMode);
            for (let j = 0; j < keys.length; j++) { // for each alias mode...
              let modeValue = backlog[h].valuesByMode[keys[j]];
              for (let k = 0; k < actualKeys.length; k++) { // for each variable mode
                if (isAlias(modeValue) != false && actualKeys[k] == keys[j]) {
                  v[i].setValueForMode(actualKeys[k], modeValue);
                  if (backlog[h].valuesByMode[keys[j]] == undefined) { // Error case: make sure the reference variable exists in v array
                    console.log("Variable " + backlog[h].valuesByMode[keys[j]] + " not found")
                  }
                }
              }
            } break;
          }
        }
      }
    });
  });
}

function remapAliases(arr: any, map: Map<String, Variable>) { // takes an array of variables to be remapped and a map (old id, new id)
  for (let i = 0; i < arr.length; i++) {
    if (map.get(arr[i]["id"]) == undefined) { console.log("!!!! Could not find " + arr[i]["name"] + " in aliasMap !!!!"); }
    let v = map.get(arr[i]["id"]);
    if (v != undefined && v["valuesByMode"] != undefined) {
      let keys = Object.keys(arr[i].valuesByMode);
      let actualkeys = Object.keys(v.valuesByMode);
      for (let j = 0; j < keys.length; j++) { // for each mode value...
        arr[i]["id"] = v["id"];
        let currentModeValue = arr[i]["valuesByMode"][keys[j]];
        if (isAlias(currentModeValue) != false) { // makes sure mode value is an alias
          let reference = map.get(arr[i]["valuesByMode"][keys[j]]["id"]);
          if (reference != undefined) { // if the value referenced by the alias doesn't exist yet
            arr[i]["valuesByMode"][keys[j]]["id"] = reference["id"];
            delete Object.assign(arr[i].valuesByMode, { [actualkeys[j]]: arr[i].valuesByMode[keys[j]] })[keys[j]];
          } else { // if referenced value can't be found, add to list of invalid aliases to highlight in console
            let modeNumber = j + 1;
            let collectionName = arr[i]["name"].toString();
            console.log("NO VALID REF TO ALIAS TO " + collectionName + " Mode: " + modeNumber);
            let invalidAlias = (collectionName + " ..... " + modeNumber).toString();
            invalidAliasList.push(invalidAlias);
          }
        }
      }
    }
  }
  console.log(arr);
  return arr;
}

function createVariables(sourceCollections: VariableCollection[], variables: Variable[]) {
  console.log("Running function CreateVariables...");
  var aliasedVariables = [];
  const aliasMap = new Map();

  for (let i = 0; i < sourceCollections.length; i++) { // Iterates through and creates collections
    const sourceCollection = sourceCollections[i];
    console.log("Creating Collection: " + sourceCollection["name"] + " -------------");

    // Create an empty collection with the same name as sourceCollection
    const newCollection = figma.variables.createVariableCollection(sourceCollection["name"]);

    for (let j = 0; j < sourceCollection["modes"].length; j++) { // Adds modes to created collections
      if (j == 0) { newCollection.renameMode(newCollection.modes[0].modeId, sourceCollection["modes"][j]["name"]); }
      else { newCollection.addMode(sourceCollection["modes"][j]["name"]); }
    }

    // Copy variables from sourceCollection to newCollection
    for (let h = 0; h < variables.length; h++) { // Iterates through and creates variables
      let variable = variables[h];
      
      if (sourceCollection["id"] == variable["variableCollectionId"]) {
        const createdVariable = figma.variables.createVariable(variable["name"], newCollection, variable["resolvedType"]);
        aliasMap.set(variable['id'], createdVariable);
        var keys = Object.keys(createdVariable.valuesByMode);
        for (let j = 0; j < sourceCollection.modes.length; j++) { // For each variable, iterate through modes
          let currentModeId = sourceCollection.modes[j].modeId;
          let currentModeValue = variable["valuesByMode"][currentModeId];
          if (isAlias(currentModeValue) != false) {
            if (aliasedVariables.length <= 0 || (h > 0 && aliasedVariables[aliasedVariables.length - 1]["id"] != variable["id"])) {
              aliasedVariables.push(variable); // if value is an alias, give it a hard-coded default value and add to array for later assignment
            }
            let varType = variable.resolvedType;
            switch (varType) { // Setting all aliased values to a default until we can go back and add their referenced values
              case 'BOOLEAN': createdVariable.setValueForMode(keys[j], false); console.log("Set BOOL to FALSE"); break;
              case 'COLOR': createdVariable.setValueForMode(keys[j], { r: 0, g: 0, b: 0, a: 1 }); console.log("Set COLOR to BLACK"); break;
              case 'FLOAT': createdVariable.setValueForMode(keys[j], 0); console.log("Set FLOAT to 0"); break;
              case 'STRING': createdVariable.setValueForMode(keys[j], "String Value --"); console.log("Set STRING to STRING VALUE --"); break;
              default: createdVariable.setValueForMode(keys[j], ""); break;
            }
          }
          else { createdVariable.setValueForMode(keys[j], currentModeValue) }
        }
      }
    }
  }
  if (aliasedVariables.length > 0) {
    aliasedVariables = remapAliases(aliasedVariables, aliasMap);
    console.log("aliasedVariables");
    getAliasedVariables(aliasedVariables).then(() => { console.log("Assigned Aliased Variables! -------") });
  }
}

const myFontLoadingFunction = async () => {
  await figma.loadFontAsync({ family: "Inter", style: "Bold" });
  await figma.loadFontAsync({ family: "Inter", style: "Regular" });
}

myFontLoadingFunction().then(() => {
  figma.showUI(__html__, { width: 420, height: 620, themeColors: true, title: "Variable Copy Paste" });
})

assignCopiedCollections();
setInterval(async function () { assignCopiedCollections() }, 3000);

figma.ui.onmessage = (msg: { type: string }) => {
  if (msg.type === 'copy-collection') {
    setCollections().then(() => assignCopiedCollections());
    figma.notify('Copied variables & collections', { timeout: 4000, error: false });
  }
  else if (msg.type === 'paste-collection') {
    console.log("PASTE COLLECTION");
    assignCopiedCollections().then(() => {
      createVariables(parsedCollections, parsedVariables);
      showInvalidAliases();
      figma.notify('Pasted variables & collections', { timeout: 4000, error: false });
    });
    printCurrentVariables();
  }
  else if (msg.type === 'export-collection') {
    exportVariableCsv();
    figma.notify('Exported variables & collections as CSV', { timeout: 4000, error: false });
  }
  figma.commitUndo();
};