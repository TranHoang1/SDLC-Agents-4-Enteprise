/**
 * KSA-163: Test file detection heuristics.
 */

export class TestFileDetector {
  private testPatterns = [
    /\.test\.[jt]sx?$/,
    /\.spec\.[jt]sx?$/,
    /_test\.(py|go|rs)$/,
    /test_.*\.py$/,
    /Test\.java$/,
    /Test\.kt$/,
  ];
  private testDirs = ['__tests__', 'tests', 'test', 'spec'];

  /** Check if a file path is a test file. */
  isTestFile(filePath: string): boolean {
    const normalized = filePath.replace(/\\/g, '/');
    return (
      this.testPatterns.some(p => p.test(normalized)) ||
      this.testDirs.some(d => normalized.includes(`/${d}/`))
    );
  }

  /** Check if a symbol name looks like a test function. */
  isTestFunction(symbolName: string): boolean {
    return (
      symbolName.startsWith('test_') ||
      symbolName.startsWith('Test') ||
      symbolName.startsWith('it_') ||
      symbolName.startsWith('should_') ||
      /^(describe|it|test)\b/.test(symbolName)
    );
  }
}
