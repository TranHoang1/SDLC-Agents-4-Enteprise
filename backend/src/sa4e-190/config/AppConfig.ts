export interface AppConfig {
  statusFilePath: string;
  brdOutputDir: string;
  diagramsDir: string;
  drawioPath: string;
}

export const defaultConfig: AppConfig = {
  statusFilePath: '../documents/SA4E-190/STATUS.json',
  brdOutputDir: '../documents/SA4E-190',
  diagramsDir: '../documents/SA4E-190/diagrams',
  drawioPath: 'C:\\Program Files\\draw.io\\draw.io.exe'
};
