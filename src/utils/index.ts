import fs from 'fs-extra';
import path from 'path';
import { execSync } from 'child_process';

/**
 * Reads a template file from the CLI's templates directory, replaces placeholders, and writes it to the target monorepo package.
 * @param templateType - The type of package template (e.g., 'db', 'queue', 'types').
 * @param packageName - The name of the package to create.
 * @param monorepoRoot - The root directory of the monorepo.
 * @param cliRoot - The root directory of the CLI program.
 */
export const copyCliPackageTemplate = (
  templateType: string,
  packageName: string,
  monorepoRoot: string,
  repo: 'apps' | 'packages',
  cliRoot: string
): void => {
  const templateDir = path.join(cliRoot, 'templates', templateType);
  const targetDir = path.join(monorepoRoot, repo, packageName);

  console.log(`📂 Template Source (CLI Program): ${templateDir}`);
  console.log(`📂 Target Destination (Monorepo): ${targetDir}`);

  if (!fs.existsSync(templateDir)) {
    console.error(`❌ Template directory not found: ${templateDir}`);
    return;
  }

  // Ensure target directory exists
  fs.ensureDirSync(targetDir);

  // Copy all template files from CLI to the monorepo package directory
  fs.copySync(templateDir, targetDir, { overwrite: true });

  console.log(
    `✅ CLI package '${packageName}' created from '${templateType}' template.`
  );
};

export const getPnpmVersion = (): string => {
  try {
    return execSync('pnpm --version', { encoding: 'utf8' }).trim();
  } catch {
    console.warn('Could not determine pnpm version. Using default.');
    return '9.15.4'; // Fallback version
  }
};

/**
 * Deletes the .git directory if it exists in the specified application directory.
 * @param appDir - The application directory path.
 * @param name - The name of the application.
 */
export const removeGitDirectory = (appDir: string, name: string): void => {
  const gitDir = path.join(appDir, '.git');
  if (fs.existsSync(gitDir)) {
    console.log(`Removing .git directory from ${name} app...`);
    fs.removeSync(gitDir);
  }
};

/**
 * Writes a file, creating directories if needed.
 * @param filePath - The full path of the file.
 * @param content - The content to write into the file.
 */
export const writeFile = (filePath: string, content: string): void => {
  fs.mkdirSync(path.dirname(filePath), { recursive: true });
  fs.writeFileSync(filePath, content.trim(), 'utf-8');
};

/**
 * Writes a JSON object to a file.
 * @param filePath - The full path of the JSON file.
 * @param data - The JSON object to write.
 */
export const writeJsonFile = (filePath: string, data: object): void => {
  writeFile(filePath, JSON.stringify(data, null, 2));
};

/**
 * Creates a directory if it does not exist.
 * @param dirPath - The path of the directory to create.
 */
export const createDirIfNotExists = (dirPath: string): void => {
  if (!fs.existsSync(dirPath)) {
    fs.mkdirSync(dirPath, { recursive: true });
  }
};

/**
 * Executes a shell command.
 * @param command - The command to execute.
 * @param options - Optional execution options.
 */
export const runCommand = (
  command: string,
  options: { cwd?: string } = {}
): void => {
  console.log(`Executing: ${command} in ${options.cwd || process.cwd()}`);
  execSync(command, { stdio: 'inherit', ...options });
};

// -------------------------

/**
 * Executes a shell command and returns the output as a string.
 * @param command - The command to execute.
 * @param options - Optional execution options.
 * @returns The output of the command.
 */
export const runCommandWithResult = (
  command: string,
  options: { cwd?: string } = {}
): string => {
  return execSync(command, { encoding: 'utf-8', ...options }).trim();
};

/**
 * Checks if a file exists at the given path.
 * @param filePath - The path of the file.
 * @returns `true` if the file exists, otherwise `false`.
 */
export const fileExists = (filePath: string): boolean => {
  return fs.existsSync(filePath);
};

/**
 * Clears the contents of a directory without removing the directory itself.
 * @param dirPath - The path of the directory.
 */
export const clearDirectory = (dirPath: string): void => {
  if (fs.existsSync(dirPath)) {
    fs.emptyDirSync(dirPath);
  }
};

/**
 * Reads a JSON file and parses it into an object.
 * @param filePath - The path of the JSON file.
 * @returns The parsed JSON object.
 */
export const readJsonFile = (filePath: string): object => {
  if (!fs.existsSync(filePath)) {
    throw new Error(`File not found: ${filePath}`);
  }
  return JSON.parse(fs.readFileSync(filePath, 'utf-8'));
};

/**
 * Updates a JSON file by merging it with new data.
 * @param filePath - The path of the JSON file.
 * @param newData - The new data to merge into the existing JSON object.
 */
export const updateJsonFile = (filePath: string, newData: object): void => {
  const currentData = fileExists(filePath) ? readJsonFile(filePath) : {};
  const mergedData = { ...currentData, ...newData };
  writeJsonFile(filePath, mergedData);
};

/**
 * Logs a message with a specific color.
 * @param message - The message to log.
 * @param color - The chalk color function (e.g., chalk.green).
 */
export const logWithColor = (
  message: string,
  color: (msg: string) => string
): void => {
  console.log(color(message));
};
