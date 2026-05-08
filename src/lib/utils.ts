import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

// Convert string to comma separated numbers
export function stringToNumbers(str: string): string {
  if (!str) return "";
  const arr = [];
  for (let i = 0; i < str.length; i++) {
    arr.push(str.charCodeAt(i));
  }
  return arr.join(",");
}

// Convert comma separated numbers back to string
export function numbersToString(numStr: string): string {
  if (!numStr) return "";
  const arr = numStr.split(",").map(Number);
  // Prevent stack overflow with chunking for large arrays
  let result = "";
  for (let i = 0; i < arr.length; i += 5000) {
    result += String.fromCharCode(...arr.slice(i, i + 5000));
  }
  return result;
}

