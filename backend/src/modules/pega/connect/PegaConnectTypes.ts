export type ConnectMethod = 'GET' | 'POST' | 'PUT' | 'PATCH' | 'DELETE';
export type AuthType = 'basic' | 'oauth2' | 'apiKey' | 'custom' | 'none';
export type ConnectType = 'REST' | 'SOAP' | 'SQL' | 'File';

export interface PegaConnectRule {
  pxObjClass: string;
  pyName: string;
  pyLabel?: string;
  connectType: ConnectType;
  endpoint?: string;
  method?: ConnectMethod;
  authType?: AuthType;
  authRef?: string;
  headers?: PegaConnectHeader[];
  requestMapping?: string;
  responseMapping?: string;
  wsdlUrl?: string;
  soapAction?: string;
  dataSource?: string;
  sqlStatement?: string;
  filePath?: string;
  filePattern?: string;
}

export interface PegaConnectHeader {
  pyName: string;
  pyValue: string;
}

export interface PegaServiceRule {
  pxObjClass: string;
  pyName: string;
  serviceType: string;
  endpoint: string;
  allowedMethods: ConnectMethod[];
}