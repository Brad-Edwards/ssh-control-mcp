import { NULL_OR_UNDEFINED_ARGUMENTS_ERROR } from './constants.js';
import { homedir } from 'os';
import { resolve } from 'path';

/**
 * Expand tilde (~) in file paths to the user's home directory
 * @param filePath - The file path to expand
 * @returns The expanded file path
 * @throws An error if the file path is null or undefined
 */
export function expandTilde(filePath: string): string {
  if (filePath === undefined || filePath === null) {
    throw new Error(NULL_OR_UNDEFINED_ARGUMENTS_ERROR);
  }
  if (filePath === '~') {
    return homedir();
  }
  if (filePath.startsWith('~/')) {
    return resolve(homedir(), filePath.slice(2));
  }
  return filePath;
} 