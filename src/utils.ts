import fs from "fs";
import path from "path";

// for mocking up the interface, remove after all is working
import crypto from "crypto";
const mockHash = (string) => {
  return crypto.createHash("md5").update(string).digest("hex").slice(0, 4);
};

const limitString = (filename: string, length?: number) => {
  if (filename == null) return null;
  if (!length) length = 10;
  if (filename.length > length)
    return filename.slice(0, length / 2) + ".." + filename.slice(length / 2 * -1);
  else
    return filename;
};

// load the file from a path, return as {}
const getFileFromPath = function (filePath: string) {
  let file = <any>{};
  if (!fs.existsSync(filePath)) {
    console.error("Could not find a file in your filesystem: " + filePath);
    process.exit(0);
  }
  const stats = fs.statSync(filePath);
  file.size = stats.size;
  file.data = fs.readFileSync(filePath);
  file.name = path.basename(filePath);
  return file;
}

// maps an array of akord nodes types to each file, recusively, in dirPath
// arrayOfFiles, carries the list through the recursion
// originalPath, remembers where we started
// argv, if we want to pick some flag from command line
const getNodesForDir = function (dirPath: string, arrayOfFiles: any, originalPath: string) {
  var files = fs.readdirSync(dirPath);

  // remember the first entry point
  if (!arrayOfFiles) originalPath = dirPath;

  // node:root
  arrayOfFiles = arrayOfFiles || [
    {
      node: "root",
      path: dirPath,
    },
  ];

  files.forEach(function (file) {
    // skip hidden files, should make this into a cmd flag??
    if (file.slice(0, 1) != ".") {
      if (fs.statSync(dirPath + "/" + file).isDirectory()) {
        // node:folder
        // get parent
        var parent = dirPath.slice(originalPath.length);
        if (parent == "") parent = null;
        else parent = parent.split("/").slice(-1)[0];
        arrayOfFiles.push({
          node: "folder",
          name: file,
          parent,
          dirPath,
        });
        arrayOfFiles = getNodesForDir(
          dirPath + "/" + file,
          arrayOfFiles,
          originalPath
        );
      } else {
        // we have a file, now what kind? stack or note?
        if (file.slice(-5).toLowerCase() == ".note") {
          // note
          var folder = dirPath.slice(originalPath.length);
          if (folder == "") folder = null;
          else folder = folder.split("/").slice(-1)[0];
          arrayOfFiles.push({
            node: "note",
            name: file,
            file: path.resolve([dirPath, "/", file].join("")),
            folder: folder,
            dirPath,
          });
        } else {
          // stack
          var folder = dirPath.slice(originalPath.length);
          if (folder == "") folder = null;
          else folder = folder.split("/").slice(-1)[0];
          arrayOfFiles.push({
            node: "stack",
            name: file,
            file: path.resolve([dirPath, "/", file].join("")),
            folder: folder,
            dirPath,
          });
        }
      }
    }
  });

  return arrayOfFiles;
};

export { getNodesForDir, getFileFromPath, mockHash, limitString };
