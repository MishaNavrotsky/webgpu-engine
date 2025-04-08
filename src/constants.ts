export const MULTISAMPLE_COUNT = 1 as const;
export const DEPTH_STENCIL_FORMAT: GPUTextureFormat = 'depth24plus' as const;

export const TEXTURE_IDS = {
  colorTexture: 'colorTexture',
  normalTexture: 'normalTexture',
  emissiveTexture: 'emissiveTexture',
  metalicRoughnessTexture: 'metalicRoughnessTexture',
  occlusionTexture: 'occlusionTexture',
} as const

export const TEXTURE_SAMPLERS_IDS = {
  colorSampler: 'colorSampler',
  normalSampler: 'normalSampler',
  emissiveSampler: 'emissiveSampler',
  metalicRoughnessSampler: 'metalicRoughnessSampler',
  occlusionSampler: 'occlusionSampler',
} as const

export const VERTEX_BUFFER_IDS = {
  positionBuffer: 'positionBuffer',
  texCoordsBuffer: 'texCoordsBuffer',
  normalsBuffer: 'normalsBuffer',
  tangentsBuffer: 'tangentsBuffer',
} as const

export const VERTEX_BUFFER_SIZES = {
  positionBuffer: 4 * 3,
  texCoordsBuffer: 4 * 2,
  normalsBuffer: 4 * 3,
  tangetsBuffer: 4 * 4,
} as const

export const VERTEX_BUFFER_SIZES_FORMAT: { [key in keyof typeof VERTEX_BUFFER_IDS]: GPUVertexFormat } = {
  positionBuffer: 'float32x3',
  texCoordsBuffer: 'float32x2',
  normalsBuffer: 'float32x3',
  tangentsBuffer: 'float32x4',
} as const

export const INDICES_BUFFER_ID = 'indicesBuffer' as const
export const UNIFORM_BUFFER_IDS = {
  camera: 'camera',
  pointLights: 'pointLights',
  settings: 'settings',
}

export const D_PASS_TEXTURE_FORMAT: GPUTextureFormat = 'rgba32float'
export const D_PASS_FRAGMENT_OUTS = ['albedo', 'emissive', 'aoMetalicRoughness', 'pNormals', 'worldPosition', 'vBiTangents', 'vNormals', 'vTangents'] as const

export const LIGHT_TYPES = { point: 'point', directional: 'directional', spot: 'spot' } as const

export const VBS_DEF_SEQUENCE = [VERTEX_BUFFER_IDS.positionBuffer, VERTEX_BUFFER_IDS.texCoordsBuffer, VERTEX_BUFFER_IDS.normalsBuffer, VERTEX_BUFFER_IDS.tangentsBuffer]
export const TEX_DEF_SEQUENCE = [TEXTURE_IDS.colorTexture, TEXTURE_IDS.normalTexture, TEXTURE_IDS.emissiveTexture, TEXTURE_IDS.metalicRoughnessTexture, TEXTURE_IDS.occlusionTexture]
export const SAMPLERS_DEF_SEQUENCE = [TEXTURE_SAMPLERS_IDS.colorSampler, TEXTURE_SAMPLERS_IDS.normalSampler, TEXTURE_SAMPLERS_IDS.emissiveSampler, TEXTURE_SAMPLERS_IDS.metalicRoughnessSampler, TEXTURE_SAMPLERS_IDS.occlusionSampler]
