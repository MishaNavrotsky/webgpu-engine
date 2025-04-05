export const MULTISAMPLE_COUNT = 1 as const;
export const DEPTH_STENCIL_FORMAT: GPUTextureFormat = 'depth24plus' as const;

export const TEXTURE_IDS = {
  colorTexture: 'colorTexture',
  normalTexture: 'normalTexture',
  emissiveTexture: 'emissiveTexture',
  metalicRoughnessTexture: 'metalicRoughnessTexture'
} as const

export const TEXTURE_SAMPLERS_IDS = {
  colorSampler: 'colorSampler',
  normalSampler: 'normalSampler',
  emissiveSampler: 'emissiveSampler',
  metalicRoughnessSampler: 'metalicRoughnessSampler'
} as const

export const VERTEX_BUFFER_IDS = {
  positionBuffer: 'positionBuffer',
  texCoordsBuffer: 'texCoordsBuffer',
  normalsBuffer: 'normalsBuffer',
  tangetsBuffer: 'tangetsBuffer',
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
  tangetsBuffer: 'float32x4',
} as const

export const INDICES_BUFFER_ID = 'indicesBuffer' as const
export const UNIFORM_BUFFER_IDS = {
  camera: 'camera',
  pointLights: 'pointLights',
  settings: 'settings',
}

