export interface PegaClassDefinition {
  pxObjClass: string;
  baseClass?: string;
  properties: PegaPropertyDef[];
  children: PegaChildDef[];
  description?: string;
  label?: string;
}

export interface PegaPropertyDef {
  name: string;
  type: 'string' | 'number' | 'boolean' | 'ref' | 'json';
  required: boolean;
  isSystem: boolean;
  isReference: boolean;
  description?: string;
}

export interface PegaChildDef {
  name: string;
  childType: string;
  arrayType: 'array' | 'single';
  description?: string;
}
