import { execSync } from "child_process";
import fs from "fs";
import semver from "semver";

const LABEL_PREFIX = "release:";

export async function bumpPRVersion(context) {
  const version = process.env.BASE_VERSION;
  const { version: headVersion } = JSON.parse(
    fs.readFileSync("./package.json")
  );

  const blockingLabels = process.env.STRICT_NO_RELEASE_LABELS.split("\n");
  const nonBlockingLabels = process.env.NO_RELEASE_LABELS.split("\n");
  const { labels } = context.payload.pull_request;

  // get version level from PR label
  const releaseLabels = labels
    .map((label) => label.name)
    .filter((label) => label.startsWith(LABEL_PREFIX));
  let shouldBump = !labels.some((label) => blockingLabels.includes(label.name));
  if (releaseLabels.length > 1 && shouldBump) {
    throw new Error(
      `Found more than one release label: ${releaseLabels.join(", ")}`
    );
  }
  const releaseLevel = releaseLabels[0]?.replace(LABEL_PREFIX, "");
  if (!releaseLevel && shouldBump) {
    shouldBump = !labels.some((label) =>
      nonBlockingLabels.includes(label.name)
    );
  }
  // increment version
  const nextVersion = shouldBump
    ? semver.inc(
        version,
        releaseLabels[0]?.replace(LABEL_PREFIX, "") || "prerelease",
        process.env.PRERELEASE_TAG
      )
    : version;

  // write file
  fs.writeFileSync(
    "./package.json",
    JSON.stringify(
      {
        ...JSON.parse(fs.readFileSync("./package.json")),
        version: nextVersion,
      },
      null,
      2
    )
  );
  execSync("npx prettier --write package.json");

  if (nextVersion !== headVersion) {
    console.log(
      `Bumping version from ${version} to ${nextVersion}, current head version is ${headVersion}`
    );
    return nextVersion;
  } else {
    console.log(`Version is up to date (${headVersion})`);
    return "";
  }
}
