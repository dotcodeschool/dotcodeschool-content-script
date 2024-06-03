require("dotenv").config();

const fs = require("fs");
const path = require("path");
const contentfulManagement = require("contentful-management");
const { sortBy, slice } = require("lodash");

const client = contentfulManagement.createClient({
  accessToken: process.env.CONTENTFUL_MANAGEMENT_ACCESS_TOKEN,
});

const parentDir = process.env.PARENT_DIR;

function parseMarkdown(markdown, index) {
  const lessonContentMatch = markdown.match(/\[filename\]\((.*?) ':include'\)/);
  const lessonContentPath = getLessonContentPath(
    lessonContentMatch,
    parentDir,
    index
  );
  const filePaths = getFilePaths(markdown, parentDir, index);

  return { lessonContentPath, filePaths };
}

function getLessonContentPath(lessonContentMatch, parentDir, index) {
  return lessonContentMatch
    ? `${parentDir}/${index}/${lessonContentMatch[1].replace("./", "")}`
    : null;
}

function getFilePaths(markdown, parentDir, index) {
  const filePathMatches = markdown.matchAll(
    /\[\.\/(.*?)\]\(.*? ':include :type=code .*?'\)/g
  );
  return Array.from(
    filePathMatches,
    (match) => `${parentDir}/${index}/${match[1]}`
  );
}

function maskToken(token) {
  return (
    token.substring(0, 5) +
    "**********************" +
    token.substring(token.length - 5)
  );
}

async function getEnvironment(client) {
  console.log("Starting...");
  const space = await client.getSpace(process.env.CONTENTFUL_SPACE_ID);
  console.log("✅ Got space");
  return await space.getEnvironment(process.env.CONTENTFUL_ENVIRONMENT);
}

async function main() {
  console.log(
    "🔑 Using access token:",
    maskToken(process.env.CONTENTFUL_MANAGEMENT_ACCESS_TOKEN)
  );

  const environment = await getEnvironment(client);
  console.log("✅ Got environment");

  const _directories = fs.readdirSync(parentDir);
  console.log("✅ Got directories");
  const directories = sortBy(_directories, (directory) => parseInt(directory));
  console.log("✅ Sorted directories");

  console.log("🔄 Starting loop...");

  let index = 0;

  let sectionName = null;
  let sectionDescription = null;
  let lessonEntries = [];
  for (const directory of directories) {
    console.log("\nProcessing directory: ", directory);

    const readmePath = path.join(parentDir, directory, "README.md");
    const readmeContent = fs.readFileSync(readmePath, "utf-8");

    console.log("\nCreating lesson:", directory);
    const { lessonContentPath, filePaths } = parseMarkdown(
      readmeContent,
      index
    );
    console.log("    Found lesson content:", lessonContentPath);
    console.log("    Found file paths:", filePaths);

    const lessonContent = fs.readFileSync(lessonContentPath, "utf-8");
    if (lessonContentPath.includes("/section/")) {
      console.log("\nProcessing section: ", lessonContentPath);

      if (lessonEntries.length > 0) {
        console.log("\nCreating section entry:", lessonContentPath);
        const sectionEntry = await environment.createEntry("section", {
          fields: {
            title: {
              "en-US": sectionName,
            },
            description: {
              "en-US": sectionDescription
                .map((str) => Buffer.from(str).toString("utf-8"))
                .join("\n"),
            },
            lessons: {
              "en-US": lessonEntries.map((entry) => ({
                sys: { type: "Link", linkType: "Entry", id: entry.sys.id },
              })),
            },
          },
        });
        await sectionEntry.publish();
        // Reset the lesson entries
        lessonEntries = [];
      }
      sectionName = lessonContent.match(/# (.*?)\n/)[1];
      sectionDescription = lessonContent.match(/# .*?\n\n([\s\S]*?)(?=\n#|$)/);
    } else {
      const sourceAssets = [];
      const templateAssets = [];
      const solutionAssets = [];

      console.log("⬆️ Uploading files from", directory);
      for (const filePath of filePaths) {
        if (fs.existsSync(filePath)) {
          const relativePath = path.relative(
            path.join(parentDir, directory),
            filePath
          );
          const splitPath = relativePath.split(path.sep);
          const finalPath = slice(splitPath, 1, splitPath.length).join("/");

          console.log("    Uploading file:", finalPath);

          const fileContent = fs.readFileSync(filePath, "utf-8");
          const upload = await environment.createUpload({
            file: fileContent,
          });

          const asset = await environment.createAsset({
            fields: {
              title: {
                "en-US": finalPath,
              },
              file: {
                "en-US": {
                  contentType: "text/plain",
                  fileName: finalPath,
                  uploadFrom: {
                    sys: {
                      type: "Link",
                      linkType: "Upload",
                      id: upload.sys.id,
                    },
                  },
                },
              },
            },
          });

          console.log("    Publishing asset", path.dirname(filePath), filePath);

          await asset.processForAllLocales();
          const latestAsset = await environment.getAsset(asset.sys.id);

          await latestAsset.publish();

          const assetLink = {
            sys: { type: "Link", linkType: "Asset", id: asset.sys.id },
          };

          if (filePath.includes("/source/")) {
            sourceAssets.push(assetLink);
          } else if (filePath.includes("/template/")) {
            templateAssets.push(assetLink);
          } else if (filePath.includes("/solution/")) {
            solutionAssets.push(assetLink);
          }
        }
      }
      console.log("\n✅ Finished uploading files", directory);

      console.log("\nCreating lesson entry", directory);
      const filesEntry = await environment.createEntry("files", {
        fields: {
          title: {
            "en-US": parentDir + "/" + directory,
          },
          source: {
            "en-US": sourceAssets,
          },
          template: {
            "en-US": templateAssets,
          },
          solution: {
            "en-US": solutionAssets,
          },
        },
      });

      console.log("\nPublishing lesson entry for:", directory);

      const latestFilesEntry = await environment.getEntry(filesEntry.sys.id);
      await latestFilesEntry.publish();

      const lessonEntry = await environment.createEntry("lesson", {
        fields: {
          lessonName: {
            "en-US": lessonContent.match(/# (.*?)\n/)[1],
          },
          lessonContent: {
            "en-US": lessonContent,
          },
          lessonDescription: {
            "en-US":
              "Lorem ipsum dolor sit amet, consectetur adipiscing elit. Donec auctor, nisl eget ultricies ultrices, nunc nisl aliquam nunc, vitae aliquam nisl nunc nec nisl.",
          },
          files: {
            "en-US": {
              sys: { type: "Link", linkType: "Entry", id: filesEntry.sys.id },
            },
          },
        },
      });
      const latestLessonEntry = await environment.getEntry(lessonEntry.sys.id);
      await latestLessonEntry.publish();

      lessonEntries.push(latestLessonEntry);
    }

    console.log("✅ Finished processing directory", directory);
    index++;
  }
  if (lessonEntries.length > 0) {
    console.log(
      "\n\n\nHERE\n\n\n",
      sectionName,
      sectionDescription,
      lessonEntries
    );
    const sectionEntry = await environment.createEntry("section", {
      fields: {
        title: {
          "en-US": sectionName,
        },
        description: {
          "en-US": sectionDescription
            .map((str) => Buffer.from(str).toString("utf-8"))
            .join("\n"),
        },
        lessons: {
          "en-US": lessonEntries.map((entry) => ({
            sys: { type: "Link", linkType: "Entry", id: entry.sys.id },
          })),
        },
      },
    });
    await sectionEntry.publish();
  }
}

main();
