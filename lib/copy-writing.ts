import { CopyExercise, CopyMetrics } from './types';

// Create a copy writing exercise
export function createCopyWritingExercise(text: string, linesPerPage: number = 4): CopyExercise {
  const lines = splitTextIntoLines(text, linesPerPage);

  return {
    id: `exercise-${Date.now()}`,
    text,
    lines,
    currentLineIndex: 0,
    completed: false,
  };
}

// Split text into lines based on character count or word boundaries
function splitTextIntoLines(text: string, linesPerPage: number): string[] {
  if (linesPerPage <= 0) return [text];

  const words = text.split(' ');
  const lines: string[] = [];
  let currentLine = '';

  words.forEach((word, index) => {
    if ((currentLine + word).length <= 50) {
      currentLine += (currentLine ? ' ' : '') + word;
    } else {
      if (currentLine) lines.push(currentLine);
      currentLine = word;
    }

    // Add last word
    if (index === words.length - 1 && currentLine) {
      lines.push(currentLine);
    }
  });

  return lines;
}

// Get next line to copy
export function getNextLine(exercise: CopyExercise): string | null {
  if (exercise.currentLineIndex >= exercise.lines.length) {
    exercise.completed = true;
    return null;
  }

  return exercise.lines[exercise.currentLineIndex];
}

// Mark line as completed
export function completeCurrentLine(exercise: CopyExercise): boolean {
  if (exercise.currentLineIndex < exercise.lines.length) {
    exercise.currentLineIndex++;
    
    if (exercise.currentLineIndex >= exercise.lines.length) {
      exercise.completed = true;
    }
    
    return true;
  }

  return false;
}

// Go to specific line
export function goToLine(exercise: CopyExercise, lineIndex: number): boolean {
  if (lineIndex >= 0 && lineIndex < exercise.lines.length) {
    exercise.currentLineIndex = lineIndex;
    return true;
  }

  return false;
}

// Validate line completion by comparing handwriting with target
export function validateLineCompletion(
  userText: string,
  targetText: string,
  threshold: number = 0.7
): { isValid: boolean; confidence: number } {
  const confidence = calculateTextSimilarity(userText, targetText);

  return {
    isValid: confidence >= threshold,
    confidence,
  };
}

// Simple text similarity calculation (edit distance based)
function calculateTextSimilarity(str1: string, str2: string): number {
  const distance = levenshteinDistance(str1.toLowerCase(), str2.toLowerCase());
  const maxLength = Math.max(str1.length, str2.length);

  if (maxLength === 0) return 1;

  return 1 - distance / maxLength;
}

// Levenshtein distance algorithm
function levenshteinDistance(s1: string, s2: string): number {
  const len1 = s1.length;
  const len2 = s2.length;
  const matrix: number[][] = Array.from({ length: len1 + 1 }, () => Array(len2 + 1).fill(0));

  for (let i = 0; i <= len1; i++) matrix[i][0] = i;
  for (let j = 0; j <= len2; j++) matrix[0][j] = j;

  for (let i = 1; i <= len1; i++) {
    for (let j = 1; j <= len2; j++) {
      const cost = s1[i - 1] === s2[j - 1] ? 0 : 1;
      matrix[i][j] = Math.min(
        matrix[i - 1][j] + 1,
        matrix[i][j - 1] + 1,
        matrix[i - 1][j - 1] + cost
      );
    }
  }

  return matrix[len1][len2];
}

// Get progress through exercise
export function getExerciseProgress(exercise: CopyExercise): { completed: number; total: number; percentage: number } {
  const completed = exercise.currentLineIndex;
  const total = exercise.lines.length;
  const percentage = total === 0 ? 0 : Math.round((completed / total) * 100);

  return { completed, total, percentage };
}

// Get metrics for completed exercise
export function generateLineMetrics(
  exercise: CopyExercise,
  timeSpent: number,
  accuracy: number
): CopyMetrics {
  return {
    totalLines: exercise.lines.length,
    completedLines: exercise.currentLineIndex,
    accuracy,
    timeSpent,
  };
}

// Create progressive exercise (easier lines first)
export function createProgressiveExercise(
  text: string,
  difficulty: 1 | 2 | 3 | 4 | 5 = 3
): CopyExercise {
  let lines: string[];

  switch (difficulty) {
    case 1:
      // Single characters
      lines = text.split('').filter((c) => /[a-zA-Z]/.test(c));
      break;
    case 2:
      // Single words
      lines = text.split(/\s+/).filter((w) => w.length <= 5);
      break;
    case 3:
      // Short phrases (2-3 words)
      lines = text.match(/\b[\w\s]{5,20}\b/g) || [];
      break;
    case 4:
      // Sentences
      lines = text.match(/[^.!?]+[.!?]+/g) || [text];
      break;
    case 5:
      // Full text
      lines = [text];
      break;
  }

  return {
    id: `progressive-exercise-${Date.now()}`,
    text,
    lines: lines.length > 0 ? lines : [text],
    currentLineIndex: 0,
    completed: false,
  };
}

// Get recommended lines based on grade level
export function getRecommendedText(gradeLevel: 'nursery' | 'reception' | 'year1' | 'year2'): string {
  const texts: Record<string, string> = {
    nursery: 'a b c d e f g h i j k l m n o p q r s t u v w x y z',
    reception: 'The cat sat on the mat. The dog ran in the park.',
    year1: 'I like to read books. I play with my friends. I am happy.',
    year2: 'The sun is shining brightly. We play games at school. I enjoy learning new things.',
  };

  return texts[gradeLevel] || texts.reception;
}

// Analyze user performance
export function analyzePerformance(metrics: CopyMetrics[]): {
  averageAccuracy: number;
  averageTimePerLine: number;
  improvementTrend: number;
} {
  if (metrics.length === 0) {
    return { averageAccuracy: 0, averageTimePerLine: 0, improvementTrend: 0 };
  }

  const totalAccuracy = metrics.reduce((sum, m) => sum + m.accuracy, 0);
  const averageAccuracy = totalAccuracy / metrics.length;

  const totalTime = metrics.reduce((sum, m) => sum + m.timeSpent, 0);
  const totalLines = metrics.reduce((sum, m) => sum + m.totalLines, 0);
  const averageTimePerLine = totalLines === 0 ? 0 : totalTime / totalLines;

  // Calculate improvement trend (comparing first half vs second half)
  const midpoint = Math.floor(metrics.length / 2);
  const firstHalf = metrics.slice(0, midpoint);
  const secondHalf = metrics.slice(midpoint);

  const firstHalfAvg = firstHalf.length > 0 ? firstHalf.reduce((sum, m) => sum + m.accuracy, 0) / firstHalf.length : 0;
  const secondHalfAvg = secondHalf.length > 0 ? secondHalf.reduce((sum, m) => sum + m.accuracy, 0) / secondHalf.length : 0;

  const improvementTrend = secondHalfAvg - firstHalfAvg;

  return {
    averageAccuracy,
    averageTimePerLine,
    improvementTrend,
  };
}
